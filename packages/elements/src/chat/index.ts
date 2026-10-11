// @qball-inc/elements/chat — ask launcher, overlay and answer turns
// (Release B, WP-QB-3.1 / 3.2).
// Must never reference three.js (checked by src/entry-contents.test.ts).

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "chat" as const;

export type { ChatEventMap, ChatEventType, ChatHandle, ChatMountOptions } from "./mount";
export { isOpenHotkey, mount } from "./mount";

export type { LauncherVariant } from "./Launcher";
export { MASCOT_SVG, defaultMascot } from "./Launcher";

export type {
  BotTurnOptions,
  TranscriptHandle,
  TranscriptNoticeOptions,
  TranscriptOptions,
} from "./Transcript";
export { TRANSCRIPT_DEFAULTS, mountTranscript } from "./Transcript";

export type { AnswerFeedbackOptions, AnswerOptions } from "./AnswerBox";
export { ANSWER_DEFAULTS, renderAnswer, renderErrorAnswer } from "./AnswerBox";

export type { NoticeAction, NoticeOptions } from "./Notice";
export { renderNotice } from "./Notice";
