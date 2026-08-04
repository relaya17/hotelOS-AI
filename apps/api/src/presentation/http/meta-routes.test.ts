import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMetaRoutes } from "./meta-routes.js";
import { OPENAPI_SPEC, resolveOpenApiYaml } from "./openapi-spec.js";

describe("meta OpenAPI routes", () => {
  it("serves JSON with openapi version and paths", async () => {
    const app = createMetaRoutes();
    const res = await app.request("/openapi.json");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as typeof OPENAPI_SPEC;
    assert.equal(body.openapi, "3.1.0");
    assert.ok(body.paths["/v1/guests/by-email"]);
    assert.ok(body.paths["/v1/leads"]);
    assert.ok(body.paths["/v1/twin/hotels/{hotelId}"]);
    assert.ok(body.paths["/v1/ops/forecast"]);
    assert.ok(body.paths["/v1/streams/ops-dashboard"]);
  });

  it("serves YAML from docs or embed", async () => {
    const yaml = resolveOpenApiYaml();
    assert.match(yaml, /^openapi: 3\.1\.0/);
    assert.match(yaml, /\/v1\/meta\/openapi\.json/);

    const app = createMetaRoutes();
    const res = await app.request("/openapi.yaml");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /yaml/);
    const body = await res.text();
    assert.match(body, /^openapi: 3\.1\.0/);
  });
});
