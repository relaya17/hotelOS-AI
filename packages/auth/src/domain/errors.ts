export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TENANT_ISOLATION_VIOLATION"
  | "INVALID_TOKEN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
