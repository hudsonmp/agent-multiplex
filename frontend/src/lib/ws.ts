export type ServerMsg =
  | { type: "output"; paneId: string; data: string }
  | { type: "exit"; paneId: string; code: number };

export type ClientMsg =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

export function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

export function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export class PaneSocket {
  private ws?: WebSocket;
  private url: string;
  private backoff = 500;
  private closed = false;
  onMessage?: (m: ServerMsg) => void;
  onOpen?: () => void;
  onClose?: () => void;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 500;
      this.onOpen?.();
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMsg;
        this.onMessage?.(msg);
      } catch {
        // ignore malformed
      }
    };
    ws.onclose = () => {
      this.onClose?.();
      if (!this.closed) {
        setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 8000);
      }
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  sendInput(data: string): void {
    this.send({ type: "input", data: b64encode(data) });
  }

  sendResize(cols: number, rows: number): void {
    this.send({ type: "resize", cols, rows });
  }

  close(): void {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
  }
}
