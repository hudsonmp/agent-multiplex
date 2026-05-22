export type AgentRecord = { branch: string; worktree: string; exit_code?: number };
export type Manifest = {
  id: string;
  created_at: string;
  closed_at?: string;
  repo_path: string;
  base_branch: string;
  claude: AgentRecord;
  gemini: AgentRecord;
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listSessions: () => fetchJson<Manifest[]>("/api/sessions"),
  getSession: (id: string) => fetchJson<Manifest>(`/api/sessions/${id}`),
  createSession: (body: {
    repo_path: string;
    base_branch: string;
    claude_branch: string;
    gemini_branch: string;
  }) =>
    fetchJson<Manifest>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  closeSession: (id: string) =>
    fetchJson<Manifest>(`/api/sessions/${id}`, { method: "DELETE" }),
  listBranches: (path: string) =>
    fetchJson<string[]>(`/api/repos/branches?path=${encodeURIComponent(path)}`),
};
