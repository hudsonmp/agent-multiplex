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

export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "";

function url(path: string): string {
  return BACKEND_URL + path;
}

export function backendWsUrl(path: string): string {
  if (BACKEND_URL) {
    return BACKEND_URL.replace(/^http/, "ws") + path;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(input), {
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
  health: () => fetchJson<{ ok: boolean }>("/api/health"),
  listSessions: () => fetchJson<Manifest[]>("/api/sessions"),
  getSession: (id: string) => fetchJson<Manifest>(`/api/sessions/${id}`),
  createSession: (body: {
    repo_path: string;
    base_branch: string;
    claude_branch: string;
    gemini_branch: string;
    anthropic_api_key?: string;
    gemini_api_key?: string;
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
