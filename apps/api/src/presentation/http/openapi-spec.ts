import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import embed from "./openapi-spec.embed.json" with { type: "json" };

/** Embedded OpenAPI 3.1 document (synced from docs/openapi/hotelos-v1.openapi.yaml). */
export const OPENAPI_SPEC = embed;

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const yamlPath = join(repoRoot, "docs/openapi/hotelos-v1.openapi.yaml");
const yamlEmbedPath = join(here, "openapi-spec.embed.yaml");

let cachedYaml: string | undefined;

/** Resolve YAML from repo docs path when available; fall back to bundled embed. */
export function resolveOpenApiYaml(): string {
  if (cachedYaml !== undefined) {
    return cachedYaml;
  }
  for (const candidate of [yamlPath, yamlEmbedPath]) {
    try {
      cachedYaml = readFileSync(candidate, "utf8");
      return cachedYaml;
    } catch {
      // try next
    }
  }
  throw new Error("OpenAPI YAML not found");
}
