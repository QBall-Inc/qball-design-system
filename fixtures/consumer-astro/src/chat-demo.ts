// Client script for the launcher pages: mounts the PACKED @qball-inc/elements
// chat launcher once (from the layout's persona options) and answers each
// question by replaying a shared answer fixture into a transcript inside the
// overlay — the wiring a real site does with its backend stream. After every
// replayed event it records whether any streamed draft text reached the page.
import type { FinalTurn } from "@qball-inc/elements";
import {
  mount,
  mountTranscript,
  type ChatHandle,
  type ChatMountOptions,
} from "@qball-inc/elements/chat";
import grounded from "../../qubrain/answers/grounded.json";
import groundedStructured from "../../qubrain/answers/grounded-structured.json";
import refusedAbstained from "../../qubrain/answers/refused-abstained.json";
import withheld from "../../qubrain/answers/withheld.json";

type AnswerEvent =
  | { op: "start" }
  | { op: "appendText"; text: string }
  | { op: "authorize" }
  | { op: "finalize"; turn: FinalTurn }
  | { op: "fail"; message: string };

interface AnswerScript {
  question: string;
  events: AnswerEvent[];
}

/** One answered question: which fixture ran and whether a draft ever leaked. */
export interface ChatRun {
  name: string;
  drafts: string[];
  leakedDraft: boolean;
}

declare global {
  interface Window {
    __pwned?: number;
    __chat?: { ok: true; runs: ChatRun[]; controlFired: number } | { ok: false; error: string };
    /** Finishes the open status turn (the "status" question) with site links. */
    __finishStatus?: () => void;
  }
}

/**
 * A JSON fixture as an answer script. JSON imports widen literal types, so the
 * shape is checked (fail fast) rather than trusted.
 */
function asScript(json: unknown, name: string): AnswerScript {
  const events = (json as { events?: unknown } | null)?.events;
  if (!Array.isArray(events) || events.length === 0) throw new Error(`${name}: no events`);
  return json as AnswerScript;
}

const HOSTILE =
  '<img src="data:image/png;base64,AAAA" onerror="window.__pwned = (window.__pwned || 0) + 1">';
const JS_URL = "javascript:window.__pwned=(window.__pwned||0)+1";

/** The grounded fixture with markup in its body and a javascript: source link. */
function hostileScript(): AnswerScript {
  const base = asScript(grounded, "grounded");
  return {
    question: "hostile",
    events: base.events.map((event) => {
      if (event.op !== "finalize" || event.turn.verdict !== "grounded") return event;
      const turn = event.turn;
      return {
        op: "finalize",
        turn: {
          ...turn,
          body: [{ kind: "paragraph", inlines: [{ kind: "text", text: HOSTILE }] }, ...turn.body],
          sources: turn.sources.map((s, i) =>
            i === 0 ? { ...s, title: HOSTILE, url: JS_URL } : s,
          ),
        },
      };
    }),
  };
}

/** A question picks its fixture by keyword, as a site would route by backend reply. */
const SCRIPTS: Record<string, () => AnswerScript> = {
  grounded: () => asScript(grounded, "grounded"),
  structured: () => asScript(groundedStructured, "grounded-structured"),
  refused: () => asScript(refusedAbstained, "refused-abstained"),
  withheld: () => asScript(withheld, "withheld"),
  hostile: hostileScript,
};

function readConfig(): ChatMountOptions {
  const node = document.getElementById("chat-config");
  const raw = node?.dataset["config"];
  if (raw === undefined) throw new Error("missing #chat-config data-config");
  return JSON.parse(raw) as ChatMountOptions;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Positive control: the same payloads injected unsafely must fire, otherwise
// "nothing fired" in the spec would prove nothing.
async function controls(): Promise<number> {
  const parsed = document.createElement("div");
  parsed.innerHTML = HOSTILE;
  document.body.append(parsed);
  const link = document.createElement("a");
  link.setAttribute("href", JS_URL);
  document.body.append(link);
  link.click();
  await wait(400);
  const fired = window.__pwned ?? 0;
  parsed.remove();
  link.remove();
  delete window.__pwned;
  return fired;
}

async function main(): Promise<ChatHandle | null> {
  try {
    const controlFired = await controls();
    const runs: ChatRun[] = [];
    const handle = mount(document.body, {
      ...readConfig(),
      onAsk(text) {
        if (text.includes("status")) {
          // Leaves the turn thinking with the consumer's status text until the
          // spec finishes it as a grounded answer carrying site links.
          transcript.addUserTurn(text);
          const turn = transcript.addBotTurn({ turnRef: `status-${String(runs.length)}` });
          turn.start();
          turn.setStatus("searching the notes");
          const base = asScript(grounded, "grounded").events.find((e) => e.op === "finalize");
          if (base?.op !== "finalize" || base.turn.verdict !== "grounded") {
            throw new Error("grounded fixture has no grounded finalize");
          }
          const answer = base.turn;
          window.__finishStatus = () => {
            turn.finalize({
              ...answer,
              siteLinks: {
                heading: "related pages",
                items: [
                  { title: "a page", url: "/notes/a" },
                  { title: "another page", url: "/notes/b" },
                ],
              },
            });
          };
          runs.push({ name: "status", drafts: [], leakedDraft: false });
          return;
        }
        const name = Object.keys(SCRIPTS).find((key) => text.includes(key));
        const script = name === undefined ? undefined : SCRIPTS[name]?.();
        if (name === undefined || script === undefined) throw new Error(`no fixture for "${text}"`);
        transcript.addUserTurn(text);
        const turn = transcript.addBotTurn({ turnRef: `${name}-${String(runs.length)}` });
        const drafts = script.events.flatMap((e) => (e.op === "appendText" ? [e.text] : []));
        let leakedDraft = false;
        for (const event of script.events) {
          if (event.op === "start") turn.start();
          else if (event.op === "appendText") turn.appendText(event.text);
          else if (event.op === "authorize") turn.authorize("grounded");
          else if (event.op === "finalize") turn.finalize(event.turn);
          else turn.fail(event.message);
          const shown = document.body.textContent ?? "";
          if (drafts.some((draft) => shown.includes(draft))) leakedDraft = true;
        }
        runs.push({ name, drafts, leakedDraft });
      },
    });
    const transcript = mountTranscript(handle.body, {
      onFeedback: (change) => handle.relayFeedback(change),
      onWarn: () => undefined,
    });
    window.__chat = { ok: true, runs, controlFired };
    return handle;
  } catch (err) {
    window.__chat = { ok: false, error: String(err) };
    return null;
  }
}

/** The page's one launcher (null if mounting failed), for page scripts that wire to it. */
export const chatReady: Promise<ChatHandle | null> = main();
