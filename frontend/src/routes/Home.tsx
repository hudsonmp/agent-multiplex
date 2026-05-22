import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, BACKEND_URL, type Manifest } from "../lib/api";

function defaultBranchName(agent: "claude" | "gemini"): string {
  const iso = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  return `mux/${agent}-${iso}`;
}

function loadStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

type BackendStatus = "checking" | "online" | "offline";

export function Home() {
  const nav = useNavigate();
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [sessions, setSessions] = useState<Manifest[]>([]);
  const [repoInput, setRepoInput] = useState(() => loadStored("amux:repo"));
  const [branches, setBranches] = useState<string[]>([]);
  const [baseBranch, setBaseBranch] = useState("");
  const [claudeBranch, setClaudeBranch] = useState(defaultBranchName("claude"));
  const [geminiBranch, setGeminiBranch] = useState(defaultBranchName("gemini"));
  const [anthropicKey, setAnthropicKey] = useState(() => loadStored("amux:anthropic_key"));
  const [geminiKey, setGeminiKey] = useState(() => loadStored("amux:gemini_key"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealKeys, setRevealKeys] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await api.health();
        if (!cancelled) {
          setStatus("online");
          api.listSessions().then(setSessions).catch(() => setSessions([]));
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    ping();
    const t = setInterval(ping, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const loadBranches = async () => {
    setError(null);
    try {
      const list = await api.listBranches(repoInput);
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
    store("amux:repo", repoInput);
    store("amux:anthropic_key", anthropicKey);
    store("amux:gemini_key", geminiKey);
    try {
      const m = await api.createSession({
        repo_path: repoInput,
        base_branch: baseBranch || "main",
        claude_branch: claudeBranch,
        gemini_branch: geminiBranch,
        anthropic_api_key: anthropicKey || undefined,
        gemini_api_key: geminiKey || undefined,
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
      const next = await api.listSessions();
      setSessions(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="home">
      <h1>agent-multiplex</h1>

      <div className={`status status-${status}`}>
        {status === "checking" && "looking for local backend…"}
        {status === "online" && (
          <>
            <span className="dot" /> backend online {BACKEND_URL && <code>· {BACKEND_URL}</code>}
          </>
        )}
        {status === "offline" && (
          <>
            <span className="dot" /> backend not running. Start it locally:{" "}
            <code>git clone github.com/hudsonmp/agent-multiplex && cd agent-multiplex && npm install && npm run dev</code>
          </>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <h2>new session</h2>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>repo</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="/Users/you/your-repo  or  https://github.com/foo/bar"
              required
            />
            <button type="button" onClick={loadBranches} disabled={!repoInput}>
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

        <div className="keys-header">
          <span>API keys (optional — falls back to env / saved auth)</span>
          <button
            type="button"
            className="link"
            onClick={() => setRevealKeys((r) => !r)}
          >
            {revealKeys ? "hide" : "show"}
          </button>
        </div>
        <div className="field">
          <label>ANTHROPIC_API_KEY</label>
          <input
            type={revealKeys ? "text" : "password"}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label>GEMINI_API_KEY</label>
          <input
            type={revealKeys ? "text" : "password"}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
          />
        </div>
        <div className="hint">
          Keys are stored in your browser's localStorage and sent only to your local backend. Nothing is uploaded.
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button type="submit" disabled={busy || status !== "online"}>
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
