// ProvenanceFooter: the always-present provenance line under every answer
// (variant "answer") and every panel view (variant "panel"). The text comes
// only from the owner-locked formatters — this atom adds markup, never words.

import {
  LOCKED_SEPARATOR,
  answerFooter,
  panelFooter,
  type AnswerFooterInput,
  type PanelFooterInput,
} from "../locked-strings";
import { el } from "./dom";

/**
 * `<footer class="provfoot">` with the locked line; the first segment (the
 * claim count) is emphasised as in the design.
 */
export function renderProvenanceFooter(
  ...args: [variant: "answer", data: AnswerFooterInput] | [variant: "panel", data: PanelFooterInput]
): HTMLElement {
  const [variant, data] = args;
  const text = variant === "answer" ? answerFooter(data) : panelFooter(data);
  const [first = "", ...rest] = text.split(LOCKED_SEPARATOR);
  const footer = el("footer", "provfoot");
  footer.append(el("b", undefined, first));
  if (rest.length > 0) {
    footer.append(document.createTextNode(LOCKED_SEPARATOR + rest.join(LOCKED_SEPARATOR)));
  }
  return footer;
}
