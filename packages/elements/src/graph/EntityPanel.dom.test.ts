import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { HOSTILE_MARKUP, pwned, resetPwned, settle } from "../trust/test-fixtures";
import type { BundleNode, BundleStats, ConnectionDetail } from "../types";
import type { GraphNeighbor } from "./canvas";
import { mount, type EntityPanelOptions, type HopRequest } from "./EntityPanel";

const detailFixture = (name: string): ConnectionDetail =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), "../../fixtures/qubrain/detail", `${name}.json`), "utf8"),
  ) as ConnectionDetail;

const stats: BundleStats = {
  entities: 3,
  claims_total: 10,
  claims_valid: 9,
  claims_superseded: 1,
  episodes: 42,
  earliest_claim_date: "2026-01-01",
  latest_claim_date: "2026-07-01",
  snapshot_date: "2026-07-17",
};

const node = (id: number, name: string, extra: Partial<BundleNode> = {}): BundleNode => ({
  id,
  name,
  cls: "concept",
  eps: 1,
  aliases: [],
  ...extra,
});
const A = node(1, "alpha", {
  cls: "org",
  eps: 41,
  aliases: ["alpha inc", "a"],
  facets: { domains: ["d1", "d2"], sub_domains: ["s1", "s2", "s3", "s4"] },
});
const B = node(2, "beta", { eps: 1 });
const C = node(3, "gamma", { eps: 3 });

/** A detail callback whose responses the test resolves by hand. */
function deferredDetail() {
  const calls: {
    hop: HopRequest;
    resolve: (d: ConnectionDetail) => void;
    reject: (e: Error) => void;
  }[] = [];
  const detail = (hop: HopRequest) =>
    new Promise<ConnectionDetail>((resolve, reject) => {
      calls.push({ hop, resolve, reject });
    });
  return { calls, detail };
}

let host: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.append(host);
  resetPwned();
});

const text = (sel: string) => host.querySelector(sel)?.textContent ?? null;
const footer = () => text(".epanel__foot .provfoot");
const neverDetail = () => new Promise<ConnectionDetail>(() => undefined);
const base = (extra: Partial<EntityPanelOptions> = {}): EntityPanelOptions => ({
  stats,
  detail: neverDetail,
  ...extra,
});

describe("EntityPanel — idle", () => {
  it("shows the meta line, the idle body and a zero footer; no title unless the consumer gives one", () => {
    mount(host, base());
    expect(host.querySelector(".epanel__name")).toBeNull();
    expect(text(".epanel__head .epanel__meta")).toBe("42 episodes");
    expect(text(".epanel__scroll .epanel__empty")).toBe(
      "click an entity on the canvas to begin. click a connected entity next and this panel narrates the hop with the actual claim sentences, never bare counts.",
    );
    expect(footer()).toBe("0 claims · 0 sources · revision 2026-07-17 · 0 superseded shown");
    expect(host.querySelector(".epanel__foot b")?.textContent).toBe("0 claims");
  });

  it("uses the consumer's idle title and wording", () => {
    mount(
      host,
      base({
        labels: {
          idleTitle: "my graph",
          idleMeta: (n) => `${String(n)} notes`,
          idleBody: "pick one",
        },
      }),
    );
    expect(text(".epanel__name")).toBe("my graph");
    expect(text(".epanel__meta")).toBe("42 notes");
    expect(text(".epanel__empty")).toBe("pick one");
  });

  it("keeps the footer outside the scrolling body", () => {
    mount(host, base());
    const panel = host.querySelector(".epanel")!;
    expect([...panel.children].map((c) => c.className)).toEqual([
      "epanel__head",
      "epanel__scroll",
      "epanel__foot",
    ]);
  });
});

describe("EntityPanel — header", () => {
  it("renders crumbs, name + class, episodes + first alias and up to five tags (first in sage)", () => {
    const panel = mount(host, base());
    panel.show({ path: [B, A] });
    const crumbs = [...host.querySelectorAll<HTMLButtonElement>(".epanel__crumbs button")];
    expect(host.querySelector(".epanel__crumbs")!.getAttribute("aria-label")).toBe("click path");
    expect(crumbs.map((b) => [b.textContent, b.type, b.getAttribute("aria-current")])).toEqual([
      ["beta", "button", null],
      ["alpha", "button", "true"],
    ]);
    expect(text(".epanel__name")).toBe("alpha org");
    expect(text(".epanel__cls")).toBe("org");
    expect(text(".epanel__head .epanel__meta")).toBe("41 episodes · aka “alpha inc”");
    const tags = [...host.querySelectorAll(".epanel__tags .badge")];
    expect(tags.map((t) => [t.textContent, t.className])).toEqual([
      ["d1", "badge badge--signal"],
      ["d2", "badge"],
      ["s1", "badge"],
      ["s2", "badge"],
      ["s3", "badge"],
    ]);
  });

  it("omits the alias and tags when there are none, and uses class labels", () => {
    const panel = mount(host, base({ labels: { classes: { concept: "idea" } } }));
    panel.show({ path: [B] });
    expect(text(".epanel__head .epanel__meta")).toBe("1 episode");
    expect(host.querySelector(".epanel__tags")).toBeNull();
    expect(text(".epanel__cls")).toBe("idea");
    // One entity, no connections: the hint to pick a hop.
    expect(text(".epanel__empty")).toBe(
      "click a connected entity on the canvas, or a connection below, to narrate the hop in claims.",
    );
  });

  it("reports an earlier crumb with its index; the current crumb does nothing", () => {
    const seen: [number, string][] = [];
    const panel = mount(host, base({ onCrumb: (i, n) => seen.push([i, n.name]) }));
    panel.show({ path: [A, B, C] });
    const crumbs = [...host.querySelectorAll<HTMLButtonElement>(".epanel__crumbs button")];
    crumbs[2]!.click();
    crumbs[0]!.click();
    expect(seen).toEqual([[0, "alpha"]]);
  });
});

describe("EntityPanel — hop detail", () => {
  it("asks the callback for the last two entities, shows loading, then the asserted claims", async () => {
    const { calls, detail } = deferredDetail();
    const panel = mount(host, base({ detail }));
    panel.show({ path: [A, B] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.hop.from).toBe(A);
    expect(calls[0]!.hop.to).toBe(B);
    const loading = host.querySelector(".epanel__hop .epanel__empty")!;
    expect(loading.textContent).toBe("loading the claims…");
    expect(loading.getAttribute("role")).toBe("status");
    calls[0]!.resolve(detailFixture("typed-connection"));
    await settle();
    expect(text(".epanel__hop .epanel__hlabel")).toBe("alpha → beta · the graph asserts");
    expect(host.querySelectorAll(".epanel__hop .claim")).toHaveLength(2);
    expect(host.querySelector(".epanel__comnote")).toBeNull();
    expect(footer()).toBe("2 claims · 2 sources · revision 2026-07-17 · 0 superseded shown");
  });

  it("shows superseded claims (never hidden) and counts them in the footer", async () => {
    const panel = mount(
      host,
      base({ detail: () => Promise.resolve(detailFixture("typed-superseded-with-replacement")) }),
    );
    panel.show({ path: [A, B] });
    await settle();
    expect(host.querySelectorAll(".claim")).toHaveLength(2);
    expect(host.querySelectorAll(".claim.claim--superseded")).toHaveLength(1);
    // The replacement sentence is resolved from the hop's own claims.
    expect(host.querySelector(".claim--superseded .claim__now")?.textContent).toContain(
      detailFixture("typed-superseded-with-replacement").claims![1]!.claim_text,
    );
    expect(footer()).toBe("2 claims · 2 sources · revision 2026-07-17 · 1 superseded shown");
  });

  it("lists unavailable sources in the reading list, deduped by episode", async () => {
    const panel = mount(
      host,
      base({
        detail: () => Promise.resolve(detailFixture("typed-superseded-without-replacement")),
      }),
    );
    panel.show({ path: [A, B] });
    await settle();
    const rows = [...host.querySelectorAll(".srclist .srcrow")];
    expect(rows.length).toBe(3);
    expect(rows.filter((r) => r.textContent === "source unavailable")).toHaveLength(2);
    expect(text("section:last-child > .epanel__hlabel")).toBe("reading list");
    expect(footer()).toBe("3 claims · 3 sources · revision 2026-07-17 · 1 superseded shown");
  });

  it("dedupes the reading list across the hop's claims", async () => {
    const typed = detailFixture("typed-connection");
    const dup = { ...typed, claims: [...typed.claims!, { ...typed.claims![0]!, claim_id: 999 }] };
    const panel = mount(host, base({ detail: () => Promise.resolve(dup) }));
    panel.show({ path: [A, B] });
    await settle();
    expect(host.querySelectorAll(".claim")).toHaveLength(3);
    expect(host.querySelectorAll(".srclist .srcrow")).toHaveLength(2);
    expect(footer()).toBe("3 claims · 2 sources · revision 2026-07-17 · 0 superseded shown");
  });

  it("a co-mention hop shows the association note and its shared sources, never claim cards", async () => {
    const panel = mount(
      host,
      base({ detail: () => Promise.resolve(detailFixture("comention-connection")) }),
    );
    panel.show({ path: [A, C] });
    await settle();
    expect(text(".epanel__hop .epanel__hlabel")).toBe("alpha · gamma");
    expect(text(".epanel__comnote")).toBe(
      "no asserted relationship: these entities were discussed together in 3 sources. association, not assertion.",
    );
    expect(host.querySelector(".claim")).toBeNull();
    expect(host.querySelectorAll(".srclist .srcrow")).toHaveLength(3);
    expect(footer()).toBe("0 claims · 3 sources · revision 2026-07-17 · 0 superseded shown");
  });

  it("a rejected request shows an error with a retry that calls the callback again", async () => {
    const { calls, detail } = deferredDetail();
    const panel = mount(host, base({ detail }));
    panel.show({ path: [A, B] });
    calls[0]!.reject(new Error("offline"));
    await settle();
    const error = host.querySelector(".epanel__hop .epanel__empty")!;
    expect(error.textContent).toBe("the claims could not be loaded.");
    expect(error.getAttribute("role")).toBe("alert");
    host.querySelector<HTMLButtonElement>(".epanel__retry")!.click();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.hop.from).toBe(A);
    expect(text(".epanel__hop .epanel__empty")).toBe("loading the claims…");
    calls[1]!.resolve(detailFixture("typed-connection"));
    await settle();
    expect(host.querySelectorAll(".claim")).toHaveLength(2);
  });

  it("a malformed detail, or a callback that throws, shows the error state", async () => {
    for (const detail of [
      () => Promise.resolve({ kind: "typed", claims: [] } as ConnectionDetail),
      () => Promise.resolve({ kind: "other" } as unknown as ConnectionDetail),
      () => {
        throw new Error("sync");
      },
    ]) {
      const panel = mount(host, base({ detail }));
      panel.show({ path: [A, B] });
      await settle();
      expect(text(".epanel__hop .epanel__empty")).toBe("the claims could not be loaded.");
      panel.destroy();
    }
  });

  it("a malformed claim inside a valid answer shows the error state, warns why, and the panel keeps working", async () => {
    const typed = detailFixture("typed-connection");
    const broken = { ...typed, claims: [{ ...typed.claims![0]!, source: undefined as never }] };
    const warnings: string[] = [];
    const panel = mount(
      host,
      base({ detail: () => Promise.resolve(broken), onWarn: (m) => warnings.push(m) }),
    );
    panel.show({ path: [A, B] });
    await settle();
    expect(text(".epanel__hop .epanel__empty")).toBe("the claims could not be loaded.");
    expect(host.querySelector(".claim")).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"alpha" → "beta"');
    // Later views still render.
    panel.show({ path: [A], neighbors: [{ node: B, typed: true, weight: 1 }] });
    expect(host.querySelectorAll(".nrow")).toHaveLength(1);
  });

  it("a stale or aborted answer raises no warning", async () => {
    const { calls, detail } = deferredDetail();
    const warnings: string[] = [];
    const panel = mount(host, base({ detail, onWarn: (m) => warnings.push(m) }));
    panel.show({ path: [A, B] });
    panel.show({ path: [A, C] });
    calls[0]!.reject(new Error("aborted"));
    await settle();
    expect(warnings).toEqual([]);
  });

  it("discards a stale response: a late answer for an older hop never overwrites the newer one", async () => {
    const { calls, detail } = deferredDetail();
    const panel = mount(host, base({ detail }));
    panel.show({ path: [A, B] });
    panel.show({ path: [A, B, C] });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.hop.signal.aborted).toBe(true);
    calls[1]!.resolve(detailFixture("comention-connection"));
    await settle();
    calls[0]!.resolve(detailFixture("typed-connection")); // late, stale
    await settle();
    expect(text(".epanel__hop .epanel__hlabel")).toBe("beta · gamma");
    expect(host.querySelector(".claim")).toBeNull();
    expect(text(".epanel__name")).toBe("gamma concept");
  });

  it("re-showing the same hop (e.g. with more neighbours) does not request again", async () => {
    const { calls, detail } = deferredDetail();
    const panel = mount(host, base({ detail }));
    panel.show({ path: [A, B] });
    calls[0]!.resolve(detailFixture("typed-connection"));
    await settle();
    panel.show({ path: [A, B], neighbors: [{ node: C, typed: false, weight: 2 }], total: 1 });
    expect(calls).toHaveLength(1);
    expect(host.querySelectorAll(".claim")).toHaveLength(2);
  });

  it("returning to one entity drops the hop and its sources", async () => {
    const panel = mount(
      host,
      base({ detail: () => Promise.resolve(detailFixture("typed-connection")) }),
    );
    panel.show({ path: [A, B] });
    await settle();
    panel.show({ path: [A] });
    expect(host.querySelector(".claim, .srclist")).toBeNull();
    expect(footer()).toBe("0 claims · 0 sources · revision 2026-07-17 · 0 superseded shown");
  });
});

describe("EntityPanel — connections", () => {
  const neighbors: GraphNeighbor[] = [
    { node: B, typed: true, weight: 12 },
    { node: C, typed: false, weight: 1 },
  ];

  it("lists typed rows as claims (sage) and co-mention rows as discussed together (gray)", () => {
    const panel = mount(host, base());
    panel.show({ path: [A], neighbors, total: 5 });
    expect(text(".epanel__conns .epanel__hlabel")).toBe("connections · showing 2 of 5");
    const rows = [...host.querySelectorAll<HTMLButtonElement>(".epanel__rows .nrow")];
    expect(
      rows.map((r) => [
        r.type,
        r.querySelector(".nrow__name")?.textContent,
        r.querySelector(".nrow__kind")?.className,
        r.querySelector(".nrow__kind")?.textContent,
      ]),
    ).toEqual([
      ["button", "beta", "nrow__kind nrow__kind--typed", "12 claims"],
      ["button", "gamma", "nrow__kind nrow__kind--com", "discussed together · 1 src"],
      ["button", "show more", "nrow__kind nrow__kind--com", "3 remaining"],
    ]);
    expect(host.querySelector(".epanel__empty")).toBeNull();
  });

  it("no show-more row when every neighbour is shown", () => {
    const panel = mount(host, base());
    panel.show({ path: [A], neighbors });
    expect(host.querySelector(".nrow--more")).toBeNull();
    expect(text(".epanel__conns .epanel__hlabel")).toBe("connections · showing 2 of 2");
  });

  it("a row reports its neighbour; show more reports, and setNeighbors grows the rows in place", async () => {
    const selected: string[] = [];
    let more = 0;
    const panel = mount(
      host,
      base({
        detail: () => Promise.resolve(detailFixture("typed-connection")),
        onSelect: (n) => selected.push(n.name),
        onShowMore: () => (more += 1),
      }),
    );
    panel.show({ path: [B, A], neighbors: neighbors.slice(0, 1), total: 2 });
    await settle();
    host.querySelector<HTMLButtonElement>(".epanel__rows .nrow")!.click();
    expect(selected).toEqual(["beta"]);
    host.querySelector<HTMLButtonElement>(".nrow--more")!.click();
    expect(more).toBe(1);
    const hop = host.querySelector(".epanel__hop")!;
    const conns = host.querySelector(".epanel__conns")!;
    panel.setNeighbors(neighbors, 2);
    // Same hop and connections sections: only the rows were replaced.
    expect(host.querySelector(".epanel__hop")).toBe(hop);
    expect(host.querySelector(".epanel__conns")).toBe(conns);
    expect(host.querySelectorAll(".epanel__rows .nrow")).toHaveLength(2);
    expect(host.querySelector(".nrow--more")).toBeNull();
    expect(text(".epanel__conns .epanel__hlabel")).toBe("connections · showing 2 of 2");
  });
});

describe("EntityPanel — keyboard focus and scroll across redraws", () => {
  const neighbors: GraphNeighbor[] = [
    { node: B, typed: true, weight: 2 },
    { node: C, typed: false, weight: 1 },
  ];

  it("a row that selects its entity hands focus to the new current crumb", () => {
    const panel: ReturnType<typeof mount> = mount(
      host,
      base({ onSelect: (n) => panel.show({ path: [A, n] }) }),
    );
    panel.show({ path: [A], neighbors });
    const row = host.querySelector<HTMLButtonElement>(".epanel__rows .nrow")!;
    row.focus();
    row.click();
    const current = host.querySelector('.epanel__crumbs [aria-current="true"]');
    expect(current?.textContent).toBe("beta");
    expect(document.activeElement).toBe(current);
  });

  it("an earlier crumb hands focus to the truncated path's current crumb", () => {
    let path = [A, B, C];
    const panel: ReturnType<typeof mount> = mount(
      host,
      base({
        onCrumb: (i) => {
          path = path.slice(0, i + 1);
          panel.show({ path });
        },
      }),
    );
    panel.show({ path });
    const first = host.querySelector<HTMLButtonElement>(".epanel__crumbs button")!;
    first.focus();
    first.click();
    expect(document.activeElement?.textContent).toBe("alpha");
    expect(document.activeElement?.getAttribute("aria-current")).toBe("true");
  });

  it("show more keeps focus on show more, or the last row once everything is shown", () => {
    const panel: ReturnType<typeof mount> = mount(
      host,
      base({ onShowMore: () => panel.setNeighbors(neighbors, 2) }),
    );
    panel.show({ path: [A], neighbors: neighbors.slice(0, 1), total: 2 });
    const more = host.querySelector<HTMLButtonElement>(".nrow--more")!;
    more.focus();
    more.click();
    expect(host.querySelector(".nrow--more")).toBeNull();
    const rows = host.querySelectorAll(".epanel__rows .nrow");
    expect(document.activeElement).toBe(rows[rows.length - 1]);
  });

  it("a redraw leaves focus alone when it was outside the panel", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const panel = mount(host, base());
    panel.show({ path: [A, B] });
    expect(document.activeElement).toBe(outside);
  });

  it("a new selection starts the body at the top; the same selection keeps the scroll", () => {
    const panel = mount(host, base());
    panel.show({ path: [A], neighbors });
    const scroll = host.querySelector<HTMLElement>(".epanel__scroll")!;
    scroll.scrollTop = 40;
    panel.show({ path: [A], neighbors, total: 5 });
    expect(scroll.scrollTop).toBe(40);
    panel.show({ path: [A, B] });
    expect(scroll.scrollTop).toBe(0);
  });
});

describe("EntityPanel — stats, wording, destroy, fail fast, inert text", () => {
  it("setStats updates the revision date and idle meta", () => {
    const panel = mount(host, base());
    panel.setStats({ ...stats, episodes: 7, snapshot_date: "2026-09-01" });
    expect(text(".epanel__meta")).toBe("7 episodes");
    expect(footer()).toBe("0 claims · 0 sources · revision 2026-09-01 · 0 superseded shown");
  });

  it("idle() returns to the idle state", () => {
    const panel = mount(host, base());
    panel.show({ path: [A], neighbors: [{ node: B, typed: true, weight: 1 }] });
    panel.idle();
    expect(host.querySelector(".epanel__crumbs, .nrow")).toBeNull();
    expect(text(".epanel__empty")).toMatch(/^click an entity/);
  });

  it("takes the consumer's wording for hop, connection and list strings", async () => {
    const panel = mount(
      host,
      base({
        detail: () => Promise.resolve(detailFixture("comention-connection")),
        labels: {
          hopComention: (a, b) => `${a} + ${b}`,
          comentionNote: (n) => `${String(n)} shared`,
          connections: (s, t) => `${String(s)}/${String(t)}`,
          rowComention: (n) => `${String(n)} together`,
          readingList: "sources",
        },
      }),
    );
    panel.show({ path: [A, C], neighbors: [{ node: B, typed: false, weight: 4 }] });
    await settle();
    expect(text(".epanel__hop .epanel__hlabel")).toBe("alpha + gamma");
    expect(text(".epanel__comnote")).toBe("3 shared");
    expect(text(".epanel__conns .epanel__hlabel")).toBe("1/1");
    expect(text(".nrow__kind")).toBe("4 together");
    expect(text("section:last-child > .epanel__hlabel")).toBe("sources");
  });

  it("destroy aborts the pending request, discards its answer and removes the panel", async () => {
    const { calls, detail } = deferredDetail();
    const panel = mount(host, base({ detail }));
    panel.show({ path: [A, B] });
    panel.destroy();
    expect(calls[0]!.hop.signal.aborted).toBe(true);
    expect(host.querySelector(".epanel")).toBeNull();
    calls[0]!.resolve(detailFixture("typed-connection"));
    await settle();
    expect(host.children).toHaveLength(0);
    panel.show({ path: [A] }); // a no-op after destroy
    expect(host.children).toHaveLength(0);
  });

  it("fails fast on bad options", () => {
    expect(() => mount(host, { stats } as EntityPanelOptions)).toThrow(
      "detail must be a function.",
    );
    expect(() => mount(host, base({ onSelect: 1 as never }))).toThrow(
      "onSelect must be a function.",
    );
    expect(() => mount(host, base({ onWarn: 1 as never }))).toThrow("onWarn must be a function.");
    expect(() => mount(host, base({ labels: { nope: "x" } as never }))).toThrow(
      "labels.nope is not a known label.",
    );
    const panel = mount(host, base());
    expect(() => panel.show({ path: "x" as never })).toThrow("view.path must be an array");
    // A bad neighbour list changes nothing: the panel stays idle.
    expect(() => panel.show({ path: [A], neighbors: "x" as never })).toThrow(
      "neighbors must be an array.",
    );
    expect(host.querySelector(".epanel__crumbs")).toBeNull();
  });

  it("entity data, alias, tags and hop names stay inert text", async () => {
    const evil = node(9, HOSTILE_MARKUP, {
      cls: HOSTILE_MARKUP,
      aliases: [HOSTILE_MARKUP],
      facets: { domains: [HOSTILE_MARKUP], sub_domains: [] },
    });
    const panel = mount(
      host,
      base({ detail: () => Promise.resolve(detailFixture("comention-connection")) }),
    );
    panel.show({ path: [evil, evil], neighbors: [{ node: evil, typed: false, weight: 1 }] });
    await settle();
    expect(host.querySelector(".epanel__name")!.firstChild!.textContent).toBe(HOSTILE_MARKUP);
    expect(text(".epanel__tags .badge")).toBe(HOSTILE_MARKUP);
    expect(text(".epanel__hop .epanel__hlabel")).toBe(`${HOSTILE_MARKUP} · ${HOSTILE_MARKUP}`);
    expect(text(".nrow__name")).toBe(HOSTILE_MARKUP);
    expect(host.querySelector("img")).toBeNull();
    await settle();
    expect(pwned()).toBe(false);
  });
});

describe("EntityPanel — head action", () => {
  const action = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "hide";
    return button;
  };
  const top = () => host.querySelector(".epanel__head > .epanel__top");

  it("without one, the header has no top row (the shipped layout is unchanged)", () => {
    const panel = mount(host, base());
    panel.show({ path: [A, B] });
    expect(top()).toBeNull();
    expect(host.querySelector(".epanel__head > .epanel__crumbs")).not.toBeNull();
  });

  it("shares the top row with the idle title, or stands alone when there is none", () => {
    const hide = action();
    mount(host, base({ headAction: hide, labels: { idleTitle: "the graph" } }));
    expect([...top()!.children].map((n) => n.className)).toEqual([
      "epanel__name",
      "epanel__action",
    ]);
    expect(top()!.lastElementChild).toBe(hide);
    host.replaceChildren();
    const alone = action();
    mount(host, base({ headAction: alone }));
    expect([...top()!.children]).toEqual([alone]);
    expect(text(".epanel__head .epanel__meta")).toBe("42 episodes");
  });

  it("shares the top row with the click path; the name and meta follow below", () => {
    const hide = action();
    const panel = mount(host, base({ headAction: hide }));
    panel.show({ path: [A, B] });
    const row = top()!;
    expect(row.firstElementChild!.className).toBe("epanel__crumbs");
    expect(row.lastElementChild).toBe(hide);
    expect(row.nextElementSibling!.className).toBe("epanel__name");
  });

  it("keeps the same element and its focus across redraws, and its clicks are not panel actions", () => {
    const hide = action();
    let hides = 0;
    hide.addEventListener("click", () => (hides += 1));
    const crumbs: number[] = [];
    const selected: BundleNode[] = [];
    const panel = mount(
      host,
      base({
        headAction: hide,
        onCrumb: (i) => crumbs.push(i),
        onSelect: (n) => selected.push(n),
      }),
    );
    panel.show({ path: [A] });
    hide.focus();
    panel.show({ path: [A, B], neighbors: [{ node: C, typed: true, weight: 2 }] });
    expect(top()!.lastElementChild).toBe(hide);
    expect(document.activeElement).toBe(hide);
    panel.idle();
    expect(document.activeElement).toBe(hide);
    hide.click();
    expect(hides).toBe(1);
    expect(crumbs).toEqual([]);
    expect(selected).toEqual([]);
  });

  it("fails fast when it is not an element", () => {
    expect(() => mount(host, base({ headAction: "hide" as never }))).toThrow(
      "headAction must be an HTMLElement.",
    );
  });
});
