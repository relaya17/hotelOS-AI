import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, "apps/api/.env") });
config({ path: resolve(root, ".env"), override: false });

const url = process.env.DATABASE_URL ?? "";
const authToken = process.env.DATABASE_AUTH_TOKEN ?? "";
if (!url.startsWith("libsql://") || authToken.length < 20) {
  console.error("Bad DATABASE_URL / DATABASE_AUTH_TOKEN in apps/api/.env");
  process.exit(1);
}

const client = createClient({ url, authToken });
const result = await client.execute("select 1 as ok");
console.log("turso_ok", result.rows[0]);
