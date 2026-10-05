// ClaimCard / SourceRow / ProvenanceFooter specimen: renders the BUILT
// @qball-inc/elements ./trust atoms into preview/claim-card.html, so the
// gallery shows real component output, not hand-copied markup. Every
// [data-specimen] slot in the page is filled from SPECIMENS below; the page
// shows a notice until this runs. Synthetic content only.
import {
  renderClaimCard,
  renderProvenanceFooter,
  renderReadingList,
} from "../packages/elements/dist/trust/index.js";

const source = (overrides) => ({
  episode_id: "ep-1",
  title: "Running the design-tool MCP server locally",
  url: "https://example.com/mcp-local",
  source_type: "medium",
  save_date: "2025-06-20",
  ...overrides,
});

const claim = (overrides) => ({
  claim_id: 1,
  claim_text:
    "The design tool's MCP server does not work in the browser version because it runs on the local machine.",
  confidence: 0.95,
  confidence_tier: "high",
  valid_from: "2025-06-20",
  source: source(),
  ...overrides,
});

// A consumer-supplied company badge (the site owns the real table).
const sourceBadges = { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } };

const replacement = claim({
  claim_id: 11,
  claim_text: "The MCP server is generally available and adds write access to design files.",
});
const superseded = claim({
  claim_id: 10,
  claim_text: "The MCP server requires the desktop app in beta and is limited to read access.",
  confidence: 0.9,
  valid_from: "2025-03-11",
  valid_to: "2025-06-20",
  superseded_by_claim_id: 11,
  source: source({ save_date: "2025-03-12" }),
});

const SPECIMENS = {
  "high-both": () => renderClaimCard(claim({ endorsement_tier: "owner", verification: "checked" })),
  "endorsed-only": () =>
    renderClaimCard(
      claim({
        claim_text: "A self-hosted workflow tool is enough to experiment with agents and tools.",
        endorsement_tier: "owner",
        source: source({ source_type: "substack", save_date: "2025-05-16" }),
        valid_from: "2025-05-16",
      }),
    ),
  "verified-only": () =>
    renderClaimCard(
      claim({
        claim_text: "The lab's agent guide recommends simple, composable patterns over frameworks.",
        verification: "checked",
        source: source({ source_type: "web", url: "https://www.example-lab.com/agents" }),
      }),
      { sourceBadges },
    ),
  "medium-none": () =>
    renderClaimCard(
      claim({
        claim_text: "A self-hosted workflow tool can be run for free to experiment with agents.",
        confidence: 0.82,
        confidence_tier: "medium",
        valid_from: "2025-05-16",
        source: source({ source_type: "web", url: "https://notes.example.org/n8n" }),
      }),
    ),
  "low-long": () =>
    renderClaimCard(
      claim({
        claim_text:
          "Running several concurrent coding-agent sessions against one repository is reported to work reliably as long as each session owns a separate worktree, though the reports come from a single thread rather than documentation.",
        confidence: 0.55,
        confidence_tier: "low",
        valid_from: "2025-11-02",
        source: source({ source_type: "substack", save_date: "2025-11-04" }),
      }),
    ),
  "superseded-replacement": () =>
    renderClaimCard(superseded, { replacement: { kind: "available", claim: replacement } }),
  "superseded-unavailable": () =>
    renderClaimCard(
      { ...superseded, superseded_by_claim_id: 99 },
      {
        replacement: { kind: "unavailable", claim_id: 99 },
      },
    ),
  "source-unavailable": () =>
    renderClaimCard(
      claim({
        claim_text: "A claim whose saved source record could not be resolved still renders.",
        confidence: 0.82,
        confidence_tier: "medium",
        source: { kind: "unavailable", episode_id: "ep-gone" },
      }),
    ),
  "reading-list": () =>
    renderReadingList(
      [
        source({
          episode_id: "e1",
          title: "Self-hosting a workflow tool for agent experiments",
          source_type: "substack",
          save_date: "2025-05-16",
        }),
        source({
          episode_id: "e2",
          title: "The design-tool MCP server: what works in the browser and what doesn't",
        }),
        source({
          episode_id: "e3",
          title: "Coding-agent worktrees — parallel session setup, end to end walkthrough",
          source_type: "youtube",
          save_date: "2025-11-04",
        }),
        source({
          episode_id: "e4",
          title: "modelcontextprotocol/servers",
          source_type: "github",
          url: "https://example.com/servers",
          save_date: "2025-02-08",
        }),
        source({
          episode_id: "e5",
          title: "Building effective agents",
          source_type: "web",
          url: "https://www.example-lab.com/agents",
          save_date: "2024-12-19",
        }),
        source({
          episode_id: "e6",
          title: "An unbadged blog post — no badge, never a placeholder",
          source_type: "web",
          url: "https://blog.example.org/post",
          save_date: "2024-10-02",
        }),
        source({ episode_id: "e2", title: "Duplicate of e2 — de-duplicated, not shown" }),
        { kind: "unavailable", episode_id: "e7" },
      ],
      { sourceBadges },
    ),
  "footer-answer": () =>
    renderProvenanceFooter("answer", {
      claims: 12,
      episodes: 9,
      confidenceTier: "high",
      snapshotDate: "2026-07-17",
      supersededExcluded: 2,
    }),
  "footer-panel": () =>
    renderProvenanceFooter("panel", {
      claims: 7,
      sources: 5,
      revisionDate: "2026-07-17",
      supersededShown: 1,
    }),
  "footer-singular": () =>
    renderProvenanceFooter("panel", {
      claims: 1,
      sources: 1,
      revisionDate: "2026-07-17",
      supersededShown: 0,
    }),
};

for (const slot of document.querySelectorAll("[data-specimen]")) {
  const make = SPECIMENS[slot.getAttribute("data-specimen")];
  if (make === undefined)
    throw new Error(`unknown specimen "${slot.getAttribute("data-specimen")}"`);
  slot.replaceChildren(make());
}
document.documentElement.setAttribute("data-specimens", "ready");
