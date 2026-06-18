import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppBar, NotificationBell } from "./AppBar";

describe("NotificationBell", () => {
  it("renders the .badge-count overlay with the count when unreadCount >= 1 (AC-4)", () => {
    const { container } = render(<NotificationBell unreadCount={3} />);
    const badge = container.querySelector(".badge-count");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("3");
  });

  it("omits the badge when unreadCount is 0 or undefined (AC-4)", () => {
    const { container, rerender } = render(<NotificationBell unreadCount={0} />);
    expect(container.querySelector(".badge-count")).toBeNull();
    rerender(<NotificationBell />);
    expect(container.querySelector(".badge-count")).toBeNull();
  });
});

describe("AppBar", () => {
  it("renders the four slot regions painted with the shipped classes (AC-1)", () => {
    const { container } = render(
      <AppBar
        brand={<span>Stocky</span>}
        nav={<a href="#">Watchlist</a>}
        actions={<NotificationBell unreadCount={2} />}
      />,
    );
    expect(container.querySelector(".appbar")).not.toBeNull();
    expect(container.querySelector(".appbar__brand")?.textContent).toBe("Stocky");
    expect(container.querySelector("nav.appnav")).not.toBeNull();
    expect(container.querySelector(".appbar__spacer")).not.toBeNull();
    expect(container.querySelector(".appbar__right .badge-count")?.textContent).toBe("2");
  });

  it("is a plain in-flow bar by default (no floating/position, not hidden)", () => {
    const { container } = render(<AppBar brand="X" />);
    const bar = container.querySelector(".appbar") as HTMLElement;
    expect(bar.style.position).toBe("");
    expect(bar.dataset["hidden"]).toBeUndefined();
  });

  it("floating applies the glass overlay style (position + z-index + transition)", () => {
    const { container } = render(<AppBar brand="X" floating />);
    const bar = container.querySelector(".appbar") as HTMLElement;
    expect(bar.style.position).toBe("absolute");
    expect(bar.style.zIndex).toBe("30");
    expect(bar.style.transition).toContain("transform");
  });

  it("hidden prop applies the prototype hide transform (translateY + fade)", () => {
    const { container } = render(<AppBar brand="X" floating hidden />);
    const bar = container.querySelector(".appbar") as HTMLElement;
    expect(bar.dataset["hidden"]).toBe("true");
    expect(bar.style.transform).toContain("translateY(-130%)");
    expect(bar.style.opacity).toBe("0");
  });

  it("hideOnScroll hides while scrolling, springs back after 220ms, and removes the listener on unmount (no leak)", () => {
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { container, unmount } = render(<AppBar brand="X" hideOnScroll />);
    const bar = container.querySelector(".appbar") as HTMLElement;

    // a real scroll listener was attached to the (default window) scroll source
    expect(addSpy.mock.calls.map((c) => c[0])).toContain("scroll");
    expect(bar.dataset["hidden"]).toBeUndefined();

    // scrolling hides the bar...
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(bar.dataset["hidden"]).toBe("true");

    // ...and it springs back 220ms after scroll stops
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(bar.dataset["hidden"]).toBeUndefined();

    unmount();
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain("scroll");

    addSpy.mockRestore();
    removeSpy.mockRestore();
    vi.useRealTimers();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
