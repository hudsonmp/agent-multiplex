import { buildApp } from "./app.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4040);

const app = await buildApp({ logger: true });

app.listen({ host: HOST, port: PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
