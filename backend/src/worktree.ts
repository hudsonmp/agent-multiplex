import { execa } from "execa";
import { stat } from "node:fs/promises";
import { join, basename, dirname } from "node:path";

const BRANCH_RE = /^[a-zA-Z0-9._\/-]+$/;

export function validateBranch(name: string): void {
  if (!BRANCH_RE.test(name) || name.includes("..") || name.startsWith("/") || name.endsWith("/")) {
    throw new Error(`invalid branch name: ${name}`);
  }
}

export async function assertGitRepo(path: string): Promise<void> {
  try {
    const s = await stat(path);
    if (!s.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error(`path does not exist: ${path}`);
  }
  await execa("git", ["-C", path, "rev-parse", "--git-dir"]);
}

export async function listBranches(repoPath: string): Promise<string[]> {
  await assertGitRepo(repoPath);
  const { stdout } = await execa("git", [
    "-C",
    repoPath,
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ]);
  return stdout.split("\n").filter(Boolean);
}

export function worktreePath(repoPath: string, agent: string, shortId: string): string {
  const repoName = basename(repoPath);
  return join(dirname(repoPath), `${repoName}-mux-${agent}-${shortId}`);
}

export async function addWorktree(
  repoPath: string,
  worktree: string,
  branch: string,
  baseBranch: string,
): Promise<void> {
  validateBranch(branch);
  validateBranch(baseBranch);
  await execa("git", ["-C", repoPath, "worktree", "add", "-b", branch, worktree, baseBranch]);
}

export async function removeWorktree(repoPath: string, worktree: string): Promise<void> {
  try {
    await execa("git", ["-C", repoPath, "worktree", "remove", "--force", worktree]);
  } catch {
    // best-effort
  }
}
