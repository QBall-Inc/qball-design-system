import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, type ButtonVariant } from "./Button";

describe("Button", () => {
  it("renders each color variant with its shipped .btn--{variant} class on a <button>", () => {
    const variants: ButtonVariant[] = ["primary", "secondary", "tertiary", "ghost", "destructive"];
    for (const variant of variants) {
      const { getByRole, unmount } = render(<Button variant={variant}>Label</Button>);
      const btn = getByRole("button");
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.className.split(" ")).toContain("btn");
      expect(btn.className.split(" ")).toContain(`btn--${variant}`);
      unmount();
    }
  });

  it("defaults to variant=primary and type=button", () => {
    const { getByRole } = render(<Button>Save</Button>);
    const btn = getByRole("button");
    expect(btn.className.split(" ")).toContain("btn--primary");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("layers the icon modifier (.btn--icon) and passes aria-label through", () => {
    const { getByRole } = render(
      <Button variant="ghost" icon aria-label="Close">
        <svg />
      </Button>,
    );
    const btn = getByRole("button", { name: "Close" });
    expect(btn.className.split(" ")).toContain("btn--icon");
    expect(btn.className.split(" ")).toContain("btn--ghost");
  });

  it("loading sets .btn--loading, aria-busy, and disables the button", () => {
    const { getByRole } = render(
      <Button loading>
        <span>Saving</span>
      </Button>,
    );
    const btn = getByRole("button");
    expect(btn.className.split(" ")).toContain("btn--loading");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disabled blocks interaction (no click dispatched to a disabled button)", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button disabled onClick={onClick}>
        x
      </Button>,
    );
    const btn = getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>x</Button>);
    fireEvent.click(getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("asChild renders the child element (an <a>) with the .btn classes merged and href/rel/target passed through", () => {
    const { getByRole } = render(
      <Button variant="primary" asChild>
        <a href="https://example.test/post" rel="noopener noreferrer" target="_blank">
          Read the post
        </a>
      </Button>,
    );
    const link = getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.test/post");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.className.split(" ")).toContain("btn");
    expect(link.className.split(" ")).toContain("btn--primary");
  });
});
