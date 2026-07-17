import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { composeApp } from "./infrastructure/compose.js";

const apiRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const repoRoot = resolve(apiRoot, "../..");
// Prefer apps/api/.env (server folder); fall back to monorepo root .env.
loadDotenv({ path: resolve(apiRoot, ".env") });
loadDotenv({ path: resolve(repoRoot, ".env"), override: false });

const { app, env, logger } = await composeApp();

serve(
  {
    fetch: app.fetch,
    port: env.API_PORT,
  },
  (info) => {
    logger.info("API listening", { port: info.port });
  },
);
