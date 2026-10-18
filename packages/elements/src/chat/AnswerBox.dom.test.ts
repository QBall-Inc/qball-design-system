import { describe, expect, it } from "vitest";
import type { FinalTurn, GroundedTurn, RefusedTurn, WithheldTurn } from "../answer-turn";
import {
  answerFooter,
  groundedExplanation,
  refusedExplanation,
  sourcesLine,
  withheldExplanation,
} from "../locked-strings";
import { HOSTILE_MARKUP, claim, sourceRef, unavailableSource } from "../trust/test-fixtures";
import { ANSWER_DEFAULTS, renderAnswer, renderErrorAnswer, type AnswerOptions } from "./AnswerBox";
import { finalOf, groundedOf } from "./test-answers";

/** Renders into a detached `.qturn__t-bot` so queries see one turn. */
function render(turn: FinalTurn, options: AnswerOptions = {}): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "qturn__t-bot";
  slot.append(...renderAnswer(turn, options));
  return slot;
}

function text(root: ParentNode, selector: string): string | null {
  return root.querySelector(selector)?.textContent ?? null;
}

const stampText = (root: ParentNode): string | null => text(root, ".vrow__txt .vtick > span");

describe("grounded answer", () => {
  it("renders stamp, tinted box, sources line + reading list, footer — in that order", () => {
    const turn = groundedOf("grounded");
    const slot = render(turn);
    expect(Array.from(slot.children, (node) => node.className)).toEqual([
      "vrow",
      "vbox vbox--grounded",
      "qsrcline ground-wave ground-wave--sources",
      "srclist qsrclist",
      "provfoot",
    ]);
    expect(stampText(slot)).toBe(groundedExplanation(turn.explanation));
    expect(text(slot, ".vstamp")).toBe("● grounded");
    if (turn.provenance === undefined) throw new Error("fixture has provenance");
    expect(text(slot, ".provfoot")).toBe(answerFooter(turn.provenance));
  });

  it("the sources line counts reading-list rows and names the newest month; it toggles the list", () => {
    const slot = render(groundedOf("grounded"));
    const line = slot.querySelector<HTMLButtonElement>(".qsrcline");
    const list = slot.querySelector(".qsrclist");
    if (line === null || list === null) throw new Error("sources missing");
    expect(line.textContent).toBe(sourcesLine({ sources: 3, newestDate: "2026-07-30" }));
    expect(line.textContent).toBe("[3 sources · newest jul 2026]");
    expect(list.querySelectorAll(".srcrow")).toHaveLength(3);
    expect(list.classList.contains("open")).toBe(false);
    expect(line.getAttribute("aria-expanded")).toBe("false");
    line.click();
    expect(list.classList.contains("open")).toBe(true);
    expect(line.getAttribute("aria-expanded")).toBe("true");
    line.click();
    expect(list.classList.contains("open")).toBe(false);
  });

  it.each([
    [[sourceRef({ save_date: "2026-03-09" })], "[1 source · newest mar 2026]"],
    [
      [
        sourceRef({ episode_id: "a", save_date: "2025-12-01" }),
        sourceRef({ episode_id: "a", save_date: "2026-01-01" }),
        sourceRef({ episode_id: "b", save_date: "2026-02-14" }),
      ],
      "[2 sources · newest feb 2026]",
    ],
  ])("sources line N=1 / N>1 with duplicates collapsed → %j", (sources, expected) => {
    const turn: GroundedTurn = { ...groundedOf("grounded"), sources };
    expect(text(render(turn), ".qsrcline")).toBe(expected);
  });

  it("with every source unavailable there is no date: the list shows open, without a line", () => {
    const turn: GroundedTurn = {
      ...groundedOf("grounded"),
      sources: [unavailableSource("ep-x"), unavailableSource("ep-y")],
    };
    const slot = render(turn);
    expect(slot.querySelector(".qsrcline")).toBeNull();
    const list = slot.querySelector(".qsrclist");
    expect(list?.classList.contains("open")).toBe(true);
    expect(list?.querySelectorAll(".srcrow")).toHaveLength(2);
  });

  it("renders every block and inline kind as real elements carrying plain text", () => {
    const slot = render(groundedOf("grounded-structured"));
    const box = slot.querySelector(".vbox");
    if (box === null) throw new Error("box missing");
    expect(Array.from(box.children, (node) => node.tagName)).toEqual([
      "H2",
      "P",
      "OL",
      "TABLE",
      "PRE",
      "P",
    ]);
    expect(text(box, "h2")).toBe("the short version");
    expect(text(box, "p em")).toBe("retrievable");
    expect(text(box, "p .qn")).toBe("3 claims");
    expect(box.querySelectorAll("ol > li")).toHaveLength(2);
    expect(Array.from(box.querySelectorAll("ol > li > ul > li"), (li) => li.textContent)).toEqual([
      "keep named entities verbatim",
      "drop pleasantries",
    ]);
    expect(text(box, "ol code")).toBe("turn_range");
    expect(Array.from(box.querySelectorAll("thead th"), (th) => th.textContent)).toEqual([
      "approach",
      "accuracy cost",
    ]);
    expect(box.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(text(box, "tbody .qn")).toBe("~12%");
    expect(text(box, "pre")).toBe("summary = summarise(turns[:-window])");
    expect(Array.from(box.querySelectorAll(".qgap"), (node) => node.textContent)).toEqual([
      "[figure not in saved evidence]",
      "[source not found]",
    ]);
  });

  it("numbers citations in reading-list order; an unknown id renders as an unavailable source", () => {
    const slot = render(groundedOf("grounded-structured"));
    const cites = Array.from(slot.querySelectorAll(".vbox .qcite"));
    expect(cites.map((node) => node.textContent)).toEqual(["[1]", "[2]", "[source unavailable]"]);
    expect(cites.map((node) => node.getAttribute("title"))).toEqual([
      "Memory in the age of agents",
      "LLM-powered autonomous agents",
      "source unavailable",
    ]);
    expect(cites[2]?.classList.contains("is-unavailable")).toBe(true);
    // Citations are text, never links.
    expect(slot.querySelectorAll(".vbox a")).toHaveLength(0);
  });

  it("a citation of a known but unavailable source keeps its number, styled unavailable", () => {
    const slot = render(groundedOf("grounded-explorer-link"));
    const turn = groundedOf("grounded-explorer-link");
    const cite = slot.querySelector(".qcite");
    expect(cite?.textContent).toBe("[1]");
    const withGone: GroundedTurn = {
      ...turn,
      body: [{ kind: "paragraph", inlines: [{ kind: "citation", episode_id: "ep-demo-0013" }] }],
    };
    const gone = render(withGone).querySelector(".qcite");
    expect(gone?.textContent).toBe("[3]");
    expect(gone?.classList.contains("is-unavailable")).toBe(true);
    expect(gone?.getAttribute("title")).toBe("source unavailable");
  });

  it("a heading such as 'what the notes don't cover' is an ordinary heading", () => {
    const slot = render(groundedOf("grounded-explorer-link"));
    expect(text(slot, ".vbox h3")).toBe("what the notes don't cover");
  });
});

describe("grounded answer without evidence (owner S123)", () => {
  it("stamp reads `0 claims · 0 episodes`; no sources line, no list, no footer", () => {
    const turn = groundedOf("grounded-no-evidence");
    const slot = render(turn);
    expect(stampText(slot)).toBe("0 claims · 0 episodes");
    expect(text(slot, ".vstamp")).toBe("● grounded");
    expect(slot.querySelector(".qsrcline")).toBeNull();
    expect(slot.querySelector(".qsrclist")).toBeNull();
    expect(slot.querySelector(".provfoot")).toBeNull();
    expect(text(slot, ".vbox p")).toContain("comes from the site's own profile");
  });

  it("a grounded answer with evidence but no provenance is rejected, not rendered half-empty", () => {
    const { provenance: _omit, ...rest } = groundedOf("grounded");
    expect(() => render(rest)).toThrow(
      "A grounded answer needs provenance unless it has no evidence (0 claims, 0 episodes).",
    );
  });
});

describe("answer footer without a snapshot date (owner S123)", () => {
  it("leaves the `snapshot <date>` segment out", () => {
    const slot = render(groundedOf("grounded-explorer-link"));
    expect(text(slot, ".provfoot")).toBe(
      "7 claims · 5 episodes · high confidence · 1 superseded excluded",
    );
    expect(text(slot, ".provfoot b")).toBe("7 claims");
  });
});

describe("explorer link (AD-4 internal-link policy)", () => {
  it("a root-relative link renders as a real link with the default label", () => {
    const link = render(groundedOf("grounded-explorer-link")).querySelector(".qlink");
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("/explore?e=agent-harness");
    expect(link?.textContent).toBe(ANSWER_DEFAULTS.explorerLinkLabel);
  });

  it("uses the consumer's label and allow-listed origins", () => {
    const turn: GroundedTurn = {
      ...groundedOf("grounded"),
      explorerLink: "https://graph.example.com/explore?e=x",
    };
    const link = render(turn, {
      explorerLinkLabel: "walk it →",
      allowedOrigins: ["https://graph.example.com"],
    }).querySelector(".qlink");
    expect(link?.getAttribute("href")).toBe("https://graph.example.com/explore?e=x");
    expect(link?.textContent).toBe("walk it →");
  });

  it.each([
    "javascript:globalThis.__trustPwned=1",
    " JaVaScRiPt:globalThis.__trustPwned=1",
    "data:text/html,<script>globalThis.__trustPwned=1</script>",
    "vbscript:msgbox(1)",
    "//evil.example/explore",
    "https://evil.example/explore",
  ])("a hostile target %j stays inert text with no href", (explorerLink) => {
    const slot = render({ ...groundedOf("grounded"), explorerLink });
    const link = slot.querySelector(".qlink");
    expect(link?.tagName).toBe("SPAN");
    expect(link?.textContent).toBe(ANSWER_DEFAULTS.explorerLinkLabel);
    expect(slot.querySelector(".qlink[href]")).toBeNull();
    // The only links left are the reading list's own source links.
    const hrefs = Array.from(slot.querySelectorAll("[href]"), (n) => n.getAttribute("href"));
    expect(hrefs).toEqual([
      "https://example.com/memory-in-the-age-of-agents",
      "https://example.com/llm-powered-autonomous-agents",
      "https://example.com/context-engineering-notes",
    ]);
  });

  it("no link supplied → nothing in its place", () => {
    expect(render(groundedOf("grounded")).querySelector(".qlink")).toBeNull();
  });
});

describe("site links (consumer-titled, internal-link policy)", () => {
  const withLinks = (siteLinks: GroundedTurn["siteLinks"], extra: Partial<GroundedTurn> = {}) =>
    ({ ...groundedOf("grounded"), ...extra, siteLinks }) as GroundedTurn;
  const silent: AnswerOptions = { onWarn: () => undefined };

  it("sits after the footer and before the explorer link, keeping the consumer's heading and order", () => {
    const slot = render(
      withLinks(
        {
          heading: "related pages",
          items: [
            { title: "second first", url: "/notes/b" },
            { title: "then this", url: "/notes/a?x=1#top" },
          ],
        },
        { explorerLink: "/explore?e=x" },
      ),
      silent,
    );
    expect(Array.from(slot.children, (node) => node.className).slice(-4)).toEqual([
      "provfoot",
      "qsrcline ground-wave ground-wave--sources qsitelinks__line",
      "srclist qsrclist qsitelinks",
      "qlink",
    ]);
    // The toggle line is the consumer's heading verbatim: no count, no date.
    const line = slot.querySelector<HTMLButtonElement>(".qsitelinks__line")!;
    expect(line.tagName).toBe("BUTTON");
    expect(line.type).toBe("button");
    expect(line.textContent).toBe("related pages");
    const links = Array.from(slot.querySelectorAll(".qsitelinks a"));
    expect(
      links.map((a) => [a.querySelector(".srcrow__title")?.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["second first", "/notes/b"],
      ["then this", "/notes/a?x=1#top"],
    ]);
    for (const a of links) {
      expect(a.hasAttribute("target")).toBe(false);
      expect(a.className).toBe("srcrow qsitelinks__link");
      // A source row's cells — empty mark, title, empty date, ↗ — with no badge or date text.
      expect(Array.from(a.children, (cell) => [cell.className, cell.textContent])).toEqual([
        ["", ""],
        ["srcrow__title", a.querySelector(".srcrow__title")?.textContent],
        ["", ""],
        ["srcrow__out", "↗"],
      ]);
      expect(a.querySelector(".srcrow__title")?.getAttribute("title")).toBe(
        a.querySelector(".srcrow__title")?.textContent,
      );
    }
    // Reading-list semantics: plain div rows, no list role.
    expect(slot.querySelector(".qsitelinks ul, .qsitelinks [role]")).toBeNull();
  });

  it("is collapsed by default; the line toggles the rows and mirrors it in aria-expanded", () => {
    const slot = render(
      withLinks({ heading: "related pages", items: [{ title: "page", url: "/p" }] }),
      silent,
    );
    const line = slot.querySelector<HTMLButtonElement>(".qsitelinks__line")!;
    const list = slot.querySelector(".qsitelinks")!;
    expect(line.getAttribute("aria-expanded")).toBe("false");
    expect(list.classList.contains("open")).toBe(false);
    line.click();
    expect(line.getAttribute("aria-expanded")).toBe("true");
    expect(list.classList.contains("open")).toBe(true);
    line.click();
    expect(line.getAttribute("aria-expanded")).toBe("false");
    expect(list.classList.contains("open")).toBe(false);
  });

  it("an absolute link navigates only for an allow-listed origin", () => {
    const turn = withLinks({
      heading: "related pages",
      items: [{ title: "page", url: "https://site.example/page" }],
    });
    const open = render(turn, { ...silent, allowedOrigins: ["https://site.example"] });
    expect(open.querySelector(".qsitelinks a")?.getAttribute("href")).toBe(
      "https://site.example/page",
    );
    const closed = render(turn, silent);
    expect(closed.querySelector(".qsitelinks a")).toBeNull();
    expect(closed.querySelector(".qsitelinks__link.is-inert")?.textContent).toBe("page");
    // An inert row never advertises a link: no ↗.
    expect(closed.querySelector(".qsitelinks .srcrow__out")).toBeNull();
  });

  it.each([
    "javascript:globalThis.__trustPwned=1",
    "data:text/html,<script>globalThis.__trustPwned=1</script>",
    "//evil.example/page",
    "https://evil.example/page",
    "notes/relative",
    "/\\evil.example",
  ])("%j stays inert text and warns with the fix", (url) => {
    const warnings: string[] = [];
    const slot = render(withLinks({ heading: "related pages", items: [{ title: "page", url }] }), {
      onWarn: (message) => warnings.push(message),
    });
    const node = slot.querySelector(".qsitelinks__link");
    expect(node?.tagName).toBe("DIV");
    expect(node?.className).toBe("srcrow qsitelinks__link is-inert");
    expect(node?.hasAttribute("href")).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(url);
    expect(warnings[0]).toContain("allowedOrigins");
  });

  it("a navigable link raises no warning", () => {
    const warnings: string[] = [];
    render(withLinks({ heading: "related pages", items: [{ title: "page", url: "/p" }] }), {
      onWarn: (message) => warnings.push(message),
    });
    expect(warnings).toEqual([]);
  });

  it("titles and the heading stay inert text", () => {
    const slot = render(
      withLinks({ heading: HOSTILE_MARKUP, items: [{ title: HOSTILE_MARKUP, url: "/p" }] }),
      silent,
    );
    expect(text(slot, ".qsitelinks__line")).toBe(HOSTILE_MARKUP);
    expect(text(slot, ".qsitelinks a .srcrow__title")).toBe(HOSTILE_MARKUP);
    expect(slot.querySelector(".qsitelinks img")).toBeNull();
  });

  it("no siteLinks, or an empty list, renders nothing — the DS has no default heading", () => {
    expect(
      render(groundedOf("grounded")).querySelector(".qsitelinks, .qsitelinks__line"),
    ).toBeNull();
    const empty = render(withLinks({ heading: "", items: [] }), silent);
    expect(empty.querySelector(".qsitelinks, .qsitelinks__line")).toBeNull();
  });

  it.each([
    [{ heading: "", items: [{ title: "page", url: "/p" }] }, /non-empty heading/],
    [{ heading: "   ", items: [{ title: "page", url: "/p" }] }, /non-empty heading/],
    [{ items: [{ title: "page", url: "/p" }] }, /non-empty heading/],
    [{ heading: "related pages", items: [{ title: "", url: "/p" }] }, /items\[0\]/],
    [{ heading: "related pages", items: [{ title: "page" }] }, /items\[0\]/],
    [{ heading: "related pages", items: [null] }, /items\[0\]/],
    [{ heading: "related pages", items: "nope" }, /must be an array/],
    [null, /must be an object/],
    ["related pages", /must be an object/],
  ])("rejects malformed siteLinks %j", (siteLinks, message) => {
    expect(() =>
      render(withLinks(siteLinks as unknown as GroundedTurn["siteLinks"]), silent),
    ).toThrow(message);
  });
});

describe("withheld answer", () => {
  it("renders the explanation, the held-draft note, the lead-in and the traceable claim rows", () => {
    const turn = finalOf("withheld") as WithheldTurn;
    const slot = render(turn);
    expect(Array.from(slot.children, (node) => node.className)).toEqual([
      "vrow",
      "vbox vbox--withheld",
      "qlead",
      "qclaims",
    ]);
    expect(stampText(slot)).toBe(withheldExplanation(turn.explanation));
    expect(text(slot, ".vstamp")).toBe("◐ withheld");
    expect(text(slot, ".qlead")).toBe("here’s the part i can stand behind:");
    const rows = Array.from(slot.querySelectorAll(".qclaim"));
    expect(rows.map((row) => Array.from(row.children, (c) => c.textContent))).toEqual([
      ["◆", "episodic memory outperforms flat context past 100 turns", "high"],
      ["◈", "memory compaction loses ~12% of retrieval accuracy", "medium"],
    ]);
    expect(rows.map((row) => row.firstElementChild?.className)).toEqual([
      "qclaim__conf qclaim__conf--high",
      "qclaim__conf qclaim__conf--med",
    ]);
    expect(rows[0]?.lastElementChild?.className).toBe("qclaim__lvl");
  });

  it("the low tier uses the low glyph and class", () => {
    const turn: WithheldTurn = {
      verdict: "withheld",
      explanation: { untraceableFigures: 1, claimsShown: 1 },
      body: [{ kind: "paragraph", inlines: [{ kind: "text", text: "held" }] }],
      traceableClaims: [claim({ confidence_tier: "low" })],
    };
    const row = render(turn).querySelector(".qclaim");
    expect(row?.firstElementChild?.className).toBe("qclaim__conf qclaim__conf--low");
    expect(row?.firstElementChild?.textContent).toBe("◇");
  });

  it("with no traceable claims, neither the lead-in nor the list renders; a custom lead-in is used verbatim", () => {
    const base = finalOf("withheld") as WithheldTurn;
    const none = render({ ...base, traceableClaims: [] });
    expect(none.querySelector(".qlead")).toBeNull();
    expect(none.querySelector(".qclaims")).toBeNull();
    expect(text(render(base, { withheldLead: "what holds up:" }), ".qlead")).toBe("what holds up:");
  });
});

describe("refused answer", () => {
  it.each(["refused-off-topic", "refused-in-scope-empty", "refused-abstained"])(
    "%s: explanation by reason, body always shown, closing line verbatim when given",
    (name) => {
      const turn = finalOf(name) as RefusedTurn;
      const slot = render(turn);
      expect(stampText(slot)).toBe(refusedExplanation(turn.reason));
      expect(text(slot, ".vstamp")).toBe("∅ refused");
      const first = turn.body[0];
      const expected =
        first?.kind === "paragraph"
          ? first.inlines.map((inline) => ("text" in inline ? inline.text : "")).join("")
          : "";
      expect(expected.length).toBeGreaterThan(0);
      expect(slot.querySelector(".vbox--refused p")?.textContent).toContain(expected.slice(0, 40));
      if (turn.closingLine === undefined) {
        expect(slot.querySelector(".qclose")).toBeNull();
      } else {
        expect(text(slot, ".qclose")).toBe(turn.closingLine);
      }
      expect(slot.querySelector(".qsrcline, .provfoot, .qclaims")).toBeNull();
    },
  );

  it("an empty closing line renders nothing", () => {
    const turn = { ...(finalOf("refused-off-topic") as RefusedTurn), closingLine: "" };
    expect(render(turn).querySelector(".qclose")).toBeNull();
  });
});

describe("feedback marks", () => {
  it("appear in the box of every verdict when enabled and report the turn's ref", () => {
    for (const name of ["grounded", "withheld", "refused-off-topic"]) {
      const changes: unknown[] = [];
      const slot = render(finalOf(name), {
        feedback: { turnRef: `t-${name}`, onChange: (change) => changes.push(change) },
      });
      const up = slot.querySelector<HTMLButtonElement>(".vbox > .qfb .qfb__up");
      up?.click();
      expect(changes).toEqual([{ value: 1, turnRef: `t-${name}` }]);
    }
  });

  it("are absent without feedback options; an initial value shows pressed", () => {
    expect(render(finalOf("grounded")).querySelector(".qfb")).toBeNull();
    const slot = render(finalOf("grounded"), {
      feedback: { turnRef: "t", onChange: () => undefined, initial: -1 },
    });
    expect(slot.querySelector(".qfb__down")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("onStampOpen receives the opened row", () => {
    const opened: HTMLElement[] = [];
    const slot = render(finalOf("grounded"), { onStampOpen: (row) => opened.push(row) });
    slot.querySelector<HTMLButtonElement>(".vstamp")?.click();
    expect(opened).toEqual([slot.querySelector(".vrow")]);
  });
});

describe("hostile payloads stay inert text", () => {
  it("answer text, headings, table cells, code, markers, claims and the closing line", () => {
    const inline = { kind: "text", text: HOSTILE_MARKUP } as const;
    const grounded: GroundedTurn = {
      ...groundedOf("grounded"),
      body: [
        { kind: "heading", level: 1, inlines: [inline] },
        { kind: "paragraph", inlines: [inline, { kind: "marker", text: HOSTILE_MARKUP }] },
        { kind: "table", header: [[inline]], rows: [[[{ kind: "code", text: HOSTILE_MARKUP }]]] },
        { kind: "code", text: HOSTILE_MARKUP },
      ],
    };
    const withheld: WithheldTurn = {
      ...(finalOf("withheld") as WithheldTurn),
      traceableClaims: [claim({ claim_text: HOSTILE_MARKUP })],
    };
    const refused: RefusedTurn = {
      ...(finalOf("refused-off-topic") as RefusedTurn),
      closingLine: HOSTILE_MARKUP,
    };
    for (const turn of [grounded, withheld, refused]) {
      const slot = render(turn, { withheldLead: HOSTILE_MARKUP });
      expect(slot.querySelectorAll("img")).toHaveLength(0);
      expect(slot.textContent).toContain(HOSTILE_MARKUP);
    }
    expect((globalThis as { __trustPwned?: unknown }).__trustPwned).toBeUndefined();
  });

  it("the error box shows its line as text", () => {
    const box = renderErrorAnswer(HOSTILE_MARKUP);
    expect(box.className).toBe("vbox vbox--error");
    expect(box.getAttribute("role")).toBe("alert");
    expect(box.textContent).toBe(HOSTILE_MARKUP);
    expect(box.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("openLinksInNewTab", () => {
  const allLinks = (): GroundedTurn => ({
    ...groundedOf("grounded"),
    explorerLink: "/explore?e=x",
    siteLinks: {
      heading: "related pages",
      items: [
        { title: "inside", url: "/notes/a" },
        { title: "listed", url: "https://repo.example/x" },
        { title: "unlisted", url: "https://elsewhere.example/y" },
      ],
    },
  });
  const base: AnswerOptions = { onWarn: () => undefined, allowedOrigins: ["https://repo.example"] };
  const anchors = (slot: HTMLElement) => [...slot.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const kinds = (slot: HTMLElement) => new Set(anchors(slot).map((a) => a.className));

  it("is off by default: no link the answer draws has a target", () => {
    const slot = render(allLinks(), base);
    expect(kinds(slot)).toEqual(new Set(["srcrow", "srcrow qsitelinks__link", "qlink"]));
    expect(anchors(slot).filter((a) => a.hasAttribute("target"))).toEqual([]);
    expect(slot.querySelector(".qlink")!.hasAttribute("rel")).toBe(false);
  });

  it("when on, the explorer link, every site link and every source open in a new tab", () => {
    const slot = render(allLinks(), { ...base, openLinksInNewTab: true });
    const links = anchors(slot);
    expect(kinds(slot)).toEqual(new Set(["srcrow", "srcrow qsitelinks__link", "qlink"]));
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    // The unlisted site link stays inert text, with no target.
    const inert = slot.querySelector(".qsitelinks__link.is-inert")!;
    expect(inert.tagName).toBe("DIV");
    expect(inert.hasAttribute("target")).toBe(false);
  });

  it("rejects a non-boolean, even on an answer with no links", () => {
    const refused = finalOf("refused-off-topic");
    expect(() => render(refused, { openLinksInNewTab: "true" as never })).toThrow(
      "openLinksInNewTab must be a boolean.",
    );
  });
});
