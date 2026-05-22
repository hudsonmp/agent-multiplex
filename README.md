# agent-multiplex

Live web view for driving **Claude Code** and **gemini-cli** side-by-side in parallel git worktrees on the same repo. Watch both agents work the same task, interject in either one, and replay raw transcripts later.

## Requirements

- Node.js 20+ (native `node-pty` requires `node-gyp`; on macOS run `xcode-select --install`).
- `claude` and `gemini` on `PATH`. Install gemini-cli with `npm i -g @google/gemini-cli`.
- A git repo to point sessions at.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Architecture

- `backend/` — Fastify + `node-pty` + `ws`. Creates a git worktree per agent per session, spawns one PTY per worktree, multiplexes stdio over websockets.
- `frontend/` — Vite + React + `xterm.js`. Split-pane terminals talk to the backend over WS.

Sessions are persisted under `~/.agent-multiplex/sessions/<id>/`:

```
manifest.json   { id, created_at, closed_at?, repo_path, base_branch,
                  claude: { branch, worktree, exit_code? }, gemini: { ... } }
claude.log      raw PTY bytes, prefixed by \x1e<unix_ms>\x1e markers
gemini.log
```

To strip timestamps for a clean replay:

```bash
cat ~/.agent-multiplex/sessions/<id>/claude.log | perl -pe 's/\x1e\d+\x1e//g'
```

## Security note

The server binds to `127.0.0.1` only. There is no authentication. Do not expose to a network you do not control.
