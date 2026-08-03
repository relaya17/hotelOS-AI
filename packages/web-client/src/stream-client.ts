import { getApiBase, tryRefreshSession } from "./api-client.js";
import { clearSession, readAccessToken } from "./session.js";
import { createSseFrameParser, type SseFrame } from "./sse-frame-parser.js";

export type OpsDashboardStreamEventType =
  | "snapshot"
  | "heartbeat"
  | "reconnect"
  | "error";

export type OpsDashboardStreamEvent = {
  readonly type: OpsDashboardStreamEventType;
  readonly data: unknown;
};

export type SubscribeOpsDashboardStreamOptions = {
  readonly hotelId: string;
  readonly onEvent: (event: OpsDashboardStreamEvent) => void;
  readonly onError?: (error: Error) => void;
  readonly signal?: AbortSignal;
};

const OPS_STREAM_EVENT_TYPES = new Set<OpsDashboardStreamEventType>([
  "snapshot",
  "heartbeat",
  "reconnect",
  "error",
]);

function mapSseFrame(frame: SseFrame): OpsDashboardStreamEvent | null {
  const rawType = frame.event ?? "message";
  if (!OPS_STREAM_EVENT_TYPES.has(rawType as OpsDashboardStreamEventType)) {
    return null;
  }
  const rawData = frame.dataLines.join("\n");
  let data: unknown = {};
  if (rawData.length > 0) {
    try {
      data = JSON.parse(rawData) as unknown;
    } catch {
      data = { message: rawData };
    }
  }
  return {
    type: rawType as OpsDashboardStreamEventType,
    data,
  };
}

async function openOpsDashboardStream(
  hotelId: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "text/event-stream");
  const url = `${getApiBase()}/v1/streams/ops-dashboard?hotelId=${encodeURIComponent(hotelId)}`;
  return fetch(url, { ...init, headers });
}

function streamRequestInit(signal?: AbortSignal): RequestInit {
  return signal ? { signal } : {};
}

/**
 * Subscribes to the secure ops dashboard SSE stream via fetch + ReadableStream.
 * Retries once on 401 after refreshing the session. Does not use EventSource.
 */
export async function subscribeOpsDashboardStream(
  options: SubscribeOpsDashboardStreamOptions,
): Promise<void> {
  const { hotelId, onEvent, onError, signal } = options;

  async function connect(allowRefreshRetry: boolean): Promise<void> {
    if (signal?.aborted) {
      return;
    }

    let response = await openOpsDashboardStream(
      hotelId,
      streamRequestInit(signal),
    );

    if (response.status === 401 && allowRefreshRetry) {
      const refreshed = await tryRefreshSession();
      if (!refreshed) {
        clearSession();
        throw new Error("Session expired");
      }
      response = await openOpsDashboardStream(
        hotelId,
        streamRequestInit(signal),
      );
      if (response.status === 401) {
        clearSession();
        throw new Error("Session expired");
      }
    }

    if (!response.ok) {
      throw new Error(`Stream request failed (${response.status})`);
    }

    const body = response.body;
    if (!body) {
      throw new Error("Stream body unavailable");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseFrameParser((frame) => {
      const event = mapSseFrame(frame);
      if (event) {
        onEvent(event);
      }
    });

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch (cause) {
      if (signal?.aborted) {
        return;
      }
      const error =
        cause instanceof Error ? cause : new Error("Stream read failed");
      onError?.(error);
      throw error;
    }
  }

  await connect(true);
}
