import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execa } from "execa";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

let app: FastifyInstance;
let repoRoot: string;
let repoPath: string;

before(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
  repoRoot = mkdtempSync(join(tmpdir(), "amux-test-"));
  repoPath = join(repoRoot, "testrepo");
  await execa("git", ["init", "-q", "-b", "main", repoPath]);
  await execa("bash", ["-c", "echo hello > README.md && git add -A && git -c user.email=t@t -c user.name=t commit -q -m init"], { cwd: repoPath });
});

after(async () => {
  if (app) await app.close();
  if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
});

test("POST /api/sessions creates worktrees and writes manifest", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: {
      repo_path: repoPath,
      base_branch: "main",
      claude_branch: "mux/c-test",
      gemini_branch: "mux/g-test",
    },
  });
  assert.equal(res.statusCode, 200);
  const m = res.json();
  assert.ok(m.id, "manifest has id");
  assert.equal(m.repo_path, repoPath);
  assert.equal(m.base_branch, "main");
  assert.equal(m.claude.branch, "mux/c-test");
  assert.equal(m.gemini.branch, "mux/g-test");
  assert.ok(existsSync(m.claude.worktree), "claude worktree exists on disk");
  assert.ok(existsSync(m.gemini.worktree), "gemini worktree exists on disk");

  const sessionDir = join(process.env.HOME!, ".agent-multiplex/sessions", m.id);
  assert.ok(existsSync(join(sessionDir, "manifest.json")), "manifest.json written");
  assert.ok(existsSync(join(sessionDir, "claude.log")), "claude.log written");
  assert.ok(existsSync(join(sessionDir, "gemini.log")), "gemini.log written");

  const wtList = await execa("git", ["-C", repoPath, "worktree", "list"]);
  assert.match(wtList.stdout, /mux-claude-/);
  assert.match(wtList.stdout, /mux-gemini-/);

  const del = await app.inject({ method: "DELETE", url: `/api/sessions/${m.id}` });
  assert.equal(del.statusCode, 200);
  const closed = del.json();
  assert.ok(closed.closed_at, "closed_at is set");
  assert.equal(closed.claude.branch, "mux/c-test");

  const wtAfter = await execa("git", ["-C", repoPath, "worktree", "list"]);
  assert.doesNotMatch(wtAfter.stdout, /mux-claude-/);
  assert.doesNotMatch(wtAfter.stdout, /mux-gemini-/);
  assert.ok(existsSync(join(sessionDir, "claude.log")), "log preserved after close");
});

test("POST /api/sessions rejects invalid branch names", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: {
      repo_path: repoPath,
      base_branch: "main",
      claude_branch: "../escape",
      gemini_branch: "mux/g",
    },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /invalid branch/);
});

test("POST /api/sessions rejects non-git path", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: {
      repo_path: "/tmp/definitely-not-a-repo-amux",
      base_branch: "main",
      claude_branch: "mux/c",
      gemini_branch: "mux/g",
    },
  });
  assert.equal(res.statusCode, 400);
});

test("POST /api/sessions rejects identical branches", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: {
      repo_path: repoPath,
      base_branch: "main",
      claude_branch: "mux/same",
      gemini_branch: "mux/same",
    },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /differ/);
});

test("GET /api/sessions/:id 404s for unknown id", async () => {
  const res = await app.inject({ method: "GET", url: "/api/sessions/nonexistent-id" });
  assert.equal(res.statusCode, 404);
});

test("GET /api/repos/branches lists local branches", async () => {
  const res = await app.inject({ method: "GET", url: `/api/repos/branches?path=${encodeURIComponent(repoPath)}` });
  assert.equal(res.statusCode, 200);
  const branches = res.json() as string[];
  assert.ok(branches.includes("main"), "main branch returned");
});

test("GET /api/health returns ok", async () => {
  const res = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
});
