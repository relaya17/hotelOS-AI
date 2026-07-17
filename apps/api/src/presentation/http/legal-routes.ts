import { Hono } from "hono";
import { getLegalDocument, LEGAL_DOCUMENTS } from "@hotelos/legal";
import { sendError } from "./errors.js";

export function createLegalRoutes(): Hono {
  const routes = new Hono();

  routes.get("/", (c) =>
    c.json({
      data: LEGAL_DOCUMENTS.map((doc) => ({
        id: doc.id,
        titleHe: doc.titleHe,
        titleEn: doc.titleEn,
        version: doc.version,
        updatedAt: doc.updatedAt,
      })),
    }),
  );

  routes.get("/:id", (c) => {
    const doc = getLegalDocument(c.req.param("id"));
    if (!doc) {
      return sendError(c, 404, "NOT_FOUND", "Legal document not found");
    }
    return c.json({ data: doc });
  });

  return routes;
}
