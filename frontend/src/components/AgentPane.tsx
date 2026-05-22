import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { PaneSocket, b64decode } from "../lib/ws";

type Props = {
  sessionId: string;
  agent: "claude" | "gemini";
  worktree: string;
  branch: string;
};

export function AgentPane({ sessionId, agent, worktree, branch }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "exited">("connecting");
  const [exitCode, setExitCode] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "#000000",
        foreground: "#d7dbe1",
        cursor: "#7aa2f7",
      },
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const sock = new PaneSocket(`${proto}//${location.host}/ws/${sessionId}/${agent}`);

    sock.onOpen = () => {
      setStatus("open");
      sock.sendResize(term.cols, term.rows);
    };
    sock.onClose = () => setStatus("closed");
    sock.onMessage = (m) => {
      if (m.type === "output") {
        term.write(b64decode(m.data));
      } else if (m.type === "exit") {
        setStatus("exited");
        setExitCode(m.code);
      }
    };
    sock.connect();

    const dispose = term.onData((data) => sock.sendInput(data));

    const onResize = () => {
      fit.fit();
      sock.sendResize(term.cols, term.rows);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      ro.disconnect();
      dispose.dispose();
      sock.close();
      term.dispose();
    };
  }, [sessionId, agent]);

  return (
    <div className="pane">
      <div className="pane-header">
        <span>
          <span className="agent">{agent}</span> · {branch}{" "}
          <span style={{ color: "var(--muted)" }}>· {worktree}</span>
        </span>
        <span>
          {status === "open" && "● live"}
          {status === "connecting" && "○ connecting"}
          {status === "closed" && "○ disconnected"}
          {status === "exited" && `× exited (${exitCode})`}
        </span>
      </div>
      <div className="pane-body">
        <div ref={hostRef} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
