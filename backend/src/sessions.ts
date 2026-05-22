import { nanoid } from "nanoid";
import { AGENT_IDS } from "./agents.js";
import {
  addWorktree,
  assertGitRepo,
  removeWorktree,
  validateBranch,
  worktreePath,
} from "./worktree.js";
import {
  ensureSessionDir,
  listManifests,
  readManifest,
  writeManifest,
  type Manifest,
} from "./storage.js";
import { getSessionPanes, killPane, spawnPane } from "./pty.js";

export type CreateSessionInput = {
  repo_path: string;
  base_branch: string;
  claude_branch: string;
  gemini_branch: string;
};

export async function createSession(input: CreateSessionInput): Promise<Manifest> {
  await assertGitRepo(input.repo_path);
  validateBranch(input.base_branch);
  validateBranch(input.claude_branch);
  validateBranch(input.gemini_branch);
  if (input.claude_branch === input.gemini_branch) {
    throw new Error("agent branches must differ");
  }

  const id = nanoid(10);
  const shortId = id.slice(0, 8);
  await ensureSessionDir(id);

  const claudeWt = worktreePath(input.repo_path, "claude", shortId);
  const geminiWt = worktreePath(input.repo_path, "gemini", shortId);

  await addWorktree(input.repo_path, claudeWt, input.claude_branch, input.base_branch);
  try {
    await addWorktree(input.repo_path, geminiWt, input.gemini_branch, input.base_branch);
  } catch (e) {
    await removeWorktree(input.repo_path, claudeWt);
    throw e;
  }

  const manifest: Manifest = {
    id,
    created_at: new Date().toISOString(),
    repo_path: input.repo_path,
    base_branch: input.base_branch,
    claude: { branch: input.claude_branch, worktree: claudeWt },
    gemini: { branch: input.gemini_branch, worktree: geminiWt },
  };
  await writeManifest(manifest);

  spawnPane(id, "claude", claudeWt);
  spawnPane(id, "gemini", geminiWt);

  return manifest;
}

export async function closeSession(id: string): Promise<Manifest> {
  const manifest = await readManifest(id);
  if (manifest.closed_at) return manifest;
  for (const agent of AGENT_IDS) {
    killPane(id, agent);
  }
  const panes = getSessionPanes(id);
  for (const pane of panes) {
    if (pane.exitCode !== undefined) {
      manifest[pane.agent].exit_code = pane.exitCode;
    }
  }
  await removeWorktree(manifest.repo_path, manifest.claude.worktree);
  await removeWorktree(manifest.repo_path, manifest.gemini.worktree);
  manifest.closed_at = new Date().toISOString();
  await writeManifest(manifest);
  return manifest;
}

export async function listSessions(): Promise<Manifest[]> {
  return listManifests();
}

export async function getSession(id: string): Promise<Manifest> {
  return readManifest(id);
}
