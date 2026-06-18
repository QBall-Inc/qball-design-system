import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { Scrim } from "./Scrim";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Scrim", () => {
  it("renders the .scrim backdrop and locks body scroll while open (AC-12)", () => {
    const { container } = render(<Scrim open />);
    expect(container.querySelector(".scrim")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("renders nothing and does not lock scroll when closed", () => {
    const { container } = render(<Scrim open={false} />);
    expect(container.querySelector(".scrim")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("restores the PRIOR overflow value when open flips to false (not merely cleared)", () => {
    document.body.style.overflow = "scroll";
    const { rerender } = render(<Scrim open />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Scrim open={false} />);
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("restores the prior overflow on unmount while still open (no leaked lock)", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(<Scrim open />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("dims with --color-scrim and stays flat — no backdrop blur (CSS-source contract)", () => {
    const body = ruleBody(componentsCss, ".scrim");
    expect(body).toContain("var(--color-scrim)");
    expect(body).toContain("position: fixed");
    expect(body).toContain("inset: 0");
    expect(body).not.toContain("backdrop-filter");
  });
});
