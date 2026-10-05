// VerdictStamp + Feedback specimen: renders the BUILT @qball-inc/elements
// ./trust atoms into preview/verdict-stamp.html. Slots with data-open start
// opened (so their shimmer has stopped); the rest are live — click them.
// Synthetic content only.
import { renderFeedback, renderVerdictStamp } from "../packages/elements/dist/trust/index.js";

const grounded = {
  verdict: "grounded",
  explanation: { claims: 6, episodes: 4, confidenceTier: "high" },
};
const withheld = { verdict: "withheld", explanation: { untraceableFigures: 2, claimsShown: 3 } };
const offTopic = { verdict: "refused", reason: "off_topic" };
const empty = { verdict: "refused", reason: "in_scope_empty" };
const abstained = { verdict: "refused", reason: "abstained" };
const long = {
  verdict: "grounded",
  explanation: { claims: 1248, episodes: 3117, confidenceTier: "medium" },
};

const log = document.getElementById("fb-log");
const feedback = (initial) => {
  const node = renderFeedback("specimen-turn", {
    initial,
    onChange: ({ value, turnRef }) => {
      if (log) log.textContent = `onChange → { value: ${String(value)}, turnRef: "${turnRef}" }`;
    },
  });
  return node;
};

const SPECIMENS = {
  grounded: () => renderVerdictStamp(grounded),
  withheld: () => renderVerdictStamp(withheld),
  "refused-off-topic": () => renderVerdictStamp(offTopic),
  "refused-empty": () => renderVerdictStamp(empty),
  "refused-abstained": () => renderVerdictStamp(abstained),
  ticker: () => renderVerdictStamp(long),
  "fb-none": () => feedback(null),
  "fb-up": () => feedback(1),
  "fb-down": () => feedback(-1),
};

for (const slot of document.querySelectorAll("[data-specimen]")) {
  const make = SPECIMENS[slot.getAttribute("data-specimen")];
  if (make === undefined)
    throw new Error(`unknown specimen "${slot.getAttribute("data-specimen")}"`);
  slot.replaceChildren(make());
  if (slot.hasAttribute("data-open")) slot.querySelector(".vstamp")?.click();
}
document.documentElement.setAttribute("data-specimens", "ready");
