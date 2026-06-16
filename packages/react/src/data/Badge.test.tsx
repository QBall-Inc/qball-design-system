import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, type BadgeVariant } from "./Badge";

describe("Badge", () => {
  // variant -> the shipped class the component must apply (neutral = base, no modifier).
  const semantic: { variant: BadgeVariant; modifier: string | null }[] = [
    { variant: "neutral", modifier: null },
    { variant: "info", modifier: "badge--info" },
    { variant: "success", modifier: "badge--success" },
    { variant: "warning", modifier: "badge--warn" },
    { variant: "error", modifier: "badge--error" },
  ];

  it.each(semantic)(
    "renders the $variant semantic variant on the shipped .badge class (AC-12f)",
    ({ variant, modifier }) => {
      const { container } = render(<Badge variant={variant}>label</Badge>);
      const badge = container.querySelector(".badge");
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain("label");
      const classes = badge?.className.split(" ") ?? [];
      if (modifier) {
        expect(classes).toContain(modifier);
      } else {
        // neutral is the bare base .badge — no --* modifier.
        expect(classes.filter((c) => c.startsWith("badge--"))).toHaveLength(0);
      }
    },
  );

  it("includes the ▲ non-color cue on the finance 'up' variant (AC-12g/FR4)", () => {
    const { container } = render(<Badge variant="up">+2.4%</Badge>);
    const badge = container.querySelector(".badge");
    expect(badge?.className.split(" ")).toContain("badge--up");
    expect(badge?.textContent).toContain("▲");
    expect(badge?.textContent).toContain("+2.4%");
  });

  it("includes the ▼ cue on 'down' and the — cue on 'flat'", () => {
    const down = render(<Badge variant="down">loss</Badge>);
    expect(down.container.querySelector(".badge--down")?.textContent).toContain("▼");
    const flat = render(<Badge variant="flat">flat</Badge>);
    expect(flat.container.querySelector(".badge--flat")?.textContent).toContain("—");
  });

  it("renders no finance cue on semantic variants", () => {
    const { container } = render(<Badge variant="success">done</Badge>);
    const text = container.querySelector(".badge")?.textContent ?? "";
    expect(text).toBe("done");
    expect(text).not.toContain("▲");
  });

  it("renders the optional status dot", () => {
    const { container } = render(<Badge dot>live</Badge>);
    expect(container.querySelector(".badge__dot")).not.toBeNull();
  });

  it("omits the dot by default", () => {
    const { container } = render(<Badge>live</Badge>);
    expect(container.querySelector(".badge__dot")).toBeNull();
  });
});
