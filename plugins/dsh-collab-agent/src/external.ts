import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExternalAgentRuntime } from "./types.js";

export interface ExternalRunnerRequest {
  readonly runId: string;
  readonly runtime: ExternalAgentRuntime;
  readonly prompt: string;
  readonly workspacePath: string;
  readonly signal: AbortSignal;
  readonly onProgress?: (text: string) => void;
}

export interface ExternalRunnerResult {
  readonly output: ReadonlyArray<{
    readonly type: "text";
    readonly text: string;
  }>;
  readonly stopReason: "completed" | "failed" | "cancelled";
  readonly sessionId?: string | undefined;
  readonly diagnostic?: string | undefined;
}

export type ExternalAgentTraceKind =
  "spawn" | "stdin" | "stdout" | "stderr" | "error" | "close";

export interface ExternalAgentTraceEvent {
  readonly kind: ExternalAgentTraceKind;
  readonly runId: string;
  readonly runtimeName: string;
  readonly provider: ExternalAgentRuntime["provider"];
  readonly protocol: ExternalAgentRuntime["protocol"];
  readonly command: string;
  readonly args: readonly string[];
  readonly workspacePath: string;
  readonly pid?: number | undefined;
  readonly stdinBytes?: number | undefined;
  readonly data?: string | undefined;
  readonly exitCode?: number | null | undefined;
  readonly exitSignal?: string | null | undefined;
  readonly durationMs?: number | undefined;
  readonly message?: string | undefined;
}

export type ExternalAgentTraceListener = (
  event: ExternalAgentTraceEvent,
) => void;

/** Writes execution evidence to the terminal hosting the DSH service. */
export const terminalExternalAgentTrace: ExternalAgentTraceListener = (
  event,
) => {
  try {
    const header = [
      `[外部Agent]`,
      `run=${event.runId}`,
      `agent=${event.runtimeName}`,
      ...(event.pid === undefined ? [] : [`pid=${event.pid}`]),
    ].join(" ");
    const body =
      event.kind === "spawn"
        ? `${event.command} ${event.args.join(" ")} (cwd=${event.workspacePath})`
        : event.kind === "stdin"
          ? `stdin 已写入 ${event.stdinBytes ?? 0} 字节`
          : event.kind === "close"
            ? `exit=${event.exitCode ?? "-"} signal=${event.exitSignal ?? "-"} duration=${event.durationMs ?? 0}ms`
            : (event.data ?? event.message ?? "");
    process.stderr.write(`${header} ${event.kind}: ${body}\n`);
  } catch {
    // Terminal tracing is best-effort and must never affect task execution.
  }
};

export interface ExternalAgentRunner {
  progress(runId: string): string | undefined;
  execute(request: ExternalRunnerRequest): Promise<ExternalRunnerResult>;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : undefined;
}

function collectText(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim() !== "") found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, found);
    return found;
  }
  const record = asRecord(value);
  if (record === undefined) return found;
  for (const key of ["text", "message", "content", "delta", "summary"]) {
    if (key in record) collectText(record[key], found);
  }
  return found;
}

function findSessionId(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  for (const key of ["sessionId", "session_id", "threadId", "thread_id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  for (const child of Object.values(record)) {
    const nested = findSessionId(child);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function terminate(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export class ExternalAgentProcessRunner implements ExternalAgentRunner {
  private readonly progressByRun = new Map<string, string>();

  constructor(
    private readonly options: {
      readonly onTrace?: ExternalAgentTraceListener | undefined;
    } = {},
  ) {}

  progress(runId: string): string | undefined {
    return this.progressByRun.get(runId);
  }

  private commandAndArgs(
    runtime: ExternalAgentRuntime,
    request: ExternalRunnerRequest,
    outputFileName: string | undefined,
  ): { readonly command: string; readonly args: string[] } {
    if (runtime.protocol === "codex-jsonl") {
      return {
        command: runtime.command,
        args: [
          ...runtime.args,
          "exec",
          "--json",
          "--cd",
          request.workspacePath,
          "--sandbox",
          "read-only",
          ...(outputFileName === undefined
            ? []
            : ["--output-last-message", outputFileName]),
          "-",
        ],
      };
    }
    return { command: runtime.command, args: [...runtime.args] };
  }

  async execute(request: ExternalRunnerRequest): Promise<ExternalRunnerResult> {
    if (request.signal.aborted) {
      return { output: [], stopReason: "cancelled" };
    }
    if (request.runtime.protocol === "codex-jsonl") {
      return await this.executeCodex(request);
    }
    return await this.executePlainText(request);
  }

  private async executeCodex(
    request: ExternalRunnerRequest,
  ): Promise<ExternalRunnerResult> {
    const directory = await mkdtemp(join(tmpdir(), "dsh-external-agent-"));
    const outputFile = join(directory, "last-message.md");
    try {
      await writeFile(outputFile, "", { encoding: "utf8" });
      const { command, args } = this.commandAndArgs(
        request.runtime,
        request,
        outputFile,
      );
      const execution = await this.spawnAndCollect({
        ...request,
        runtimeName: request.runtime.name,
        provider: request.runtime.provider,
        protocol: request.runtime.protocol,
        command,
        args,
        captureStdoutAsOutput: false,
        allowEmptyStdout: true,
        onStdoutLine: (line) => {
          try {
            const event = JSON.parse(line) as unknown;
            const texts = collectText(event);
            if (texts.length > 0) {
              this.appendProgress(request.runId, texts.join("\n"));
              request.onProgress?.(this.progressByRun.get(request.runId) ?? "");
            }
            return findSessionId(event);
          } catch {
            return undefined;
          }
        },
      });
      if (execution.stopReason !== "completed") return execution;
      const finalText = (await readFile(outputFile, "utf8")).trim();
      if (finalText === "") {
        return {
          output: execution.output,
          stopReason: "failed",
          ...(execution.sessionId === undefined
            ? {}
            : { sessionId: execution.sessionId }),
          diagnostic: "Codex did not return a final message",
        };
      }
      return {
        output: [{ type: "text", text: finalText }],
        stopReason: "completed",
        ...(execution.sessionId === undefined
          ? {}
          : { sessionId: execution.sessionId }),
      };
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  private async executePlainText(
    request: ExternalRunnerRequest,
  ): Promise<ExternalRunnerResult> {
    const { command, args } = this.commandAndArgs(
      request.runtime,
      request,
      undefined,
    );
    return await this.spawnAndCollect({
      ...request,
      runtimeName: request.runtime.name,
      provider: request.runtime.provider,
      protocol: request.runtime.protocol,
      command,
      args,
      captureStdoutAsOutput: true,
      onStdoutChunk: (chunk) => {
        this.appendProgress(request.runId, chunk);
        request.onProgress?.(this.progressByRun.get(request.runId) ?? "");
      },
    });
  }

  private appendProgress(runId: string, text: string): void {
    const current = this.progressByRun.get(runId) ?? "";
    this.progressByRun.set(runId, `${current}${text}`.slice(-60_000));
  }

  private spawnAndCollect(input: {
    readonly runId: string;
    readonly runtimeName: string;
    readonly provider: ExternalAgentRuntime["provider"];
    readonly protocol: ExternalAgentRuntime["protocol"];
    readonly command: string;
    readonly args: readonly string[];
    readonly prompt: string;
    readonly signal: AbortSignal;
    readonly workspacePath: string;
    readonly captureStdoutAsOutput: boolean;
    readonly allowEmptyStdout?: boolean | undefined;
    readonly onStdoutLine?: (line: string) => string | undefined;
    readonly onStdoutChunk?: (chunk: string) => void;
  }): Promise<ExternalRunnerResult> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let sessionId: string | undefined;
      let lineBuffer = "";
      let settled = false;
      const startedAt = Date.now();
      const trace = (
        event: Omit<
          ExternalAgentTraceEvent,
          | "runId"
          | "runtimeName"
          | "provider"
          | "protocol"
          | "command"
          | "args"
          | "workspacePath"
        >,
      ): void => {
        this.options.onTrace?.({
          runId: input.runId,
          runtimeName: input.runtimeName,
          provider: input.provider,
          protocol: input.protocol,
          command: input.command,
          args: input.args,
          workspacePath: input.workspacePath,
          ...event,
        });
      };
      const child = spawn(input.command, [...input.args], {
        cwd: input.workspacePath,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      trace({ kind: "spawn", pid: child.pid });
      const finish = (result: ExternalRunnerResult): void => {
        if (settled) return;
        settled = true;
        input.signal.removeEventListener("abort", onAbort);
        resolve(result);
      };
      const onAbort = (): void => {
        terminate(child);
        finish({ output: [], stopReason: "cancelled" });
      };
      input.signal.addEventListener("abort", onAbort, { once: true });
      child.once("error", (cause: Error) => {
        trace({ kind: "error", message: cause.message });
        finish({
          output: [],
          stopReason: "failed",
          ...(sessionId === undefined ? {} : { sessionId }),
          diagnostic: cause.message,
        });
      });
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout = `${stdout}${chunk}`.slice(-120_000);
        trace({ kind: "stdout", data: chunk });
        if (input.onStdoutChunk !== undefined) input.onStdoutChunk(chunk);
        if (input.onStdoutLine === undefined) return;
        lineBuffer += chunk;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim() === "") continue;
          const found = input.onStdoutLine(line);
          if (found !== undefined) sessionId = found;
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-20_000);
        trace({ kind: "stderr", data: chunk });
      });
      child.once("close", (code) => {
        trace({
          kind: "close",
          exitCode: code,
          exitSignal: child.signalCode,
          durationMs: Date.now() - startedAt,
        });
        if (input.onStdoutLine !== undefined && lineBuffer.trim() !== "") {
          const found = input.onStdoutLine(lineBuffer);
          if (found !== undefined) sessionId = found;
        }
        const outputText = input.captureStdoutAsOutput ? stdout.trim() : "";
        const diagnostic = [stderr.trim(), stdout.trim()].find(
          (value) => value !== "",
        );
        if (code === 0) {
          if (outputText === "" && input.allowEmptyStdout === true) {
            finish({
              output: [],
              stopReason: "completed",
              ...(sessionId === undefined ? {} : { sessionId }),
            });
            return;
          }
          finish({
            output:
              outputText === "" ? [] : [{ type: "text", text: outputText }],
            stopReason: outputText === "" ? "failed" : "completed",
            ...(sessionId === undefined ? {} : { sessionId }),
            ...(outputText === ""
              ? {
                  diagnostic:
                    diagnostic === undefined
                      ? "外部 Agent 未返回可用的文本输出"
                      : `外部 Agent 未返回可用的文本输出：${diagnostic}`,
                }
              : {}),
          });
          return;
        }
        finish({
          output: [],
          stopReason: "failed",
          ...(sessionId === undefined ? {} : { sessionId }),
          diagnostic: `process exited with ${code}${diagnostic === undefined ? "" : `: ${diagnostic}`}`,
        });
      });
      child.stdin.on("error", () => undefined);
      trace({ kind: "stdin", stdinBytes: Buffer.byteLength(input.prompt) });
      child.stdin.end(input.prompt, "utf8");
    });
  }
}

export function externalSessionId(runId: string): string {
  return `external-${runId}-${randomUUID()}`
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 200);
}

export function probeExternalRuntime(
  command: string,
  timeoutMs = 3_000,
): Promise<{ readonly ok: boolean; readonly message: string }> {
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const child = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (ok: boolean, message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok,
        message: message.slice(0, 500),
      });
    };
    const timer = setTimeout(() => {
      terminate(child);
      finish(false, "探测超时：命令未在 3 秒内返回 --version");
    }, timeoutMs);
    child.once("error", (cause: Error) => finish(false, cause.message));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("close", (code) => {
      finish(
        code === 0,
        code === 0
          ? "命令可用"
          : `命令退出码 ${code}${stderr.trim() === "" ? "" : `：${stderr.trim()}`}`,
      );
    });
  });
}
