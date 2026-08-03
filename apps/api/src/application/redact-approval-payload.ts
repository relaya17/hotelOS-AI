const SENSITIVE_KEY = /password|secret|token|apiKey/i;

export function redactSensitiveKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(redactSensitiveKeys);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : redactSensitiveKeys(val);
    }
    return result;
  }
  return value;
}

export function parseAndRedactApprovalPayload(
  payloadJson: string,
): unknown | null {
  try {
    return redactSensitiveKeys(JSON.parse(payloadJson) as unknown);
  } catch {
    return null;
  }
}
