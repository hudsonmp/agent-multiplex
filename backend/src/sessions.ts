import { nanoid } from "nanoid";
import { AGENT_IDS } from "./agents.js";
import {
  addWorktree,
  assertGitRepo,
  cloneIfNeeded,
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
  anthropic_api_key?: string;
  gemini_api_key?: string;
};

export async function createSession(input: CreateSessionInput): Promise<Manifest> {
  const resolvedRepo = await cloneIfNeeded(input.repo_path);
  await assertGitRepo(resolvedRepo);
  validateBranch(input.base_branch);
  validateBranch(input.claude_branch);
  validateBranch(input.gemini_branch);
  if (input.claude_branch === input.gemini_branch) {
    throw new Error("agent branches must differ");
  }

  const id = nanoid(10);
  const shortId = id.slice(0, 8);
  await ensureSessionDir(id);

  const claudeWt = worktreePath(resolvedRepo, "claude", shortId);
  const geminiWt = worktreePath(resolvedRepo, "gemini", shortId);

  await addWorktree(resolvedRepo, claudeWt, input.claude_branch, input.base_branch);
  try {
    await addWorktree(resolvedRepo, geminiWt, input.gemini_branch, input.base_branch);
  } catch (e) {
    await removeWorktree(resolvedRepo, claudeWt);
    throw e;
  }

  const manifest: Manifest = {
    id,
    created_at: new Date().toISOString(),
    repo_path: resolvedRepo,
    base_branch: input.base_branch,
    claude: { branch: input.claude_branch, worktree: claudeWt },
    gemini: { branch: input.gemini_branch, worktree: geminiWt },
  };
  await writeManifest(manifest);

  spawnPane(id, "claude", claudeWt, input.anthropic_api_key);
  spawnPane(id, "gemini", geminiWt, input.gemini_api_key);

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
