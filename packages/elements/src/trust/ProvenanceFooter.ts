// ProvenanceFooter: the always-present provenance line under every answer
// (variant "answer") and every panel view (variant "panel"). The text comes
// only from the owner-locked formatters (plus the consumer's EvidenceLabels on
// the answer variant) — this atom adds markup, never words.

import {
  LOCKED_SEPARATOR,
  answerFooter,
  panelFooter,
  type AnswerFooterInput,
  type EvidenceLabels,
  type PanelFooterInput,
} from "../locked-strings";
import { el } from "./dom";

/**
 * `<footer class="provfoot">` with the locked line; the first segment (the
 * claim count) is emphasised as in the design.
 */
export function renderProvenanceFooter(
  ...args:
    | [variant: "answer", data: AnswerFooterInput, labels: EvidenceLabels]
    | [variant: "panel", data: PanelFooterInput]
): HTMLElement {
  const text = args[0] === "answer" ? answerFooter(args[1], args[2]) : panelFooter(args[1]);
  const [first = "", ...rest] = text.split(LOCKED_SEPARATOR);
  const footer = el("footer", "provfoot");
  footer.append(el("b", undefined, first));
  if (rest.length > 0) {
    footer.append(document.createTextNode(LOCKED_SEPARATOR + rest.join(LOCKED_SEPARATOR)));
  }
  return footer;
}
