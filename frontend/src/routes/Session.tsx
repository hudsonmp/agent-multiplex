import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { api, type Manifest } from "../lib/api";
import { AgentPane } from "../components/AgentPane";

export function Session() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getSession(id).then(setManifest).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) {
    return (
      <div className="home">
        <div className="error">{error}</div>
        <a href="/">← back</a>
      </div>
    );
  }
  if (!manifest || !id) return null;

  const close = async () => {
    try {
      await api.closeSession(id);
      nav("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="session-view">
      <div className="session-header">
        <span>
          <a href="/">←</a> <span className="id">{manifest.id}</span> · {manifest.repo_path} ·
          base <code>{manifest.base_branch}</code>
        </span>
        <span>
          {manifest.closed_at ? (
            <span style={{ color: "var(--muted)" }}>closed {new Date(manifest.closed_at).toLocaleTimeString()}</span>
          ) : (
            <button className="danger" type="button" onClick={close}>
              close session
            </button>
          )}
        </span>
      </div>
      <PanelGroup direction="horizontal" autoSaveId="agent-multiplex-split">
        <Panel defaultSize={50} minSize={20}>
          <AgentPane
            sessionId={manifest.id}
            agent="claude"
            worktree={manifest.claude.worktree}
            branch={manifest.claude.branch}
          />
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={50} minSize={20}>
          <AgentPane
            sessionId={manifest.id}
            agent="gemini"
            worktree={manifest.gemini.worktree}
            branch={manifest.gemini.branch}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
