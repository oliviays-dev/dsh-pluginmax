import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExternalAgentProcessRunner } from "./external.js";
import type { ExternalAgentRuntime } from "./types.js";

let workspacePath = "";
let scriptDirectory = "";

beforeAll(async () => {
  scriptDirectory = await mkdtemp(join(tmpdir(), "dsh-external-test-"));
  workspacePath = join(scriptDirectory, "project");
  await mkdir(workspacePath, { recursive: true });
});

afterAll(async () => {
  await rm(scriptDirectory, { recursive: true, force: true });
});

function runtime(
  overrides: Partial<ExternalAgentRuntime> = {},
): ExternalAgentRuntime {
  const timestamp = "2026-09-30T00:00:00.000Z";
  return {
    id: "runtime-1",
    name: "Test Runtime",
    provider: "command",
    protocol: "plain-text",
    command: "cat",
    args: [],
    status: "active",
    visibility: "workspace",
    ownerUserId: "owner",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

async function script(command: string): Promise<string> {
  const path = join(scriptDirectory, `agent-${crypto.randomUUID()}.js`);
  await writeFile(path, command, "utf8");
  await chmod(path, 0o700);
  return path;
}

describe("external agent process runner", () => {
  it("sends the prompt to a plain-text command and collects stdout", async () => {
    const path = await script(
      "let prompt = ''; process.stdin.on('data', (chunk) => { prompt += chunk; }); process.stdin.on('end', () => { process.stdout.write(`echo:${prompt.trim()}`); });",
    );
    const runner = new ExternalAgentProcessRunner();
    const chunks: string[] = [];
    const result = await runner.execute({
      runId: "run-1",
      runtime: runtime({ command: "node", args: [path] }),
      prompt: "请完成交付报告",
      workspacePath,
      signal: new AbortController().signal,
      onProgress: (text) => chunks.push(text),
    });
    expect(result.stopReason).toBe("completed");
    expect(result.output).toEqual([
      { type: "text", text: "echo:请完成交付报告" },
    ]);
    expect(chunks.join("")).toContain("请完成交付报告");
  });

  it("parses Codex progress, session id, and final message", async () => {
    const path = await script(
      [
        "let input = '';",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        "  process.stdout.write(JSON.stringify({ type: 'progress', text: 'working', thread_id: 'provider-thread-1' }) + '\\n');",
        "  const outputIndex = process.argv.indexOf('--output-last-message');",
        "  require('node:fs').writeFileSync(process.argv[outputIndex + 1], '# 交付报告\\n\\n## 交付说明\\n\\nCodex 已完成。');",
        "});",
      ].join("\n"),
    );
    const runner = new ExternalAgentProcessRunner();
    const result = await runner.execute({
      runId: "run-2",
      runtime: runtime({
        provider: "codex",
        protocol: "codex-jsonl",
        command: "node",
        args: [path],
      }),
      prompt: "请完成交付报告",
      workspacePath,
      signal: new AbortController().signal,
    });
    expect(result.stopReason).toBe("completed");
    expect(result.sessionId).toBe("provider-thread-1");
    expect(result.output[0]?.text).toContain("Codex 已完成。");
  });

  it("reports launch failures as failed runs", async () => {
    const runner = new ExternalAgentProcessRunner();
    const result = await runner.execute({
      runId: "run-3",
      runtime: runtime({ command: "definitely-not-installed-command" }),
      prompt: "hello",
      workspacePath,
      signal: new AbortController().signal,
    });
    expect(result.stopReason).toBe("failed");
    expect(result.diagnostic).toContain("ENOENT");
  });
});
