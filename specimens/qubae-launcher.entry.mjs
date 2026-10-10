// Ask launcher + overlay specimen: mounts the BUILT @qball-inc/elements ./chat
// entry into preview/qubae-launcher.html. One live instance owns the Q hotkey;
// the variant and open-state frames are display-only (hotkey off), so a single
// keypress never opens several overlays. Neutral default copy only.
import { mount } from "../packages/elements/dist/chat/index.js";

const notice = (handle, text) => {
  const note = document.createElement("p");
  note.className = "qnotice";
  note.textContent = `you asked “${text}”. answer turns render here — this specimen shows the launcher and overlay only.`;
  handle.body.append(note);
};

const SPECIMENS = {
  live: (frame) => mount(frame, { onAsk: (text, handle) => notice(handle, text) }),
  corner: (frame) => mount(frame, { hotkey: false }),
  "post-page": (frame) => mount(frame, { hotkey: false, variant: "post-page" }),
  "on-stage": (frame) => mount(frame, { hotkey: false, onStage: true }),
  open: (frame) => {
    // Display only: show the open panel without the modal page lock, which
    // would make this whole gallery page inert.
    const handle = mount(frame, { hotkey: false });
    handle.overlay.classList.add("open");
    return handle;
  },
};

for (const frame of document.querySelectorAll("[data-specimen]")) {
  const make = SPECIMENS[frame.getAttribute("data-specimen")];
  if (make === undefined)
    throw new Error(`unknown specimen "${frame.getAttribute("data-specimen")}"`);
  make(frame);
}
document.documentElement.setAttribute("data-specimens", "ready");
