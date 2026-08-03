/**
 * Generate CRON_SECRET, SECURITY_INGEST_SECRET, SENTRY_INGEST_SECRET for ops —
 * never writes .env unless --write is passed explicitly.
 *
 * Usage:
 *   node scripts/generate-ops-secrets.mjs
 *   node scripts/generate-ops-secrets.mjs --write --env=apps/api/.env
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const envArg = process.argv.find((a) => a.startsWith("--env="));
const envPath = envArg
  ? resolve(root, envArg.slice("--env=".length))
  : resolve(root, "apps/api/.env");

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

const cron = secret();
const security = secret();
const sentry = secret();
const reputation = secret();
const equipment = secret();

console.log("HotelOS ops secrets (generated locally — copy to Vercel, do not commit):\n");
console.log(`CRON_SECRET=${cron}`);
console.log(`SECURITY_INGEST_SECRET=${security}`);
console.log(`SENTRY_INGEST_SECRET=${sentry}`);
console.log(`REPUTATION_INGEST_SECRET=${reputation}`);
console.log(`EQUIPMENT_INGEST_SECRET=${equipment}`);
console.log(`
Where to set:
  • Vercel → hotel-os-ai-api-<suffix> → Settings → Environment Variables → Production
  • Local: apps/api/.env (gitignored)

CRON_SECRET enables /v1/cron/* (Vercel Cron sends Authorization: Bearer …).
SECURITY_INGEST_SECRET enables POST /v1/public/security/ingest/:provider (VMS webhooks).
SENTRY_INGEST_SECRET enables POST /v1/public/sentry/ingest (Sentry → IT tasks).
REPUTATION_INGEST_SECRET enables POST /v1/public/reputation/ingest/:provider (OTA reviews).
EQUIPMENT_INGEST_SECRET enables POST /v1/public/equipment/ingest (sensor webhook stub).

After setting on Vercel, redeploy API once (respect Hobby rate-limit window).
Verify: pnpm check:vercel-api
`);

if (write) {
  if (!existsSync(envPath)) {
    console.error(`--write requested but ${envPath} does not exist.`);
    process.exit(1);
  }
  let text = readFileSync(envPath, "utf8");
  for (const [key, val] of [
    ["CRON_SECRET", cron],
    ["SECURITY_INGEST_SECRET", security],
    ["SENTRY_INGEST_SECRET", sentry],
    ["REPUTATION_INGEST_SECRET", reputation],
    ["EQUIPMENT_INGEST_SECRET", equipment],
  ]) {
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, `${key}=${val}`) : `${text.trimEnd()}\n${key}=${val}\n`;
  }
  writeFileSync(envPath, text, "utf8");
  console.log(`Updated ${envPath} (values not printed again).`);
} else {
  console.log("Dry run — no files modified. Pass --write to update the env file.");
}
