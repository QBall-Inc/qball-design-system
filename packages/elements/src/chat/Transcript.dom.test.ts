import { afterEach, describe, expect, it } from "vitest";
import { HOSTILE_MARKUP } from "../trust/test-fixtures";
import { mount } from "./mount";
import { TRANSCRIPT_DEFAULTS, mountTranscript, type TranscriptOptions } from "./Transcript";
import { draftsOf, finalOf, groundedOf, loadScript, replay } from "./test-answers";

afterEach(() => {
  document.body.replaceChildren();
});

function bare(options: TranscriptOptions = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  return mountTranscript(container, options);
}

const VERDICT_CASES = [
  "grounded",
  "grounded-structured",
  "grounded-no-evidence",
  "grounded-explorer-link",
  "withheld",
  "refused-off-topic",
  "refused-in-scope-empty",
  "refused-abstained",
  "error",
];

describe("trust rule — streamed drafts never reach the DOM (early display off)", () => {
  it.each(VERDICT_CASES)("%s: no draft text at any step; only the safe final content", (name) => {
    const transcript = bare({ onWarn: () => undefined });
    const drafts = draftsOf(name);
    expect(drafts.length).toBeGreaterThan(0);
    const turn = transcript.addBotTurn();
    const snapshots: string[] = [];
    replay(turn, loadScript(name).events, () => snapshots.push(transcript.container.innerHTML));
    expect(snapshots.length).toBeGreaterThan(2);
    for (const html of snapshots) {
      for (const draft of drafts) expect(html).not.toContain(draft);
    }
    const slot = transcript.container.querySelector(".qturn__t-bot");
    if (name === "error") {
      expect(slot?.querySelector(".vbox--error")?.textContent).toBe(
        "the answer service is unavailable — try again in a moment.",
      );
      expect(slot?.querySelector(".vrow, .qfb")).toBeNull();
    } else {
      expect(slot?.querySelector(`.vbox--${finalOf(name).verdict}`)).not.toBeNull();
    }
    expect(slot?.querySelector(".qcursor")).toBeNull();
    expect(slot?.hasAttribute("aria-busy")).toBe(false);
  });

  it("authorize() while early display is off changes nothing in the DOM and warns", () => {
    const warnings: string[] = [];
    const transcript = bare({ onWarn: (message) => warnings.push(message) });
    const turn = transcript.addBotTurn();
    turn.start();
    turn.appendText("a draft that must stay hidden");
    const before = transcript.container.innerHTML;
    turn.authorize("grounded");
    expect(transcript.container.innerHTML).toBe(before);
    expect(transcript.container.textContent).not.toContain("a draft that must stay hidden");
    expect(warnings).toHaveLength(1);
  });
});

describe("thinking cursor", () => {
  it("shows the shipped ▋ cursor while pending, marks the turn busy, and goes on finalize", () => {
    const transcript = bare();
    const turn = transcript.addBotTurn();
    const slot = transcript.container.querySelector(".qturn__t-bot");
    expect(slot?.childElementCount).toBe(0);
    turn.start();
    const cursor = slot?.querySelector(".qcursor");
    expect(cursor?.textContent).toBe("▋");
    expect(cursor?.getAttribute("aria-hidden")).toBe("true");
    expect(cursor?.hasAttribute("style")).toBe(false);
    expect(slot?.getAttribute("aria-busy")).toBe("true");
    turn.finalize(finalOf("grounded"));
    expect(slot?.querySelector(".qcursor")).toBeNull();
    expect(slot?.hasAttribute("aria-busy")).toBe(false);
  });
});

describe("early display (opt-in)", () => {
  it("authorize reveals the buffered draft with the cursor; a grounded finalize replaces it", () => {
    const transcript = bare({ earlyDisplay: true });
    const turn = transcript.addBotTurn();
    turn.start();
    turn.appendText("early ");
    expect(transcript.container.textContent).not.toContain("early");
    turn.authorize("grounded");
    turn.appendText("words");
    const slot = transcript.container.querySelector(".qturn__t-bot");
    expect(slot?.textContent).toBe("early words▋");
    turn.finalize(finalOf("grounded"));
    expect(slot?.textContent).not.toContain("early words");
    expect(slot?.querySelector(".vbox--grounded")).not.toBeNull();
  });

  it.each(["withheld", "refused-off-topic"])(
    "contract violation: authorized then finalized %s → generic error turn, shown draft withdrawn",
    (name) => {
      const transcript = bare({ earlyDisplay: true });
      const turn = transcript.addBotTurn();
      turn.start();
      turn.authorize("grounded");
      turn.appendText("this looked grounded");
      expect(transcript.container.textContent).toContain("this looked grounded");
      turn.finalize(finalOf(name));
      const slot = transcript.container.querySelector(".qturn__t-bot");
      expect(slot?.textContent).toBe(TRANSCRIPT_DEFAULTS.errorText);
      expect(slot?.querySelector(".vbox--error")).not.toBeNull();
      expect(slot?.querySelector(".vrow, .vbox--withheld, .vbox--refused")).toBeNull();
      // The internal violation message is never shown.
      expect(slot?.textContent).not.toContain("authorized as grounded");
    },
  );

  it("uses the consumer's error text for a contract violation", () => {
    const transcript = bare({ earlyDisplay: true, errorText: "that answer slipped. ask again?" });
    const turn = transcript.addBotTurn();
    turn.start();
    turn.authorize("grounded");
    turn.finalize(finalOf("withheld"));
    expect(transcript.container.querySelector(".vbox--error")?.textContent).toBe(
      "that answer slipped. ask again?",
    );
  });
});

describe("bad turn data", () => {
  it("shows the generic error turn (no stuck cursor) and still throws to the finalize() caller", () => {
    const transcript = bare();
    const turn = transcript.addBotTurn();
    turn.start();
    const { provenance: _omit, ...noProvenance } = groundedOf("grounded");
    expect(() => {
      turn.finalize(noProvenance);
    }).toThrow("A grounded answer needs provenance");
    const slot = transcript.container.querySelector(".qturn__t-bot");
    expect(slot?.querySelector(".qcursor")).toBeNull();
    expect(slot?.hasAttribute("aria-busy")).toBe(false);
    expect(slot?.querySelector(".vbox--error")?.textContent).toBe(TRANSCRIPT_DEFAULTS.errorText);
    // The next turn still renders normally.
    const next = transcript.addBotTurn();
    next.start();
    next.finalize(finalOf("grounded"));
    expect(transcript.container.querySelectorAll(".vbox--grounded")).toHaveLength(1);
  });
});

describe("fail()", () => {
  it("after streamed text: only the error turn, no draft, no cursor, no stamp", () => {
    const transcript = bare();
    const turn = transcript.addBotTurn();
    turn.start();
    turn.appendText("partial answer that broke");
    turn.fail("the service is busy — try again shortly.");
    const slot = transcript.container.querySelector(".qturn__t-bot");
    expect(slot?.children).toHaveLength(1);
    expect(slot?.textContent).toBe("the service is busy — try again shortly.");
    expect(slot?.querySelector(".qcursor, .vrow, .qfb")).toBeNull();
  });
});

describe("turn layout", () => {
  it("user and bot turns use the persona prompts, separated by hairlines; notices sit between", () => {
    const transcript = bare({ userPrompt: "you ›", botPrompt: "qubae ›" });
    expect(transcript.container.childElementCount).toBe(0);
    transcript.addUserTurn("first question");
    transcript.addBotTurn();
    transcript.addNotice("one at a time. try again in a moment.");
    transcript.addUserTurn("second question");
    expect(Array.from(transcript.container.children, (node) => node.className)).toEqual([
      "qturn",
      "qsep",
      "qturn",
      "qnotice",
      "qsep",
      "qturn",
    ]);
    const prompts = Array.from(
      transcript.container.querySelectorAll(".qturn__you, .qturn__bot"),
      (node) => node.textContent,
    );
    expect(prompts).toEqual(["you ›", "qubae ›", "you ›"]);
    expect(transcript.container.querySelector(".qturn__t-you")?.textContent).toBe("first question");
  });

  it("defaults are persona-neutral", () => {
    const transcript = bare();
    transcript.addUserTurn("q");
    transcript.addBotTurn();
    expect(transcript.container.querySelector(".qturn__you")?.textContent).toBe("you ›");
    expect(transcript.container.querySelector(".qturn__bot")?.textContent).toBe("bot ›");
  });

  it("notice actions follow the answer allow-list", () => {
    const transcript = bare({ answer: { allowedOrigins: ["https://example.com"] } });
    const notice = transcript.addNotice("resting.", {
      action: { label: "explore →", href: "https://example.com/explore" },
    });
    expect(notice.querySelector("a")?.getAttribute("href")).toBe("https://example.com/explore");
  });
});

describe("container-agnostic", () => {
  function runConversation(container: HTMLElement): string {
    const transcript = mountTranscript(container, {
      botPrompt: "qubae ›",
      onWarn: () => undefined,
    });
    for (const name of ["grounded", "withheld", "refused-off-topic", "error"]) {
      transcript.addUserTurn(loadScript(name).question);
      replay(transcript.addBotTurn(), loadScript(name).events);
    }
    transcript.addNotice("the chat is resting this month.", {
      action: { label: "the explorer is awake →", href: "/explore" },
    });
    return container.innerHTML;
  }

  it("renders identically in a bare page div and inside the overlay body", () => {
    const page = document.createElement("div");
    document.body.append(page);
    const chat = mount(document.body);
    const inPage = runConversation(page);
    const inOverlay = runConversation(chat.body);
    expect(inOverlay).toBe(inPage);
    expect(chat.body.querySelectorAll(".qturn")).toHaveLength(8);
    chat.destroy();
  });
});

describe("feedback", () => {
  it("routes +1 / −1 with the turn's ref — e.g. into the overlay handle's feedback event", () => {
    const chat = mount(document.body);
    const events: unknown[] = [];
    chat.on("feedback", (event) => events.push(event.detail));
    const transcript = mountTranscript(chat.body, {
      onFeedback: (change) => {
        chat.relayFeedback(change);
      },
    });
    const turn = transcript.addBotTurn({ turnRef: "turn-7" });
    turn.start();
    turn.finalize(finalOf("grounded"));
    chat.body.querySelector<HTMLButtonElement>(".qfb__down")?.click();
    expect(events).toEqual([{ value: -1, turnRef: "turn-7" }]);
    chat.destroy();
  });

  it("needs a turnRef when onFeedback is set; without onFeedback no marks render", () => {
    const withFeedback = bare({ onFeedback: () => undefined });
    expect(() => withFeedback.addBotTurn()).toThrow(
      "addBotTurn() needs a turnRef when onFeedback is set.",
    );
    expect(() => withFeedback.addBotTurn({ turnRef: " " })).toThrow(
      "turnRef must be a non-empty string.",
    );
    const plain = bare();
    const turn = plain.addBotTurn({ turnRef: "t" });
    turn.start();
    turn.finalize(finalOf("grounded"));
    expect(plain.container.querySelector(".qfb")).toBeNull();
  });
});

describe("hostile payloads stay inert text", () => {
  it("user text, answer text, the closing line, the error line and notice text", () => {
    const transcript = bare({ userPrompt: HOSTILE_MARKUP, botPrompt: HOSTILE_MARKUP });
    transcript.addUserTurn(HOSTILE_MARKUP);
    const answered = transcript.addBotTurn();
    answered.start();
    answered.finalize({
      verdict: "refused",
      reason: "off_topic",
      body: [{ kind: "paragraph", inlines: [{ kind: "text", text: HOSTILE_MARKUP }] }],
      closingLine: HOSTILE_MARKUP,
    });
    const failed = transcript.addBotTurn();
    failed.start();
    failed.fail(HOSTILE_MARKUP);
    transcript.addNotice(HOSTILE_MARKUP);
    const root = transcript.container;
    expect(root.querySelectorAll("img")).toHaveLength(0);
    expect(root.querySelector(".qturn__t-you")?.textContent).toBe(HOSTILE_MARKUP);
    expect(root.querySelector(".vbox--refused p")?.textContent).toBe(HOSTILE_MARKUP);
    expect(root.querySelector(".qclose")?.textContent).toBe(HOSTILE_MARKUP);
    expect(root.querySelector(".vbox--error")?.textContent).toBe(HOSTILE_MARKUP);
    expect(root.querySelector(".qnotice")?.textContent).toBe(HOSTILE_MARKUP);
    expect(root.querySelector(".qturn__you")?.textContent).toBe(HOSTILE_MARKUP);
    expect((globalThis as { __trustPwned?: unknown }).__trustPwned).toBeUndefined();
  });
});

describe("clear / destroy", () => {
  it("clear() empties the container and detaches pending turns", () => {
    const transcript = bare();
    const pending = transcript.addBotTurn();
    pending.start();
    transcript.clear();
    expect(transcript.container.childElementCount).toBe(0);
    pending.finalize(finalOf("grounded"));
    expect(transcript.container.childElementCount).toBe(0);
    transcript.addUserTurn("fresh start");
    expect(transcript.container.firstElementChild?.className).toBe("qturn");
  });

  it("destroy() empties the container and refuses further use", () => {
    const transcript = bare();
    transcript.addUserTurn("q");
    transcript.destroy();
    transcript.destroy();
    expect(transcript.container.childElementCount).toBe(0);
    expect(() => transcript.addUserTurn("again")).toThrow(
      "TranscriptHandle.addUserTurn(): the transcript was destroyed.",
    );
  });

  it("rejects a non-element container and non-function callbacks", () => {
    expect(() => mountTranscript(null as unknown as HTMLElement)).toThrow(
      "mountTranscript() needs a container HTMLElement.",
    );
    expect(() =>
      mountTranscript(document.createElement("div"), { onFeedback: "x" as never }),
    ).toThrow("onFeedback must be a function.");
    expect(() => mountTranscript(document.createElement("div"), { botPrompt: 3 as never })).toThrow(
      "botPrompt must be a string.",
    );
  });
});
