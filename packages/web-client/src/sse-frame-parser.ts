export type SseFrame = {
  readonly event: string | undefined;
  readonly dataLines: readonly string[];
};

export type SseFrameParser = {
  push(chunk: string): void;
};

export function createSseFrameParser(
  onFrame: (frame: SseFrame) => void,
): SseFrameParser {
  let buffer = "";
  let event: string | undefined;
  let dataLines: string[] = [];

  function dispatchFrame(): void {
    if (event === undefined && dataLines.length === 0) {
      return;
    }
    onFrame({ event, dataLines: [...dataLines] });
    event = undefined;
    dataLines = [];
  }

  function processLine(line: string): void {
    if (line === "") {
      dispatchFrame();
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      return;
    }
    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (field === "event") {
      event = value;
      return;
    }
    if (field === "data") {
      dataLines.push(value);
    }
  }

  return {
    push(chunk: string): void {
      buffer += chunk;
      while (true) {
        const newline = buffer.indexOf("\n");
        if (newline === -1) {
          break;
        }
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        processLine(line);
      }
    },
  };
}

/** Parses a complete SSE text block (for tests and one-shot buffers). */
export function parseSseText(text: string): readonly SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseFrameParser((frame) => {
    frames.push(frame);
  });
  parser.push(text);
  return frames;
}
