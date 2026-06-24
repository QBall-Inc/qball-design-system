// @vitest-environment node
// MediaSlot must be SSR/static-safe (the Astro static consumer): no window/document/
// customElements access at module-eval OR render. Proven by importing + rendering to
// static markup in a real node env where those globals do not exist. (Per the
// icons/tree-shake.test.ts node-env precedent; resolves disk paths via process.cwd().)
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MediaSlot } from "./MediaSlot";

describe("MediaSlot — SSR / static-safety (node env, no DOM globals)", () => {
  it("has no window/document in the node test env (the SSR target)", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("renders an image slot to static markup without touching a DOM global", () => {
    const html = renderToStaticMarkup(
      <MediaSlot type="image" src="https://example.com/a.png" alt="A" aspectRatio="16 / 9" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("media-slot--rounded");
    expect(html).toContain('loading="lazy"');
  });

  it("emits semantic <video poster preload=none> markup on the server", () => {
    const html = renderToStaticMarkup(
      <MediaSlot type="video" src="https://example.com/v.mp4" poster="https://example.com/p.jpg" />,
    );
    expect(html).toContain("<video");
    expect(html).toContain('preload="none"');
    expect(html).toContain('poster="https://example.com/p.jpg"');
  });

  it("renders the embed FACADE (thumbnail + play button) with NO <iframe> on the server (no network until click)", () => {
    const html = renderToStaticMarkup(
      <MediaSlot type="embed" src="https://youtu.be/dQw4w9WgXcQ" alt="V" />,
    );
    expect(html).toContain("media-slot__play");
    expect(html).toContain("img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    expect(html).not.toContain("<iframe");
  });

  it("renders the empty placeholder when src is absent", () => {
    const html = renderToStaticMarkup(<MediaSlot type="image" />);
    expect(html).toContain("media-slot--empty");
    expect(html).toContain("No media");
  });
});
