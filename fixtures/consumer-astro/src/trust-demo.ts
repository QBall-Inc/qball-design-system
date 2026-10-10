// Client script for the consumer pages: fills every [data-atom] slot from the
// PACKED @qball-inc/elements/trust build, then runs the hostile-payload check.
// Synthetic content only; company badges use reserved example domains.
import type { Claim, SourceRef } from "@qball-inc/elements";
import {
  renderClaimCard,
  renderFeedback,
  renderProvenanceFooter,
  renderReadingList,
  renderSourceRow,
  renderVerdictStamp,
} from "@qball-inc/elements/trust";

interface HostileResult {
  controlFired: number;
  fired: number;
  imgs: number;
  hrefs: (string | null)[];
  hostileTextShown: boolean;
}

declare global {
  interface Window {
    __pwned?: number;
    __trust?: { ok: true; hostile: HostileResult } | { ok: false; error: string };
  }
}

const source = (overrides: Partial<SourceRef> = {}): SourceRef => ({
  episode_id: "ep-1",
  title: "Running a design-tool server locally",
  url: "https://example.com/local-server",
  source_type: "github",
  save_date: "2025-06-20",
  ...overrides,
});

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  claim_id: 1,
  claim_text: "The server runs on the local machine, so the browser version cannot reach it.",
  confidence: 0.95,
  confidence_tier: "high",
  valid_from: "2025-06-20",
  source: source(),
  ...overrides,
});

// Consumer-supplied company badge, matched on the URL host.
const sourceBadges = { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } };

const replacement = claim({ claim_id: 11, claim_text: "The server is generally available." });
const superseded = claim({
  claim_id: 10,
  claim_text: "The server needs the desktop beta and is read-only.",
  confidence: 0.9,
  valid_from: "2025-03-11",
  valid_to: "2025-06-20",
  superseded_by_claim_id: 11,
});

function slot(name: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-atom="${name}"]`);
  if (node === null) throw new Error(`missing slot [data-atom="${name}"]`);
  return node;
}

function renderClaims(): void {
  slot("claim-high-both").append(
    renderClaimCard(claim({ endorsement_tier: "owner", verification: "checked" })),
  );
  slot("claim-endorsed-only").append(renderClaimCard(claim({ endorsement_tier: "owner" })));
  slot("claim-verified-only").append(renderClaimCard(claim({ verification: "checked" })));
  slot("claim-medium-none").append(
    renderClaimCard(claim({ confidence: 0.8, confidence_tier: "medium" })),
  );
  slot("claim-low").append(renderClaimCard(claim({ confidence: 0.5, confidence_tier: "low" })));
  slot("claim-superseded-replacement").append(
    renderClaimCard(superseded, { replacement: { kind: "available", claim: replacement } }),
  );
  slot("claim-superseded-unavailable").append(
    renderClaimCard(
      { ...superseded, superseded_by_claim_id: 99 },
      { replacement: { kind: "unavailable", claim_id: 99 } },
    ),
  );
  slot("claim-company-badge").append(
    renderClaimCard(
      claim({ source: source({ source_type: "web", url: "https://www.example-lab.com/agents" }) }),
      { sourceBadges },
    ),
  );
  slot("claim-no-badge").append(
    renderClaimCard(
      claim({ source: source({ source_type: "web", url: "https://blog.example.org/post" }) }),
      { sourceBadges },
    ),
  );
}

function renderSourcesAndFooters(): void {
  slot("reading-list").append(
    renderReadingList(
      [
        source({ episode_id: "e1" }),
        source({ episode_id: "e2", source_type: "web", url: "https://www.example-lab.com/a" }),
        source({ episode_id: "e3", source_type: "web", url: "https://blog.example.org/b" }),
        { kind: "unavailable", episode_id: "e4" },
      ],
      { sourceBadges },
    ),
  );
  slot("footer-answer").append(
    renderProvenanceFooter("answer", {
      claims: 12,
      episodes: 9,
      confidenceTier: "high",
      snapshotDate: "2026-07-17",
      supersededExcluded: 2,
    }),
  );
  slot("footer-panel").append(
    renderProvenanceFooter("panel", {
      claims: 7,
      sources: 5,
      revisionDate: "2026-07-17",
      supersededShown: 1,
    }),
  );
}

function renderStampsAndFeedback(): void {
  const onOpen = (row: HTMLElement): void => {
    const host = row.closest<HTMLElement>("[data-atom]");
    if (host !== null) host.dataset["opened"] = String(Number(host.dataset["opened"] ?? 0) + 1);
  };
  slot("stamp-grounded").append(
    renderVerdictStamp(
      { verdict: "grounded", explanation: { claims: 6, episodes: 4, confidenceTier: "high" } },
      { onOpen },
    ),
  );
  slot("stamp-withheld").append(
    renderVerdictStamp(
      { verdict: "withheld", explanation: { untraceableFigures: 2, claimsShown: 3 } },
      { onOpen },
    ),
  );
  slot("stamp-refused").append(
    renderVerdictStamp({ verdict: "refused", reason: "off_topic" }, { onOpen }),
  );

  const feedback = slot("feedback");
  feedback.append(
    renderFeedback("consumer-turn", {
      initial: null,
      onChange: ({ value, turnRef }) => {
        feedback.dataset["change"] = `${String(value)}:${turnRef}`;
      },
    }),
  );
}

// Hostile payloads: an inline-handler image and a javascript: URL. The image
// fails to decode without a network request, so a firing control leaves no
// console noise behind.
const HOSTILE =
  '<img src="data:image/png;base64,AAAA" onerror="window.__pwned = (window.__pwned || 0) + 1">';
const JS_URL = "javascript:window.__pwned=(window.__pwned||0)+1";
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Positive control: the same payloads injected unsafely must fire, otherwise
// "nothing fired" below would prove nothing.
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

async function hostile(): Promise<Omit<HostileResult, "controlFired">> {
  const out = slot("hostile");
  const bad = source({ title: HOSTILE, url: JS_URL, source_type: "web" });
  out.append(
    renderClaimCard(claim({ claim_text: HOSTILE, source: bad }), { sourceBadges }),
    renderSourceRow(bad),
  );
  for (const node of out.querySelectorAll<HTMLElement>(".claim__src, .srcrow")) node.click();
  await wait(400);
  return {
    fired: window.__pwned ?? 0,
    imgs: out.querySelectorAll("img").length,
    hrefs: [...out.querySelectorAll("[href]")].map((n) => n.getAttribute("href")),
    hostileTextShown: (out.textContent ?? "").includes(HOSTILE),
  };
}

async function main(): Promise<void> {
  try {
    renderClaims();
    renderSourcesAndFooters();
    renderStampsAndFeedback();
    const controlFired = await controls();
    window.__trust = { ok: true, hostile: { controlFired, ...(await hostile()) } };
  } catch (err) {
    window.__trust = { ok: false, error: String(err) };
  }
}

void main();
