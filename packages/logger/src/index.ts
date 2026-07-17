import type { CorrelationId, HotelId, TenantId } from "@hotelos/shared";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export type LogContext = {
  readonly service: string;
  readonly tenantId?: TenantId;
  readonly hotelId?: HotelId;
  readonly correlationId?: CorrelationId;
};

type LogFields = Record<string, string | number | boolean | null | undefined>;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  critical: 50,
};

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  critical: (message: string, fields?: LogFields) => void;
  child: (context: Partial<LogContext>) => Logger;
};

function mergeContext(
  base: LogContext,
  extra: Partial<LogContext>,
): LogContext {
  const merged: LogContext = {
    service: extra.service ?? base.service,
  };

  const tenantId = extra.tenantId ?? base.tenantId;
  if (tenantId !== undefined) {
    (merged as { tenantId: TenantId }).tenantId = tenantId;
  }

  const hotelId = extra.hotelId ?? base.hotelId;
  if (hotelId !== undefined) {
    (merged as { hotelId: HotelId }).hotelId = hotelId;
  }

  const correlationId = extra.correlationId ?? base.correlationId;
  if (correlationId !== undefined) {
    (merged as { correlationId: CorrelationId }).correlationId = correlationId;
  }

  return merged;
}

export function createLogger(
  context: LogContext,
  minLevel: LogLevel = "info",
): Logger {
  const write = (level: LogLevel, message: string, fields?: LogFields): void => {
    if (levelOrder[level] < levelOrder[minLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: context.service,
      tenantId: context.tenantId,
      hotelId: context.hotelId,
      correlationId: context.correlationId,
      ...fields,
    };

    const line = JSON.stringify(entry);
    if (level === "error" || level === "critical") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message, fields) => {
      write("debug", message, fields);
    },
    info: (message, fields) => {
      write("info", message, fields);
    },
    warn: (message, fields) => {
      write("warn", message, fields);
    },
    error: (message, fields) => {
      write("error", message, fields);
    },
    critical: (message, fields) => {
      write("critical", message, fields);
    },
    child: (extra) => createLogger(mergeContext(context, extra), minLevel),
  };
}
