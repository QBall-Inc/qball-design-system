import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Filter,
  Funnel,
  SearchIcon,
  TrendingUp,
  GitHub,
  LinkedIn,
  AiSparkle,
  AgentStocky,
} from "./generated";
import { Icon } from "./Icon";
import { ICON_NAMES, ICON_REGISTRY, BRAND_ICON_NAMES, BRAND_REGISTRY } from "./generated/registry";
import { icons as manifestIcons } from "./manifest.json";

interface ManifestIcon {
  name: string;
  category: string;
  alias?: string;
  exportName?: string;
  track?: string;
  source?: string;
  slug?: string;
}

/** Pull the rendered <svg> out of a container, failing loudly if none rendered. */
function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no <svg> rendered");
  return svg;
}

describe("icon — DS stroke idiom + size", () => {
  it("renders the SVG_PROPS idiom by default", () => {
    const svg = svgOf(render(<TrendingUp />).container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("class")).toBe("ic");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    // the geometry was actually emitted into the component
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("maps size -> width/height and accepts a strokeWidth override", () => {
    const svg = svgOf(render(<TrendingUp size={32} strokeWidth={2} />).container);
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
    expect(svg.getAttribute("stroke-width")).toBe("2");
  });

  it("merges className after the base ic class", () => {
    const svg = svgOf(render(<TrendingUp className="text-muted" />).container);
    expect(svg.getAttribute("class")).toBe("ic text-muted");
  });

  it("passes arbitrary svg props through (data-* + event handlers)", () => {
    let clicks = 0;
    const svg = svgOf(
      render(<TrendingUp data-testid="trend" onClick={() => (clicks += 1)} />).container,
    );
    expect(svg.getAttribute("data-testid")).toBe("trend");
    fireEvent.click(svg);
    expect(clicks).toBe(1);
  });
});

describe("icon — accessibility flip", () => {
  it("is decorative (aria-hidden, no role, no title) by default", () => {
    const svg = svgOf(render(<TrendingUp />).container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.querySelector("title")).toBeNull();
  });

  it("title -> role=img + linked <title>, drops aria-hidden", () => {
    const svg = svgOf(render(<TrendingUp title="Trending up" />).container);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    const title = svg.querySelector("title");
    expect(title?.textContent).toBe("Trending up");
    const id = title?.getAttribute("id");
    expect(id).toBeTruthy();
    expect(svg.getAttribute("aria-labelledby")).toBe(id);
  });

  it("aria-label -> role=img, drops aria-hidden, no <title>", () => {
    const svg = svgOf(render(<TrendingUp aria-label="Trending up" />).container);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe("Trending up");
    expect(svg.querySelector("title")).toBeNull();
  });

  it("the computed a11y invariant wins over a conflicting passthrough", () => {
    // A consumer passing aria-hidden alongside a title must NOT produce the
    // contradictory role="img" + aria-hidden="true" state (§9); the component's
    // computed a11y is authoritative (rest is spread before it).
    const svg = svgOf(render(<TrendingUp title="Up" aria-hidden />).container);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });
});

describe("icon — registry, alias, and collision override", () => {
  it("<Icon name> renders the same geometry as the named export", () => {
    const named = svgOf(render(<TrendingUp />).container).innerHTML;
    const dynamic = svgOf(render(<Icon name="trending-up" />).container).innerHTML;
    expect(dynamic).toBe(named);
  });

  it("the alias name + alias export both resolve to the canonical glyph", () => {
    const canonical = svgOf(render(<Funnel />).container).innerHTML;
    expect(svgOf(render(<Filter />).container).innerHTML).toBe(canonical);
    expect(svgOf(render(<Icon name="filter" />).container).innerHTML).toBe(canonical);
    expect(svgOf(render(<Icon name="funnel" />).container).innerHTML).toBe(canonical);
  });

  it("the search collision override exports as SearchIcon + keys as 'search'", () => {
    const named = svgOf(render(<SearchIcon />).container).innerHTML;
    expect(svgOf(render(<Icon name="search" />).container).innerHTML).toBe(named);
  });
});

describe("icon — manifest ↔ registry contract", () => {
  const all = manifestIcons as ManifestIcon[];
  // AC-4: the UI + AI tracks own the <Icon name> registry + IconName; the brand
  // track has its own BrandIconName union (a missing track defaults to ui).
  const iconEntries = all.filter(
    (i) => i.track === undefined || i.track === "ui" || i.track === "ai",
  );
  const brandEntries = all.filter((i) => i.track === "brand");

  const expectedIcons = new Set<string>();
  for (const icon of iconEntries) {
    expectedIcons.add(icon.name);
    if (icon.alias) expectedIcons.add(icon.alias);
  }
  const expectedBrands = new Set(brandEntries.map((i) => i.name));

  it("ICON_NAMES is exactly the UI+AI manifest set (canonical + aliases), no missing/extra/dupes", () => {
    expect(new Set(ICON_NAMES)).toEqual(expectedIcons);
    expect(ICON_NAMES.length).toBe(expectedIcons.size);
  });

  it("ICON_REGISTRY keys are exactly the UI+AI manifest set", () => {
    expect(new Set(Object.keys(ICON_REGISTRY))).toEqual(expectedIcons);
  });

  it("BRAND_ICON_NAMES + BRAND_REGISTRY are exactly the brand manifest set", () => {
    expect(new Set(BRAND_ICON_NAMES)).toEqual(expectedBrands);
    expect(BRAND_ICON_NAMES.length).toBe(expectedBrands.size);
    expect(new Set(Object.keys(BRAND_REGISTRY))).toEqual(expectedBrands);
  });

  it("brand names are disjoint from the icon registry (AC-4 — logos are not icons)", () => {
    for (const b of BRAND_ICON_NAMES) expect(ICON_NAMES as readonly string[]).not.toContain(b);
    // the brand `x-twitter` does NOT collide with the UI close `x`.
    expect(BRAND_ICON_NAMES as readonly string[]).toContain("x-twitter");
    expect(ICON_NAMES as readonly string[]).toContain("x");
  });

  it("every registered icon name renders a real 24-viewBox <svg>", () => {
    for (const name of ICON_NAMES) {
      const svg = svgOf(render(<Icon name={name} />).container);
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    }
  });

  it("every brand mark renders a real 24-viewBox <svg>", () => {
    for (const name of BRAND_ICON_NAMES) {
      const Mark = BRAND_REGISTRY[name];
      const svg = svgOf(render(<Mark />).container);
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    }
  });
});

describe("icon — track idioms (stroke UI/AI vs filled brand)", () => {
  it("a codegen brand mark (github) is filled with currentColor, not stroked", () => {
    const svg = svgOf(render(<GitHub />).container);
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("stroke")).toBeNull();
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("the in-repo linkedin mark keeps the stroke idiom (fill=none, stroke=currentColor)", () => {
    const svg = svgOf(render(<LinkedIn />).container);
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
  });

  it("the AI track renders in the stroke idiom: ai-sparkle (codegen) + agent-stocky (original art)", () => {
    for (const node of [<AiSparkle />, <AgentStocky />]) {
      const svg = svgOf(render(node).container);
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    }
  });
});
