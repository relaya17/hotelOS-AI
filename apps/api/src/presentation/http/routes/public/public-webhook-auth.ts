type HeaderContext = {
  req: { header: (name: string) => string | undefined };
};

export function pmsInboundAuthorized(
  c: HeaderContext,
  secret: string | undefined,
): boolean {
  const expected = secret?.trim();
  if (!expected) return true;
  const bearer = c.req.header("authorization");
  const token =
    bearer?.toLowerCase().startsWith("bearer ")
      ? bearer.slice(7).trim()
      : c.req.header("x-hotelos-pms-secret")?.trim();
  return token === expected;
}

export function sharedSecretAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
  headerName: string,
): boolean {
  const expected = secret?.trim();
  if (!expected) {
    return isProduction !== true;
  }
  const bearer = c.req.header("authorization");
  const token =
    bearer?.toLowerCase().startsWith("bearer ")
      ? bearer.slice(7).trim()
      : c.req.header(headerName)?.trim();
  return token === expected;
}

export function securityIngestAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
): boolean {
  return sharedSecretAuthorized(
    c,
    secret,
    isProduction,
    "x-hotelos-security-secret",
  );
}

export function sentryIngestAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
): boolean {
  return sharedSecretAuthorized(
    c,
    secret,
    isProduction,
    "x-hotelos-sentry-secret",
  );
}

export function reputationIngestAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
): boolean {
  return sharedSecretAuthorized(
    c,
    secret,
    isProduction,
    "x-hotelos-reputation-secret",
  );
}

export function energyIngestAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
): boolean {
  return sharedSecretAuthorized(
    c,
    secret,
    isProduction,
    "x-hotelos-energy-secret",
  );
}

export function equipmentIngestAuthorized(
  c: HeaderContext,
  secret: string | undefined,
  isProduction: boolean | undefined,
): boolean {
  return sharedSecretAuthorized(
    c,
    secret,
    isProduction,
    "x-hotelos-equipment-secret",
  );
}
