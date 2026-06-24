import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaSlot } from "./MediaSlot";
import { componentsCss, ruleBody } from "../test-utils/css-source";

/** Stub `window.matchMedia` so the reduced-motion hook reads a known value. */
function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MediaSlot — render paths (discriminated type)", () => {
  it("type='image' renders an <img> with src, alt, and loading=lazy", () => {
    const { container } = render(
      <MediaSlot type="image" src="https://example.com/a.png" alt="Mountains" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(img?.getAttribute("alt")).toBe("Mountains");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector(".media-slot")?.getAttribute("data-media-type")).toBe("image");
  });

  it("type='gif' renders an <img> tagged data-media-type='gif'", () => {
    const { container } = render(
      <MediaSlot type="gif" src="https://example.com/loop.gif" alt="Loop" />,
    );
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector(".media-slot")?.getAttribute("data-media-type")).toBe("gif");
  });

  it("lazy={false} drops loading=lazy on the <img>", () => {
    const { container } = render(
      <MediaSlot type="image" src="https://example.com/a.png" lazy={false} />,
    );
    expect(container.querySelector("img")?.getAttribute("loading")).toBeNull();
  });

  it("rejects an unsafe src (javascript:) and falls back to the empty placeholder", () => {
    const { container } = render(<MediaSlot type="image" src="javascript:alert(1)" alt="x" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".media-slot--empty")).not.toBeNull();
  });

  it("type='video' renders a muted <video> with poster + preload=none + native controls, NOT autoplaying", () => {
    const { container } = render(
      <MediaSlot type="video" src="https://example.com/v.mp4" poster="https://example.com/p.jpg" />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("poster")).toBe("https://example.com/p.jpg");
    expect(video?.preload).toBe("none");
    expect(video?.muted).toBe(true);
    expect(video?.controls).toBe(true);
    expect(video?.autoplay).toBe(false);
  });

  it("gif-as-video (autoPlay+loop+muted) drops controls, sets playsInline, and autoplays when motion is allowed", () => {
    stubReducedMotion(false);
    const { container } = render(
      <MediaSlot type="video" src="https://example.com/clip.mp4" autoPlay loop muted />,
    );
    const video = container.querySelector("video");
    expect(video?.controls).toBe(false);
    expect(video?.autoplay).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
  });

  it("suppresses gif-as-video autoplay under prefers-reduced-motion", () => {
    stubReducedMotion(true);
    const { container } = render(
      <MediaSlot type="video" src="https://example.com/clip.mp4" autoPlay loop muted />,
    );
    expect(container.querySelector("video")?.autoplay).toBe(false);
  });

  it("drops an unsafe video poster rather than emitting it as the poster attribute", () => {
    const { container } = render(
      <MediaSlot type="video" src="https://example.com/v.mp4" poster="javascript:alert(1)" />,
    );
    expect(container.querySelector("video")?.getAttribute("poster")).toBeNull();
  });
});

describe("MediaSlot — embed facade (no network until click)", () => {
  it("YouTube: shows the real maxres thumbnail + a play <button>, NO iframe until click", () => {
    const { container } = render(
      <MediaSlot type="embed" src="https://youtu.be/dQw4w9WgXcQ" alt="Rick" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const poster = container.querySelector("img.media-slot__poster");
    expect(poster?.getAttribute("src")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    );
    const play = container.querySelector("button.media-slot__play");
    expect(play).not.toBeNull();
    expect(play?.getAttribute("aria-label")).toBe("Play: Rick");
  });

  it("clicking play swaps in the real YouTube <iframe> and removes the facade", () => {
    const { container } = render(
      <MediaSlot type="embed" src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />,
    );
    fireEvent.click(container.querySelector("button.media-slot__play") as Element);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
    );
    expect(iframe?.getAttribute("allow")).toContain("fullscreen");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(container.querySelector("button.media-slot__play")).toBeNull();
  });

  it("falls the YouTube poster back from maxres to hqdefault on image error", () => {
    const { container } = render(<MediaSlot type="embed" src="https://youtu.be/dQw4w9WgXcQ" />);
    const poster = container.querySelector("img.media-slot__poster") as HTMLImageElement;
    fireEvent.error(poster);
    expect(container.querySelector("img.media-slot__poster")?.getAttribute("src")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("Vimeo uses an explicit thumbnail and the player.vimeo iframe on click", () => {
    const { container } = render(
      <MediaSlot type="embed" src="https://vimeo.com/123456789" thumbnail="https://cdn/t.jpg" />,
    );
    expect(container.querySelector("img.media-slot__poster")?.getAttribute("src")).toBe(
      "https://cdn/t.jpg",
    );
    fireEvent.click(container.querySelector("button.media-slot__play") as Element);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/123456789?autoplay=1",
    );
  });

  it("rejects a non-https embed iframe target and shows the empty placeholder", () => {
    const { container } = render(<MediaSlot type="embed" src="ftp://example.com/x" />);
    expect(container.querySelector("button.media-slot__play")).toBeNull();
    expect(container.querySelector(".media-slot--empty")).not.toBeNull();
  });

  it("drops an unsafe (javascript:) thumbnail rather than rendering it into the poster <img> (F1)", () => {
    const { container } = render(
      <MediaSlot
        type="embed"
        src="https://youtu.be/dQw4w9WgXcQ"
        thumbnail="javascript:alert(document.cookie)"
      />,
    );
    // The unsafe thumbnail must NOT reach <img src>; the play button still renders.
    expect(container.querySelector("img.media-slot__poster")).toBeNull();
    expect(container.querySelector("button.media-slot__play")).not.toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("resets the facade when src changes after activation — no <iframe> until a fresh click (F2)", () => {
    const { container, rerender } = render(
      <MediaSlot type="embed" src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />,
    );
    fireEvent.click(container.querySelector("button.media-slot__play") as Element);
    expect(container.querySelector("iframe")).not.toBeNull();
    // Swap to a different embed on the same instance.
    rerender(<MediaSlot type="embed" src="https://www.youtube.com/watch?v=oHg5SJYRHA0" />);
    // The new embed must NOT auto-load — facade is back, no iframe until re-click.
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("button.media-slot__play")).not.toBeNull();
    expect(container.querySelector("img.media-slot__poster")?.getAttribute("src")).toBe(
      "https://img.youtube.com/vi/oHg5SJYRHA0/maxresdefault.jpg",
    );
  });
});

describe("MediaSlot — art direction (shape / fit / aspect / mask)", () => {
  it("maps shape to its modifier class; circle defaults aspect-ratio to 1 / 1", () => {
    expect(
      render(<MediaSlot type="image" src="https://x/a.png" shape="rect" />).container.querySelector(
        ".media-slot",
      )?.className,
    ).toContain("media-slot--rect");
    const circle = render(
      <MediaSlot type="image" src="https://x/a.png" shape="circle" />,
    ).container.querySelector(".media-slot") as HTMLElement;
    expect(circle.className).toContain("media-slot--circle");
    expect(circle.style.getPropertyValue("--ms-aspect")).toBe("1 / 1");
  });

  it("sets --ms-radius for a rounded shape with an explicit radius", () => {
    const el = render(
      <MediaSlot type="image" src="https://x/a.png" shape="rounded" radius={20} />,
    ).container.querySelector(".media-slot") as HTMLElement;
    expect(el.style.getPropertyValue("--ms-radius")).toBe("20px");
  });

  it("mask overrides shape: applies inline clip-path and drops the shape class", () => {
    const el = render(
      <MediaSlot
        type="image"
        src="https://x/a.png"
        shape="circle"
        mask="polygon(0 0, 100% 0, 100% 100%)"
      />,
    ).container.querySelector(".media-slot") as HTMLElement;
    expect(el.className).not.toContain("media-slot--circle");
    expect(el.style.clipPath).toBe("polygon(0 0, 100% 0, 100% 100%)");
  });

  it("propagates fit / position / aspectRatio as the --ms-* custom properties", () => {
    const el = render(
      <MediaSlot
        type="image"
        src="https://x/a.png"
        fit="contain"
        position="top left"
        aspectRatio="4 / 3"
      />,
    ).container.querySelector(".media-slot") as HTMLElement;
    expect(el.style.getPropertyValue("--ms-fit")).toBe("contain");
    expect(el.style.getPropertyValue("--ms-pos")).toBe("top left");
    expect(el.style.getPropertyValue("--ms-aspect")).toBe("4 / 3");
  });
});

describe("MediaSlot — placeholder / empty state", () => {
  it("renders the default placeholder (glyph + 'No media' label) when src is absent", () => {
    const { container } = render(<MediaSlot type="image" />);
    expect(container.querySelector(".media-slot--empty")).not.toBeNull();
    const ph = container.querySelector(".media-slot__placeholder");
    expect(ph).not.toBeNull();
    expect(ph?.querySelector("svg")).not.toBeNull();
    expect(ph?.textContent).toContain("No media");
  });

  it("uses the icon-only placeholder variant (no label) for an empty circle", () => {
    const { container } = render(<MediaSlot type="image" shape="circle" />);
    const ph = container.querySelector(".media-slot__placeholder");
    expect(ph?.className).toContain("media-slot__placeholder--icon");
    expect(ph?.textContent).toBe("");
  });

  it("renders a custom placeholder ReactNode when provided", () => {
    const { container } = render(
      <MediaSlot type="image" placeholder={<span>Pick an image</span>} />,
    );
    expect(container.querySelector(".media-slot__placeholder")?.textContent).toBe("Pick an image");
  });
});

describe("MediaSlot — badge + reserved adapter + a11y", () => {
  it("renders the type badge only when `badge` is provided", () => {
    expect(
      render(<MediaSlot type="image" src="https://x/a.png" />).container.querySelector(
        ".media-slot__badge",
      ),
    ).toBeNull();
    const { container } = render(<MediaSlot type="gif" src="https://x/a.gif" badge="gif" />);
    expect(container.querySelector(".media-slot__badge")?.textContent).toBe("gif");
  });

  it("accepts the reserved `adapter` prop as a no-op (no throw, no render change)", () => {
    const withAdapter = render(
      <MediaSlot
        type="image"
        src="https://x/a.png"
        alt="A"
        adapter={{ read: () => null, write: () => null }}
      />,
    ).container.querySelector(".media-slot")?.innerHTML;
    const without = render(
      <MediaSlot type="image" src="https://x/a.png" alt="A" />,
    ).container.querySelector(".media-slot")?.innerHTML;
    expect(withAdapter).toBe(without);
  });

  it("defaults alt to '' (decorative) when not provided", () => {
    const { container } = render(<MediaSlot type="image" src="https://x/a.png" />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});

describe("MediaSlot — shipped CSS-source contracts (.media-slot* in @qball-inc/tokens)", () => {
  it("the play button sits on --color-scrim with the --color-on-scrim glyph", () => {
    const body = ruleBody(componentsCss, ".media-slot__play");
    expect(body).toContain("background: var(--color-scrim)");
    expect(body).toContain("color: var(--color-on-scrim)");
  });

  it("the frame reserves the box (aspect-ratio var) and is a query container", () => {
    const body = ruleBody(componentsCss, ".media-slot");
    expect(body).toContain("container-type: inline-size");
    expect(body).toContain("aspect-ratio: var(--ms-aspect");
    expect(body).toContain("overflow: hidden");
  });

  it("ships all four shape masks", () => {
    expect(ruleBody(componentsCss, ".media-slot--circle")).toContain("border-radius: 50%");
    expect(ruleBody(componentsCss, ".media-slot--pill")).toContain("999px");
    expect(ruleBody(componentsCss, ".media-slot--rounded")).toContain("var(--radius-md)");
    expect(ruleBody(componentsCss, ".media-slot--rect")).toContain("border-radius: 0");
  });

  it("honors prefers-reduced-motion (NFR5)", () => {
    expect(componentsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(componentsCss).toMatch(
      /\.media-slot__play,\s*\.media-slot__browse\s*\{\s*transition: none/,
    );
  });

  it("does NOT ship the preview-only stand-ins (.is-gif sheen / .media-slot__bar)", () => {
    expect(componentsCss).not.toContain("media-slot__bar");
    expect(componentsCss).not.toContain("is-gif");
  });
});
