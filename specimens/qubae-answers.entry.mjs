// Answer-turn specimen: replays the answer fixtures through the BUILT
// @qball-inc/elements ./chat transcript into preview/qubae-answers.html — once
// inside the overlay body and once as a plain inline transcript, so both
// mounting modes show the same output. Neutral default prompts; the answer
// copy is the synthetic fixture content.
import { mount, mountTranscript } from "../packages/elements/dist/chat/index.js";
import grounded from "../fixtures/qubrain/answers/grounded.json";
import groundedLink from "../fixtures/qubrain/answers/grounded-explorer-link.json";
import groundedStructured from "../fixtures/qubrain/answers/grounded-structured.json";
import noEvidence from "../fixtures/qubrain/answers/grounded-no-evidence.json";
import withheld from "../fixtures/qubrain/answers/withheld.json";
import refusedOffTopic from "../fixtures/qubrain/answers/refused-off-topic.json";
import refusedEmpty from "../fixtures/qubrain/answers/refused-in-scope-empty.json";
import refusedAbstained from "../fixtures/qubrain/answers/refused-abstained.json";
import failed from "../fixtures/qubrain/answers/error.json";

const SCRIPTS = [
  grounded,
  groundedLink,
  withheld,
  refusedEmpty,
  refusedOffTopic,
  refusedAbstained,
  noEvidence,
  groundedStructured,
  failed,
];

let nextRef = 0;

function replay(turn, events) {
  for (const event of events) {
    if (event.op === "start") turn.start();
    else if (event.op === "appendText") turn.appendText(event.text);
    else if (event.op === "authorize") turn.authorize("grounded");
    else if (event.op === "finalize") turn.finalize(event.turn);
    else turn.fail(event.message);
  }
}

function conversation(container, onFeedback) {
  const transcript = mountTranscript(container, { onFeedback, onWarn: () => undefined });
  for (const script of SCRIPTS) {
    transcript.addUserTurn(script.question);
    nextRef += 1;
    replay(transcript.addBotTurn({ turnRef: `specimen-${String(nextRef)}` }), script.events);
  }
  transcript.addUserTurn("and one more thing");
  transcript.addNotice("one at a time. try again in a moment.");
  transcript.addNotice(
    "that’s 12 questions, the cap for one conversation.\nstart fresh and keep going, this thread stays readable.",
    { action: { label: "start fresh →", onClick: () => transcript.clear() } },
  );
  transcript.addNotice("you’ve used today’s free questions.\ncome back tomorrow.", {
    action: { label: "meanwhile, the explorer stays open →", href: "/explore" },
  });
  transcript.addNotice("the chat is resting this month.", {
    action: { label: "the explorer is fully awake →", href: "/explore" },
  });
  return transcript;
}

function thinking(container) {
  const transcript = mountTranscript(container);
  transcript.addUserTurn("what’s the current thinking on agent memory?");
  transcript.addBotTurn().start();
}

const ignore = () => undefined;

const SPECIMENS = {
  overlay: (frame) => {
    // Display only: show the open panel without the modal page lock.
    const handle = mount(frame, { hotkey: false });
    handle.overlay.classList.add("open");
    conversation(handle.body, handle.relayFeedback);
    handle.setComposerDisabled(true, "back tomorrow");
  },
  inline: (frame) => conversation(frame, ignore),
  thinking: (frame) => thinking(frame),
};

for (const frame of document.querySelectorAll("[data-specimen]")) {
  const make = SPECIMENS[frame.getAttribute("data-specimen")];
  if (make === undefined)
    throw new Error(`unknown specimen "${frame.getAttribute("data-specimen")}"`);
  make(frame);
}
document.documentElement.setAttribute("data-specimens", "ready");
