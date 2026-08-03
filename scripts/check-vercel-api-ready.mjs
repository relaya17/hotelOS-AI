/**
 * Preflight for hotel-os-ai-api Vercel deploy — never prints secret values.
 *
 * Usage (repo root):
 *   node scripts/check-vercel-api-ready.mjs
 *   node scripts/check-vercel-api-ready.mjs --env apps/api/.env
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "packages/database/package.json"));
const { config } = require("dotenv");
const { createClient } = require("@libsql/client");

const envArg = process.argv.find((a) => a.startsWith("--env="));
const envPath = envArg
  ? resolve(root, envArg.slice("--env=".length))
  : existsSync(resolve(root, "apps/api/.env"))
    ? resolve(root, "apps/api/.env")
    : resolve(root, ".env");

config({ path: envPath });
if (envPath.endsWith("apps/api/.env") && existsSync(resolve(root, ".env"))) {
  config({ path: resolve(root, ".env"), override: false });
}

const checks = [];
function ok(name, pass, detail = "") {
  checks.push({ name, pass, detail });
}

const url = process.env.DATABASE_URL?.trim() ?? "";
const token = process.env.DATABASE_AUTH_TOKEN?.trim() ?? "";
const jwtA = process.env.JWT_ACCESS_SECRET?.trim() ?? "";
const jwtR = process.env.JWT_REFRESH_SECRET?.trim() ?? "";
const helpers = process.env.NODEJS_HELPERS?.trim() ?? "";
const cors = process.env.CORS_ORIGINS?.trim() ?? "";
const security = process.env.SECURITY_INGEST_SECRET?.trim() ?? "";
const cron = process.env.CRON_SECRET?.trim() ?? "";

ok("DATABASE_URL is libsql:// (Turso)", url.startsWith("libsql://"), url.slice(0, 28) + "…");
ok("DATABASE_AUTH_TOKEN present", token.length >= 20, `len=${token.length}`);
ok("JWT_ACCESS_SECRET ≥16", jwtA.length >= 16, `len=${jwtA.length}`);
ok("JWT_REFRESH_SECRET ≥16", jwtR.length >= 16, `len=${jwtR.length}`);
ok("NODEJS_HELPERS=0", helpers === "0", `value=${helpers || "(empty)"}`);
ok("CORS_ORIGINS set", cors.length > 0, cors.includes("vercel.app") ? "includes vercel.app" : "no vercel.app wildcard");
ok(
  "SECURITY_INGEST_SECRET (VMS public webhook)",
  security.length >= 16 || process.env.NODE_ENV !== "production",
  security.length ? `len=${security.length}` : "empty — set before prod VMS",
);
ok("CRON_SECRET (optional but recommended)", true, cron.length ? `len=${cron.length}` : "empty — crons return 503");

let tursoOk = false;
if (url.startsWith("libsql://") && token.length >= 20) {
  try {
    const client = createClient({ url, authToken: token });
    const result = await client.execute("select 1 as ok");
    tursoOk = Number(result.rows[0]?.ok ?? 0) === 1;
  } catch (error) {
    ok("Turso connectivity", false, error instanceof Error ? error.message : String(error));
  }
}
if (tursoOk) ok("Turso connectivity", true, "select 1 ok");

console.log(`Env file: ${envPath}`);
for (const row of checks) {
  console.log(`${row.pass ? "✔" : "✖"} ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
}

const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed. Fix before redeploying hotel-os-ai-api-eight.`);
  process.exit(1);
}
console.log("\nReady for Vercel API env (still need dashboard sync + rate-limit window).");
console.log("Set these on Vercel project hotel-os-ai-api-eight (Production):");
console.log("  DATABASE_URL, DATABASE_AUTH_TOKEN, JWT_*, NODEJS_HELPERS=0, CORS_ORIGINS");
console.log("  SECURITY_INGEST_SECRET, CRON_SECRET (recommended)");
process.exit(0);
