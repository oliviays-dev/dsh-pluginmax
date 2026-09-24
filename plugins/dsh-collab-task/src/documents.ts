import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
import type { TaskRecord } from "./types.js";

/** A window in which an agent run could have written files. */
export interface DocumentWindow {
  readonly from: number;
  readonly to: number;
  readonly actor: string;
}

export interface TaskDocumentEntry {
  readonly id: string;
  readonly kind: "produced" | "uploaded";
  readonly name: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mimeType: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly available: boolean;
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".pnpm-store",
  "node_modules",
  "__pycache__",
  ".venv",
]);

/** 操作系统生成的元数据文件，不属于交付物。 */
const IGNORED_FILES = new Set([
  ".DS_Store",
  ".localized",
  "Thumbs.db",
  "desktop.ini",
]);

const MIME_TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".markdown": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function mimeTypeFor(name: string): string {
  return MIME_TYPES[extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Directory holding the bytes of files uploaded by task participants. */
export function uploadDirectory(root: string, taskId: string): string {
  return join(root, ".pluginmax", "task-uploads", taskId);
}

export function safeFileName(name: string): string {
  const trimmed = basename(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\p{Cc}/gu, "_")
    .trim();
  const safe =
    trimmed === "" || trimmed === "." || trimmed === ".." ? "file" : trimmed;
  return safe.slice(-160);
}

export function toRelativePath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

export interface CollectDocumentsOptions {
  readonly root: string;
  readonly windows: readonly DocumentWindow[];
  readonly maxFiles?: number;
  readonly maxEntries?: number;
}

/**
 * Lists files written inside the workspace while one of the given agent runs
 * was active. Newest first; each entry carries the run owner as `updatedBy`.
 */
export async function collectDocuments(
  options: CollectDocumentsOptions,
): Promise<TaskDocumentEntry[]> {
  const { root, windows } = options;
  if (windows.length === 0) return [];
  const maxFiles = options.maxFiles ?? 200;
  const maxEntries = options.maxEntries ?? 6000;
  const found = new Map<string, TaskDocumentEntry>();
  const queue: string[] = [""];
  let visited = 0;
  while (queue.length > 0 && found.size < maxFiles && visited < maxEntries) {
    const directory = queue.shift() ?? "";
    let dirents;
    try {
      dirents = await readdir(join(root, directory), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of dirents) {
      visited += 1;
      if (visited > maxEntries) break;
      const childRelative =
        directory === "" ? dirent.name : `${directory}/${dirent.name}`;
      if (dirent.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(dirent.name)) queue.push(childRelative);
        continue;
      }
      if (!dirent.isFile()) continue;
      if (IGNORED_FILES.has(dirent.name)) continue;
      let info;
      try {
        info = await stat(join(root, childRelative));
      } catch {
        continue;
      }
      const window = windows.find(
        (item) => info.mtimeMs >= item.from && info.mtimeMs <= item.to,
      );
      if (window === undefined) continue;
      const updatedAt = new Date(info.mtimeMs).toISOString();
      const timestamp = Date.parse(updatedAt);
      const entry: TaskDocumentEntry = {
        id: `produced:${childRelative}`,
        kind: "produced",
        name: basename(childRelative),
        relativePath: childRelative,
        size: info.size,
        mimeType: mimeTypeFor(childRelative),
        updatedBy: window.actor,
        updatedAt,
        available: true,
      };
      const current = found.get(childRelative);
      if (current === undefined || Date.parse(current.updatedAt) < timestamp) {
        found.set(childRelative, entry);
      }
    }
  }
  return [...found.values()].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      left.name.localeCompare(right.name),
  );
}

export function windowsFromRuns(
  runs: readonly {
    readonly startedAt?: string | undefined;
    readonly endedAt?: string | undefined;
    readonly createdAt?: string | undefined;
    readonly actor: string;
  }[],
  fallbackActor: string,
  now: number,
): DocumentWindow[] {
  const windows: DocumentWindow[] = [];
  const sorted = runs
    .map((run) => ({
      start: Date.parse(run.startedAt ?? run.createdAt ?? ""),
      end: Date.parse(run.endedAt ?? ""),
      actor: run.actor,
    }))
    .filter((run) => !Number.isNaN(run.start))
    .sort((left, right) => left.start - right.start);
  sorted.forEach((run, index) => {
    const nextStart = sorted[index + 1]?.start;
    const ended = Number.isNaN(run.end) ? now : run.end + 5_000;
    windows.push({
      from: run.start - 5_000,
      // 子代理可能在父 run settle 之后才写完文件：窗口一直延伸到下一次运行开始
      // 或当前时刻，保证任务执行期间（含子代理）产出的文件不会漏。
      to: Math.max(ended, nextStart ?? now),
      actor: run.actor === "" ? fallbackActor : run.actor,
    });
  });
  return windows;
}

/** Uploaded attachments recorded on task messages, newest message first. */
export function attachmentDocuments(
  task: Pick<TaskRecord, "messages">,
  workspaceReady: boolean,
): TaskDocumentEntry[] {
  const documents: TaskDocumentEntry[] = [];
  for (const message of task.messages) {
    message.attachments.forEach((attachment, index) => {
      const storedPath = attachment.storedPath;
      documents.push({
        id: `uploaded:${message.id}:${index}`,
        kind: "uploaded",
        name: attachment.name,
        relativePath: storedPath ?? "",
        size: attachment.size ?? 0,
        mimeType: attachment.mimeType ?? mimeTypeFor(attachment.name),
        updatedBy: message.authorName,
        updatedAt: message.at,
        available: storedPath !== undefined && workspaceReady,
      });
    });
  }
  return documents;
}

/** Merges entries that point at the same file, keeping the newest one. */
export function mergeDocuments(
  documents: readonly TaskDocumentEntry[],
): TaskDocumentEntry[] {
  const merged = new Map<string, TaskDocumentEntry>();
  for (const document of documents) {
    const key =
      document.relativePath === "" ? document.id : document.relativePath;
    const current = merged.get(key);
    if (
      current === undefined ||
      Date.parse(current.updatedAt) <= Date.parse(document.updatedAt)
    ) {
      merged.set(key, document);
    }
  }
  return [...merged.values()].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      left.name.localeCompare(right.name),
  );
}
