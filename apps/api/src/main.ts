import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { composeApp } from "./infrastructure/compose.js";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
loadDotenv({ path: resolve(repoRoot, ".env") });

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
