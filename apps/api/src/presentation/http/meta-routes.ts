import { Hono } from "hono";
import { OPENAPI_SPEC, resolveOpenApiYaml } from "./openapi-spec.js";

export function createMetaRoutes(): Hono {
  const routes = new Hono();

  routes.get("/openapi.yaml", (c) =>
    c.body(resolveOpenApiYaml(), 200, {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    }),
  );

  routes.get("/openapi.json", (c) =>
    c.json(OPENAPI_SPEC, 200, {
      "Cache-Control": "public, max-age=300",
    }),
  );

  return routes;
}
