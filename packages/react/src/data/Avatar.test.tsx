import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, AvatarGroup } from "./Avatar";

describe("Avatar", () => {
  it("image mode renders an <img> with the given alt and src", () => {
    const { container } = render(<Avatar src="https://example.com/a.png" alt="Ada Lovelace" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("Ada Lovelace");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
  });

  it("rejects an unsafe (non-image data:) src and falls back to initials", () => {
    const { container } = render(<Avatar src="data:text/html,<x>" name="Ada Lovelace" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar")?.textContent).toBe("AL");
  });

  it("allows a data:image/ src", () => {
    const { container } = render(<Avatar src="data:image/png;base64,iVBORw0=" alt="dot" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("falls back to initials when the image fails to load", () => {
    const { container } = render(<Avatar src="https://bad.example/x.png" name="Ashay Kubal" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar")?.textContent).toBe("AK");
  });

  it("initials mode derives up to two initials from the name", () => {
    const { container } = render(<Avatar name="Ashay Kubal" />);
    expect(container.querySelector(".avatar")?.textContent).toBe("AK");
  });

  it("derives a single initial for a one-word name", () => {
    const { container } = render(<Avatar name="Madonna" />);
    expect(container.querySelector(".avatar")?.textContent).toBe("M");
  });

  it("renders the status dot when status is set (variant class) and omits it otherwise", () => {
    const withStatus = render(<Avatar name="A K" status="busy" />);
    const dot = withStatus.container.querySelector(".avatar__status");
    expect(dot).not.toBeNull();
    expect(dot?.classList.contains("avatar__status--busy")).toBe(true);

    const without = render(<Avatar name="A K" />);
    expect(without.container.querySelector(".avatar__status")).toBeNull();
  });

  it("uses base .avatar__status (no variant) for online", () => {
    const { container } = render(<Avatar name="A K" status="online" />);
    const dot = container.querySelector(".avatar__status");
    expect(dot).not.toBeNull();
    expect(dot?.className.trim()).toBe("avatar__status");
  });

  it("maps each size to its shipped class, with md = the base .avatar (no modifier)", () => {
    expect(
      render(<Avatar name="A" size="sm" />).container.querySelector(".avatar")?.className,
    ).toContain("avatar--sm");
    expect(
      render(<Avatar name="A" size="lg" />).container.querySelector(".avatar")?.className,
    ).toContain("avatar--lg");
    const md =
      render(<Avatar name="A" size="md" />).container.querySelector(".avatar")?.className ?? "";
    expect(md.split(" ")).toContain("avatar");
    expect(md).not.toContain("avatar--");
  });

  it("assigns a deterministic token tile color (same name → same tile, no hex)", () => {
    const a = render(<Avatar name="Grace Hopper" />)
      .container.querySelector(".avatar")
      ?.getAttribute("style");
    const b = render(<Avatar name="Grace Hopper" />)
      .container.querySelector(".avatar")
      ?.getAttribute("style");
    expect(a).toBe(b);
    expect(a).toMatch(/var\(--/);
    expect(a).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("labels the initials tile with the name (role=img) for screen readers", () => {
    const { container } = render(<Avatar name="Ashay Kubal" status="online" />);
    const tile = container.querySelector(".avatar");
    expect(tile?.getAttribute("role")).toBe("img");
    expect(tile?.getAttribute("aria-label")).toBe("Ashay Kubal (online)");
  });
});

describe("AvatarGroup", () => {
  it("caps visible avatars at max and renders a +N overflow tile", () => {
    const { container } = render(
      <AvatarGroup max={3}>
        <Avatar name="A B" />
        <Avatar name="C D" />
        <Avatar name="E F" />
        <Avatar name="G H" />
        <Avatar name="I J" />
      </AvatarGroup>,
    );
    // 3 visible + 1 overflow tile = 4 direct .avatar children.
    expect(container.querySelectorAll(".avatar-group > .avatar").length).toBe(4);
    const overflowTile = Array.from(container.querySelectorAll(".avatar-group > .avatar")).find(
      (el) => el.textContent === "+2",
    );
    expect(overflowTile).not.toBeUndefined();
    // The +N tile is announced (role="img" so the aria-label is read).
    expect(overflowTile?.getAttribute("role")).toBe("img");
    expect(overflowTile?.getAttribute("aria-label")).toBe("2 more");
  });

  it("renders no overflow tile when at or under the max", () => {
    const { container } = render(
      <AvatarGroup max={3}>
        <Avatar name="A B" />
        <Avatar name="C D" />
      </AvatarGroup>,
    );
    expect(container.querySelectorAll(".avatar-group > .avatar").length).toBe(2);
    expect(container.querySelector(".avatar-group")?.textContent).not.toContain("+");
  });
});
