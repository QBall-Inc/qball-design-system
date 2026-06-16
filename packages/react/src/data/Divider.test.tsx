import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Divider } from "./Divider";

describe("Divider", () => {
  it("renders an <hr> separator carrying the shipped .rule class (AC-12k)", () => {
    const { container } = render(<Divider />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
    expect(hr?.className.split(" ")).toContain("rule");
    // <hr> has an implicit separator role, announced to assistive tech.
    expect(screen.getByRole("separator")).not.toBeNull();
  });

  it("merges a consumer className onto the .rule separator", () => {
    const { container } = render(<Divider className="my-gap" />);
    const classes = container.querySelector("hr")?.className.split(" ") ?? [];
    expect(classes).toContain("rule");
    expect(classes).toContain("my-gap");
  });

  it("passes through DOM attributes", () => {
    const { container } = render(<Divider data-testid="sep" aria-label="section break" />);
    const hr = container.querySelector("hr");
    expect(hr?.getAttribute("data-testid")).toBe("sep");
    expect(hr?.getAttribute("aria-label")).toBe("section break");
  });
});
