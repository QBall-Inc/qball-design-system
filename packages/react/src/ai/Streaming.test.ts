import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TerminalMessage } from "./Terminal";
import { parseStreamFrame, streamFromResponse, useStreaming, type StreamEvent } from "./Streaming";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function lastAssistant(messages: TerminalMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m !== undefined && m.role === "assistant") {
      return typeof m.content === "string" ? m.content : m.content.map((t) => t.text).join("");
    }
  }
  return "";
}

/**
 * A real, manually-driven `AsyncIterable<StreamEvent>` — the test pushes events
 * one at a time and the hook consumes them through its genuine `for await` loop.
 * No mocking of the system under test (the hook); only the upstream feed is
 * controlled, exactly as a real SSE source would deliver frames over time.
 */
function controllableStream() {
  const queue: StreamEvent[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  const iterable: AsyncIterable<StreamEvent> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next !== undefined) yield next;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
  return {
    iterable,
    push(ev: StreamEvent) {
      queue.push(ev);
      wake?.();
      wake = null;
    },
    close() {
      closed = true;
      wake?.();
      wake = null;
    },
  };
}

describe("parseStreamFrame", () => {
  it("parses a plain data frame as a token whose text is the payload (AC-7)", () => {
    expect(parseStreamFrame("data: Hello")).toEqual({ type: "token", text: "Hello" });
  });

  it("parses the [DONE] sentinel as a done event", () => {
    expect(parseStreamFrame("data: [DONE]")).toEqual({ type: "done" });
  });

  it("maps an event:error frame to a discriminated retryable error (AC-8)", () => {
    expect(
      parseStreamFrame('event: error\ndata: {"retryable":true,"message":"rate limited"}'),
    ).toEqual({
      type: "error",
      retryable: true,
      message: "rate limited",
    });
  });

  it("maps an event:error frame with retryable:false to a fatal error (AC-9)", () => {
    expect(
      parseStreamFrame('event: error\ndata: {"retryable":false,"message":"quota exhausted"}'),
    ).toEqual({
      type: "error",
      retryable: false,
      message: "quota exhausted",
    });
  });

  it("treats a non-JSON error payload as fatal", () => {
    expect(parseStreamFrame("event: error\ndata: kaboom")).toEqual({
      type: "error",
      retryable: false,
      message: "kaboom",
    });
  });

  it("returns null for a frame with no data line", () => {
    expect(parseStreamFrame(": keep-alive comment")).toBeNull();
    expect(parseStreamFrame("")).toBeNull();
  });

  it("tolerates trailing CR and joins multi-line data", () => {
    expect(parseStreamFrame("data: a\r\ndata: b")).toEqual({ type: "token", text: "a\nb" });
  });
});

describe("streamFromResponse", () => {
  it("frames a real SSE Response body into events on the \\n\\n boundary", async () => {
    const sse =
      "data: Hel\n\ndata: lo\n\n" +
      'event: error\ndata: {"retryable":false,"message":"x"}\n\n' +
      "data: [DONE]\n\n";
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse));
          controller.close();
        },
      }),
    );
    const events: StreamEvent[] = [];
    for await (const ev of streamFromResponse(response)) events.push(ev);
    expect(events).toEqual([
      { type: "token", text: "Hel" },
      { type: "token", text: "lo" },
      { type: "error", retryable: false, message: "x" },
      { type: "done" },
    ]);
  });

  it("reassembles a frame split across chunks and flushes a tail frame with no trailing newline", async () => {
    const enc = new TextEncoder();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode("data: Hel")); // frame split mid-payload...
          controller.enqueue(enc.encode("lo\n\ndata: world")); // ...completes, then a tail (no \n\n)
          controller.close();
        },
      }),
    );
    const events: StreamEvent[] = [];
    for await (const ev of streamFromResponse(response)) events.push(ev);
    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: "world" }, // the trailing buffer is flushed as a final frame
    ]);
  });
});

describe("useStreaming", () => {
  it("appends tokens incrementally to the in-progress assistant turn (AC-7)", async () => {
    const { result } = renderHook(() => useStreaming());
    const stream = controllableStream();

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start(stream.iterable);
    });
    expect(result.current.streaming).toBe(true);

    await act(async () => {
      stream.push({ type: "token", text: "Hel" });
      await tick();
    });
    expect(lastAssistant(result.current.messages)).toBe("Hel");

    await act(async () => {
      stream.push({ type: "token", text: "lo" });
      await tick();
    });
    expect(lastAssistant(result.current.messages)).toBe("Hello");

    await act(async () => {
      stream.close();
      await startPromise;
    });
    // Stream closed → cursor flag clears (AC-10 'stream-close removes cursor').
    expect(result.current.streaming).toBe(false);
  });

  it("surfaces a retryable error and recovers when the next token arrives (AC-8/AC-9)", async () => {
    const { result } = renderHook(() => useStreaming());
    const stream = controllableStream();

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start(stream.iterable);
    });

    await act(async () => {
      stream.push({ type: "token", text: "A" });
      await tick();
    });
    await act(async () => {
      stream.push({ type: "error", retryable: true, message: "slow down" });
      await tick();
    });
    expect(result.current.error).toEqual({ kind: "error", retryable: true, message: "slow down" });
    // Retryable keeps the stream open.
    expect(result.current.streaming).toBe(true);

    await act(async () => {
      stream.push({ type: "token", text: "B" });
      await tick();
    });
    // The next token clears the transient indicator and appends.
    expect(result.current.error).toBeNull();
    expect(lastAssistant(result.current.messages)).toBe("AB");

    await act(async () => {
      stream.close();
      await startPromise;
    });
    expect(result.current.streaming).toBe(false);
  });

  it("terminates the stream on a fatal error and leaves the error for a retry (AC-9)", async () => {
    const { result } = renderHook(() => useStreaming());
    const stream = controllableStream();

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start(stream.iterable);
    });

    await act(async () => {
      stream.push({ type: "token", text: "partial" });
      await tick();
    });
    await act(async () => {
      stream.push({ type: "error", retryable: false, message: "stream failed" });
      await startPromise; // fatal terminates start() without needing close()
    });

    expect(result.current.streaming).toBe(false);
    expect(result.current.error).toEqual({
      kind: "error",
      retryable: false,
      message: "stream failed",
    });
    // The partial assistant content is preserved for context.
    expect(lastAssistant(result.current.messages)).toBe("partial");

    // reset() clears the error (e.g. before a Try-again retry).
    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });

  it("send() appends a user turn", () => {
    const { result } = renderHook(() => useStreaming());
    act(() => {
      result.current.send("hello");
    });
    expect(result.current.messages).toEqual([{ role: "user", content: "hello" }]);
  });
});
