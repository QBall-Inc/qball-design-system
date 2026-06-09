import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Surface } from "./Surface";

describe("Surface (build-harness smoke)", () => {
  it("renders children into a token-styled div in a real DOM", () => {
    const { getByText } = render(<Surface>hello</Surface>);
    const el = getByText("hello");

    // Observable output: rendered as a <div> carrying the token-driven styles
    // (proves the JSX transform, DOM lib, and token-only styling all wired).
    expect(el.tagName).toBe("DIV");
    expect(el.style.background).toBe("var(--bg-surface)");
    expect(el.style.color).toBe("var(--text-primary)");
  });
});
