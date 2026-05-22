import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Manifest } from "../lib/api";

function defaultBranchName(agent: "claude" | "gemini"): string {
  const iso = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  return `mux/${agent}-${iso}`;
}

export function Home() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState<Manifest[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [baseBranch, setBaseBranch] = useState("");
  const [claudeBranch, setClaudeBranch] = useState(defaultBranchName("claude"));
  const [geminiBranch, setGeminiBranch] = useState(defaultBranchName("gemini"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => api.listSessions().then(setSessions).catch(() => setSessions([]));

  useEffect(() => {
    refresh();
  }, []);

  const loadBranches = async () => {
    setError(null);
    try {
      const list = await api.listBranches(repoPath);
      setBranches(list);
      if (list.length > 0 && !baseBranch) setBaseBranch(list[0]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const m = await api.createSession({
        repo_path: repoPath,
        base_branch: baseBranch,
        claude_branch: claudeBranch,
        gemini_branch: geminiBranch,
      });
      nav(`/sessions/${m.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = async (id: string) => {
    try {
      await api.closeSession(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="home">
      <h1>agent-multiplex</h1>

      {error && <div className="error">{error}</div>}

      <h2>new session</h2>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>repo path</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/you/your-repo"
              required
            />
            <button type="button" onClick={loadBranches} disabled={!repoPath}>
              load branches
            </button>
          </div>
        </div>
        <div className="field">
          <label>base branch</label>
          {branches.length > 0 ? (
            <select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} required>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              placeholder="main"
              required
            />
          )}
        </div>
        <div className="field">
          <label>claude branch</label>
          <input value={claudeBranch} onChange={(e) => setClaudeBranch(e.target.value)} required />
        </div>
        <div className="field">
          <label>gemini branch</label>
          <input value={geminiBranch} onChange={(e) => setGeminiBranch(e.target.value)} required />
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <button type="submit" disabled={busy}>
            {busy ? "launching…" : "launch session"}
          </button>
        </div>
      </form>

      <h2>sessions</h2>
      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12 }}>
            none yet
          </div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className={`session-row ${s.closed_at ? "closed" : ""}`}>
            <div>
              <a href={`/sessions/${s.id}`}>{s.id}</a>{" "}
              <span className="meta">
                · {s.repo_path} · base {s.base_branch}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="meta">{new Date(s.created_at).toLocaleString()}</span>
              {!s.closed_at && (
                <button className="danger" type="button" onClick={() => close(s.id)}>
                  close
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
