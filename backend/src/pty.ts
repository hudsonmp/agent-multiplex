import * as pty from "node-pty";
import { homedir } from "node:os";
import { join } from "node:path";
import type { WebSocket } from "ws";
import { AGENTS, type AgentId } from "./agents.js";
import { TimestampedLog, logPath } from "./storage.js";

function userPath(): string {
  const extra = [
    join(homedir(), ".local", "bin"),
    join(homedir(), "bin"),
    join(homedir(), ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  const seen = new Set<string>();
  const parts = [...(process.env.PATH ?? "").split(":"), ...extra].filter((p) => {
    if (!p || seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  return parts.join(":");
}

export type Pane = {
  sessionId: string;
  agent: AgentId;
  proc: pty.IPty | null;
  log: TimestampedLog;
  subscribers: Set<WebSocket>;
  exitCode?: number;
  cols: number;
  rows: number;
};

const panes = new Map<string, Pane>();

const key = (sessionId: string, agent: AgentId) => `${sessionId}:${agent}`;

export function spawnPane(sessionId: string, agent: AgentId, cwd: string): Pane {
  const a = AGENTS[agent];
  const log = new TimestampedLog(logPath(sessionId, agent));

  let proc: pty.IPty | null = null;
  let spawnError: Error | null = null;
  try {
    proc = pty.spawn(a.command, a.args, {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      cwd,
      env: { ...(process.env as { [key: string]: string }), PATH: userPath() },
    });
  } catch (e) {
    spawnError = e as Error;
  }

  const pane: Pane = {
    sessionId,
    agent,
    proc,
    log,
    subscribers: new Set(),
    cols: 120,
    rows: 32,
  };

  const broadcast = (payload: string) => {
    for (const ws of pane.subscribers) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  };

  if (spawnError) {
    pane.exitCode = 127;
    const message =
      `\x1b[31m[agent-multiplex] failed to start \`${a.command}\`: ${spawnError.message}\x1b[0m\r\n` +
      `\x1b[2mIs the binary on PATH? Try \`which ${a.command}\` in a terminal.\x1b[0m\r\n`;
    log.write(message);
    setTimeout(() => {
      broadcast(
        JSON.stringify({
          type: "output",
          paneId: agent,
          data: Buffer.from(message, "utf8").toString("base64"),
        }),
      );
      broadcast(JSON.stringify({ type: "exit", paneId: agent, code: 127 }));
      log.close();
    }, 50);
  } else {
    proc!.onData((data: string) => {
      log.write(data);
      broadcast(
        JSON.stringify({
          type: "output",
          paneId: agent,
          data: Buffer.from(data, "utf8").toString("base64"),
        }),
      );
    });
    proc!.onExit(({ exitCode }) => {
      pane.exitCode = exitCode;
      broadcast(JSON.stringify({ type: "exit", paneId: agent, code: exitCode }));
      log.close();
    });
  }

  panes.set(key(sessionId, agent), pane);
  return pane;
}

export function getPane(sessionId: string, agent: AgentId): Pane | undefined {
  return panes.get(key(sessionId, agent));
}

export function getSessionPanes(sessionId: string): Pane[] {
  const out: Pane[] = [];
  for (const [k, v] of panes) {
    if (k.startsWith(`${sessionId}:`)) out.push(v);
  }
  return out;
}

export function killPane(sessionId: string, agent: AgentId): void {
  const pane = getPane(sessionId, agent);
  if (!pane || !pane.proc) return;
  try {
    pane.proc.kill();
  } catch {
    // already dead
  }
}

export function writeInput(sessionId: string, agent: AgentId, data: string): void {
  const pane = getPane(sessionId, agent);
  if (!pane || !pane.proc) return;
  pane.proc.write(data);
}

export function resizePane(sessionId: string, agent: AgentId, cols: number, rows: number): void {
  const pane = getPane(sessionId, agent);
  if (!pane) return;
  pane.cols = cols;
  pane.rows = rows;
  if (!pane.proc) return;
  try {
    pane.proc.resize(cols, rows);
  } catch {
    // process may be dead
  }
}

export function subscribe(sessionId: string, agent: AgentId, ws: WebSocket): void {
  const pane = getPane(sessionId, agent);
  if (!pane) return;
  pane.subscribers.add(ws);
  ws.on("close", () => pane.subscribers.delete(ws));
}
