// Vercel serverless entrypoint. This file lives outside `src/` (which is the
// tsc build root for the long-running `pnpm dev` / `node dist/main.js`
// setup) — Vercel's Node.js builder compiles files under `api/` on its own,
// it does not go through `tsc -p tsconfig.json`.
//
// Requires NODEJS_HELPERS=0 in the Vercel project's environment variables
// (see https://hono.dev/docs/getting-started/vercel) so Vercel doesn't wrap
// the request/response in its own Node helpers before Hono sees them.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { composeApp } from "../src/infrastructure/compose.js";

const appPromise = composeApp();
let cachedHandler: ReturnType<typeof handle> | undefined;

// Reused across warm invocations of the same function instance; each cold
// start pays for one DB connection + schema migration.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!cachedHandler) {
    const { app } = await appPromise;
    cachedHandler = handle(app);
  }
  return cachedHandler(req, res);
}
