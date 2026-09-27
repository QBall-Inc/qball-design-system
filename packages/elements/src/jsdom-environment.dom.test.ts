// Harness guard for the jsdom project (plan AD-7): proves `*.dom.test.ts` files
// really run with a DOM, so future renderer tests cannot silently land in the
// DOM-less node project. Replaced in spirit by real renderer tests from WP-QB-1.1.
import { describe, expect, it } from "vitest";

describe("jsdom project", () => {
  it("provides a working DOM to *.dom.test.ts files", () => {
    const el = document.createElement("div");
    el.textContent = "claim";
    document.body.append(el);
    expect(document.body.textContent).toBe("claim");
    el.remove();
  });
});
