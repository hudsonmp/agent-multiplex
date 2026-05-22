import { mkdir, writeFile, readFile, readdir, appendFile } from "node:fs/promises";
import { createWriteStream, WriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentId } from "./agents.js";

export const ROOT = join(homedir(), ".agent-multiplex", "sessions");

export type AgentRecord = {
  branch: string;
  worktree: string;
  exit_code?: number;
};

export type Manifest = {
  id: string;
  created_at: string;
  closed_at?: string;
  repo_path: string;
  base_branch: string;
  claude: AgentRecord;
  gemini: AgentRecord;
};

export async function ensureSessionDir(id: string): Promise<string> {
  const dir = join(ROOT, id);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeManifest(m: Manifest): Promise<void> {
  const dir = await ensureSessionDir(m.id);
  await writeFile(join(dir, "manifest.json"), JSON.stringify(m, null, 2));
}

export async function readManifest(id: string): Promise<Manifest> {
  const raw = await readFile(join(ROOT, id, "manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

export async function listManifests(): Promise<Manifest[]> {
  await mkdir(ROOT, { recursive: true });
  const ids = await readdir(ROOT);
  const out: Manifest[] = [];
  for (const id of ids) {
    try {
      out.push(await readManifest(id));
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

export class TimestampedLog {
  private stream: WriteStream;
  constructor(path: string) {
    this.stream = createWriteStream(path, { flags: "a" });
  }
  write(chunk: Buffer | string): void {
    const marker = `\x1e${Date.now()}\x1e`;
    this.stream.write(marker);
    this.stream.write(chunk);
  }
  close(): void {
    this.stream.end();
  }
}

export function logPath(id: string, agent: AgentId): string {
  return join(ROOT, id, `${agent}.log`);
}
