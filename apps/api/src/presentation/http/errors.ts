import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AuthError } from "@hotelos/auth";
import { ZodError } from "@hotelos/validation";

export type ApiErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
    readonly correlationId: string;
  };
};

export function sendError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  const correlationId =
    c.res.headers.get("x-correlation-id") ??
    c.req.header("x-correlation-id") ??
    "unknown";

  const body: ApiErrorBody = {
    error: {
      code,
      message,
      details,
      correlationId,
    },
  };
  return c.json(body, status as ContentfulStatusCode);
}

export function mapUnknownError(c: Context, error: unknown) {
  if (error instanceof AuthError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code === "INVALID_TOKEN" || error.code === "UNAUTHORIZED"
          ? 401
          : 400;
    return sendError(c, status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return sendError(c, 400, "VALIDATION_ERROR", "Request validation failed", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return sendError(c, 500, "INTERNAL_ERROR", "Unexpected server error");
}
