# Trademark & Brand-Mark Notice (`@qball-inc/react` icon system — brand track)

The **brand track** of the `@qball-inc/react` icon system ships a small set of
third-party **brand marks** (logos / wordmarks) for **nominative use only** — i.e.
to **identify or point to** the firm or product a UI element refers to (for example,
a "Sign in with Google" affordance, an "OpenAI-compatible endpoint" label, or a link
to a LinkedIn profile).

These marks are **the trademarks of their respective owners**. They are reproduced
here **for identification purposes only**. Their inclusion does **not** indicate any
affiliation with, sponsorship by, or endorsement by the trademark owner. They are
**not** the branding of `@qball-inc/react`, Qball Inc., or this design system, and
must not be used to imply such a relationship.

If you are a trademark owner and would like a mark adjusted or removed, please open
an issue.

## What this is NOT

The UI and AI tracks (`IconName` / the `<Icon name>` registry) are the design
system's own iconography and are unaffected by this notice. Only the **brand track**
(`BrandIconName` — the named exports listed below) carries third-party marks.

## Source & license per mark

| Source                                                                  | License                | Marks                                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [simple-icons](https://github.com/simple-icons/simple-icons) (v16.24.0) | CC0-1.0                | github, npm, figma, notion, vercel, chromestore, linear, x-twitter, youtube, google, reddit, anthropic, claude, gemini, deepseek, moonshot, mistral, perplexity, huggingface, ollama, qwen, meta |
| Owner-supplied asset                                                    | trademark of its owner | openai, glm                                                                                                                                                                                      |
| In-repo glyph (stroke idiom)                                            | trademark of its owner | linkedin                                                                                                                                                                                         |
| VSCodium stand-in                                                       | trademark of its owner | vscode                                                                                                                                                                                           |

Notes:

- The marks sourced from **simple-icons** are distributed by that project under
  **CC0-1.0** (public-domain dedication of the SVG path data); the underlying
  **trademarks remain owned by their respective holders** and are used nominatively.
- `openai` and `glm` are **not** in CC0 sets (withheld by their owners); they are
  owner-supplied assets, normalized to `currentColor`, reproduced nominatively.
- `linkedin` is carried as a generic stroke glyph (Lucide removed its brand icons);
  `vscode` is shown as a **VSCodium** stand-in because the VS Code mark is withheld
  from CC0 sets. Swap in an official asset where one is licensed.

The generated brand components each carry a provenance header citing their exact
source pack + SPDX identifier; the net-new `spdx-check` CI gate asserts this.
