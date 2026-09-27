// @qball-inc/elements — core entry ('.'). Types, the data contract and the
// adapter land here (WP-QB-0.2). Zero DOM: this entry must stay importable in
// a DOM-less SSG build (plan AD-6).

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "core" as const;
