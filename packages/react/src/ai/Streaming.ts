import { useCallback, useRef, useState } from "react";

import type { StreamError, TerminalMessage } from "./Terminal";

/**
 * Streaming — the SSE token-by-token consumption layer behind the `Terminal`.
 *
 * Three pieces:
 *  - `parseStreamFrame` — a pure SSE-frame parser (`data:` / `event: error` /
 *    `[DONE]`) → a discriminated {@link StreamEvent}. Provider error frames map
 *    to `{ type: "error"; retryable; message }`, never a thrown exception.
 *  - `streamFromResponse` — adapts a real `fetch` SSE `Response` body into an
 *    `AsyncIterable<StreamEvent>` (wire framing on `\n\n`).
 *  - `useStreaming` — the React hook: owns the transcript, appends each token to
 *    the in-progress assistant turn (re-rendering per token), surfaces retryable
 *    vs fatal errors, and clears the streaming flag on close (which removes the
 *    Terminal's cursor).
 *
 * The error shape is discriminated on `kind` (`StreamError`) / `type`
 * (`StreamEvent`) rather than a `string | "ERROR"` union, so a retryable frame
 * can never be confused with a sentinel string.
 */

/** A parsed event from the SSE stream. */
export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "error"; retryable: boolean; message: string }
  | { type: "done" };

/**
 * Parse a single SSE frame (the text between `\n\n` separators) into a
 * `StreamEvent`, or `null` if the frame carries no `data:` line. An
 * `event: error` frame whose `data:` is a JSON `{ retryable, message }` becomes
 * a discriminated error event; a `data: [DONE]` sentinel becomes a done event;
 * anything else is a token whose text is the raw `data:` payload.
 */
export function parseStreamFrame(frame: string): StreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const raw of frame.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }
  if (dataLines.length === 0) return null;

  const data = dataLines.join("\n");
  if (data === "[DONE]") return { type: "done" };

  if (event === "error") {
    try {
      const parsed = JSON.parse(data) as { retryable?: unknown; message?: unknown };
      return {
        type: "error",
        retryable: parsed.retryable === true,
        message: typeof parsed.message === "string" ? parsed.message : "Stream error",
      };
    } catch {
      // A non-JSON error payload is treated as a fatal message.
      return { type: "error", retryable: false, message: data };
    }
  }

  return { type: "token", text: data };
}

/**
 * Adapt a `fetch` SSE `Response` into an `AsyncIterable<StreamEvent>`. Reads the
 * body reader, decodes incrementally, and splits on the `\n\n` SSE frame
 * boundary, yielding one `StreamEvent` per non-empty frame.
 */
export async function* streamFromResponse(response: Response): AsyncIterable<StreamEvent> {
  const body = response.body;
  if (body === null) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const ev = parseStreamFrame(frame);
        if (ev !== null) yield ev;
        sep = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode(); // flush any retained partial multi-byte sequence
    const tail = parseStreamFrame(buffer);
    if (tail !== null) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** The state + actions returned by {@link useStreaming}. */
export interface UseStreamingResult {
  /** The transcript, oldest first. */
  messages: TerminalMessage[];
  /** True while a stream is in flight (drives the Terminal cursor). */
  streaming: boolean;
  /** The current provider error, or `null`. Retryable → transient; fatal → terminal. */
  error: StreamError | null;
  /** Append a user turn (e.g. from the Composer's `onSend`). */
  send: (text: string) => void;
  /** Consume a parsed event stream, accumulating tokens into a fresh assistant turn. */
  start: (events: AsyncIterable<StreamEvent>) => Promise<void>;
  /** Clear the current error (e.g. before a retry). */
  reset: () => void;
}

/** Replace the content of the most recent assistant turn (the in-progress one). */
function updateLastAssistant(prev: TerminalMessage[], text: string): TerminalMessage[] {
  const next = prev.slice();
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const m = next[i];
    if (m !== undefined && m.role === "assistant") {
      next[i] = { role: "assistant", content: text };
      return next;
    }
  }
  return next;
}

/**
 * Token-by-token streaming state machine. One stream at a time: `start` opens a
 * fresh assistant turn and accumulates tokens into it, re-rendering per token. A
 * retryable error sets a transient indicator but keeps the stream open (the next
 * token clears it); a fatal error terminates the stream and leaves the error for
 * a `Try again` retry. The streaming flag always clears when the iterable ends.
 */
export function useStreaming(initial: TerminalMessage[] = []): UseStreamingResult {
  const [messages, setMessages] = useState<TerminalMessage[]>(initial);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<StreamError | null>(null);
  const activeRef = useRef(false);

  const send = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const start = useCallback(async (events: AsyncIterable<StreamEvent>) => {
    if (activeRef.current) return; // one stream at a time — guard against a concurrent start()
    activeRef.current = true;
    setError(null);
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let acc = "";
    try {
      for await (const ev of events) {
        if (ev.type === "token") {
          acc += ev.text;
          setError(null); // a fresh token clears any transient "Retrying…" indicator
          setMessages((prev) => updateLastAssistant(prev, acc));
        } else if (ev.type === "error") {
          setError({ kind: "error", retryable: ev.retryable, message: ev.message });
          if (!ev.retryable) return; // fatal terminates the stream (finally clears `streaming`)
          // retryable: keep the stream open and await the next token delivery
        } else {
          return; // done
        }
      }
    } finally {
      setStreaming(false);
      activeRef.current = false;
      if (acc === "") {
        // The assistant row was added speculatively; if the stream yielded no
        // tokens (empty body, immediate error, closed iterable), prune the blank
        // `stocky ›` row so it does not linger in the transcript.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last !== undefined && last.role === "assistant" && last.content === ""
            ? prev.slice(0, -1)
            : prev;
        });
      }
    }
  }, []);

  return { messages, streaming, error, send, start, reset };
}
