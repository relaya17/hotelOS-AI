import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, "apps/api/.env") });
config({ path: resolve(root, ".env"), override: false });

process.chdir(resolve(root, "apps/api"));
const { composeApp } = await import(
  pathToFileURL(resolve(root, "apps/api/src/infrastructure/compose.ts")).href
);
const { logger } = await composeApp();
logger.info("Turso migrate+seed complete");
