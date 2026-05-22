import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT ?? 3000);

const root = dirname(fileURLToPath(import.meta.url));
const appDir = join(root, "..", "frontend", "dist");
const docsDir = join(root, "..", "docs");

if (!existsSync(appDir)) {
  console.error(`frontend build not found at ${appDir}`);
  console.error("run `npm run build -w frontend` before starting site.");
  process.exit(1);
}

const app = Fastify({ logger: true });

await app.register(fastifyStatic, {
  root: docsDir,
  prefix: "/setup",
  decorateReply: false,
});

await app.register(fastifyStatic, {
  root: appDir,
});

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith("/setup")) {
    reply.code(404).send("not found");
    return;
  }
  reply.sendFile("index.html");
});

app.listen({ host: HOST, port: PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
