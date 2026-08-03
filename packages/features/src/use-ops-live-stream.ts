import { useEffect, useRef, useState } from "react";
import {
  subscribeOpsDashboardStream,
  type OpsDashboardStreamEvent,
} from "@hotelos/web-client";

export type UseOpsLiveStreamOptions = {
  readonly hotelId: string | undefined;
  readonly onEvent?: (event: OpsDashboardStreamEvent) => void;
  readonly enabled?: boolean;
};

export type UseOpsLiveStreamResult = {
  readonly connected: boolean;
  readonly lastEventAt: string | undefined;
  readonly error: string | undefined;
};

export function useOpsLiveStream(
  options: UseOpsLiveStreamOptions,
): UseOpsLiveStreamResult {
  const { hotelId, enabled = true } = options;
  const onEventRef = useRef(options.onEvent);
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  useEffect(() => {
    if (!enabled || hotelId === undefined) {
      setConnected(false);
      setError(undefined);
      return;
    }

    const abortController = new AbortController();
    let active = true;

    void (async () => {
      setError(undefined);
      setConnected(false);
      try {
        await subscribeOpsDashboardStream({
          hotelId,
          signal: abortController.signal,
          onEvent: (event) => {
            if (!active || abortController.signal.aborted) {
              return;
            }
            setConnected(true);
            setLastEventAt(new Date().toISOString());
            if (event.type === "error") {
              const message =
                typeof event.data === "object" &&
                event.data !== null &&
                "message" in event.data &&
                typeof (event.data as { message: unknown }).message === "string"
                  ? (event.data as { message: string }).message
                  : "Stream error";
              setError(message);
              setConnected(false);
            }
            onEventRef.current?.(event);
          },
          onError: (streamError) => {
            if (!active || abortController.signal.aborted) {
              return;
            }
            setConnected(false);
            setError(streamError.message);
          },
        });
      } catch (cause) {
        if (!active || abortController.signal.aborted) {
          return;
        }
        setConnected(false);
        setError(cause instanceof Error ? cause.message : "Stream failed");
      } finally {
        if (active && !abortController.signal.aborted) {
          setConnected(false);
        }
      }
    })();

    return () => {
      active = false;
      abortController.abort();
      setConnected(false);
    };
  }, [enabled, hotelId]);

  return { connected, lastEventAt, error };
}
