import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import { AGENT_IDS, type AgentId } from "./agents.js";
import { createSession, closeSession, getSession, listSessions } from "./sessions.js";
import { listBranches } from "./worktree.js";
import { resizePane, subscribe, writeInput } from "./pty.js";

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(websocket);

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/sessions", async () => await listSessions());

  app.get("/api/sessions/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    try {
      return await getSession(id);
    } catch (e) {
      reply.code(404);
      return { error: (e as Error).message };
    }
  });

  app.post("/api/sessions", async (req, reply) => {
    try {
      return await createSession(req.body as Parameters<typeof createSession>[0]);
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  app.delete("/api/sessions/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    try {
      return await closeSession(id);
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  app.get("/api/repos/branches", async (req, reply) => {
    const path = (req.query as { path?: string }).path;
    if (!path) {
      reply.code(400);
      return { error: "missing path" };
    }
    try {
      return await listBranches(path);
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  app.get("/ws/:id/:agent", { websocket: true }, (socket, req) => {
    const { id, agent } = req.params as { id: string; agent: string };
    if (!AGENT_IDS.includes(agent as AgentId)) {
      socket.close(1008, "invalid agent");
      return;
    }
    subscribe(id, agent as AgentId, socket);
    socket.on("message", (raw: Buffer) => {
      let msg: { type: string; data?: string; cols?: number; rows?: number };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "input" && typeof msg.data === "string") {
        const decoded = Buffer.from(msg.data, "base64").toString("utf8");
        writeInput(id, agent as AgentId, decoded);
      } else if (msg.type === "resize" && msg.cols && msg.rows) {
        resizePane(id, agent as AgentId, msg.cols, msg.rows);
      }
    });
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const distDir = join(here, "..", "..", "frontend", "dist");
  if (existsSync(distDir)) {
    await app.register(fastifyStatic, { root: distDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  return app;
}
