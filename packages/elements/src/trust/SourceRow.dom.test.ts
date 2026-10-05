import { beforeEach, describe, expect, it } from "vitest";
import { SOURCE_UNAVAILABLE, renderReadingList, renderSourceRow } from "./SourceRow";
import {
  HOSTILE_MARKUP,
  pwned,
  resetPwned,
  settle,
  sourceRef,
  unavailableSource,
} from "./test-fixtures";

function cells(row: HTMLElement): (string | null)[] {
  return [...row.children].map((child) => child.className || null);
}

beforeEach(() => {
  document.body.replaceChildren();
  resetPwned();
});

describe("renderSourceRow", () => {
  it("renders a linked row: badge, full title, save date, ↗", () => {
    const row = renderSourceRow(sourceRef());
    expect(row.tagName).toBe("A");
    expect(row.className).toBe("srcrow");
    expect(row.getAttribute("href")).toBe("https://example.org/notes");
    expect(row.getAttribute("rel")).toBe("noopener noreferrer");
    expect(row.hasAttribute("tabindex")).toBe(false);
    expect(cells(row)).toEqual(["srcrow__mark", "srcrow__title", "srcrow__date", "srcrow__out"]);
    expect(row.querySelector(".srcrow__mark")?.textContent).toBe("GH");
    expect(row.querySelector(".srcrow__title")?.textContent).toBe(sourceRef().title);
    expect(row.querySelector(".srcrow__date")?.textContent).toBe("saved 2025-06-20");
    expect(row.querySelector(".srcrow__out")?.textContent).toBe("↗");
  });

  it("keeps the full title in the DOM (ellipsis is CSS-only)", () => {
    const title = "A very long saved title ".repeat(8).trim();
    const row = renderSourceRow(sourceRef({ title }));
    expect(row.querySelector(".srcrow__title")?.textContent).toBe(title);
    expect(row.querySelector(".srcrow__title")?.getAttribute("title")).toBe(title);
  });

  it("renders no badge for an unknown source type, keeping the title in its column", () => {
    const row = renderSourceRow(sourceRef({ source_type: "web" }));
    expect(row.querySelector(".srcrow__mark")).toBeNull();
    expect(cells(row)).toEqual([null, "srcrow__title", "srcrow__date", "srcrow__out"]);
    expect(row.firstElementChild?.textContent).toBe("");
  });

  it("uses a consumer domain badge", () => {
    const row = renderSourceRow(
      sourceRef({ source_type: "web", url: "https://example-lab.com/p" }),
      {
        sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } },
      },
    );
    expect(row.querySelector(".srcrow__mark")?.textContent).toBe("EL");
  });

  it("renders an unavailable source as an inert row", () => {
    const row = renderSourceRow(unavailableSource());
    expect(row.tagName).toBe("DIV");
    expect(row.hasAttribute("href")).toBe(false);
    expect(row.querySelector(".srcrow__title")?.textContent).toBe(SOURCE_UNAVAILABLE);
    expect(row.querySelector(".srcrow__out")).toBeNull();
  });

  it("renders markup in the title and badge as inert text", async () => {
    const row = renderSourceRow(
      sourceRef({ title: HOSTILE_MARKUP, source_type: "web", url: "https://example-lab.com/" }),
      { sourceBadges: { domains: { "example-lab.com": { mark: "<b>", label: HOSTILE_MARKUP } } } },
    );
    document.body.append(row);
    await settle();
    expect(row.querySelector("img, b")).toBeNull();
    expect(row.querySelector(".srcrow__title")?.textContent).toBe(HOSTILE_MARKUP);
    expect(row.querySelector(".srcrow__mark")?.textContent).toBe("<b>");
    expect(pwned()).toBe(false);
  });

  it.each([
    "javascript:globalThis.__trustPwned=1",
    "data:text/html,<script>globalThis.__trustPwned=1</script>",
    "vbscript:msgbox(1)",
    "//evil.example/x",
    "",
  ])("renders url %j as an inert row: no href, no ↗", async (url) => {
    const row = renderSourceRow(sourceRef({ url }));
    document.body.append(row);
    expect(row.tagName).toBe("DIV");
    expect(row.querySelector("[href]")).toBeNull();
    expect(row.hasAttribute("href")).toBe(false);
    expect(row.querySelector(".srcrow__out")).toBeNull();
    expect(row.querySelector(".srcrow__title")?.textContent).toBe(sourceRef().title);
    row.click();
    await settle();
    expect(pwned()).toBe(false);
  });
});

describe("renderReadingList", () => {
  it("renders one row per episode_id, first occurrence wins, order kept", () => {
    const list = renderReadingList([
      sourceRef({ episode_id: "ep-a", title: "First A" }),
      sourceRef({ episode_id: "ep-b", title: "B" }),
      sourceRef({ episode_id: "ep-a", title: "Second A", url: "https://example.org/other" }),
    ]);
    expect(list.className).toBe("srclist");
    const titles = [...list.querySelectorAll(".srcrow__title")].map((t) => t.textContent);
    expect(titles).toEqual(["First A", "B"]);
  });

  it("dedupes unavailable sources by episode_id but never merges id-less ones", () => {
    const list = renderReadingList([
      unavailableSource("ep-x"),
      unavailableSource("ep-x"),
      unavailableSource(null),
      unavailableSource(null),
    ]);
    expect(list.children).toHaveLength(3);
  });

  it("renders an empty list for no sources", () => {
    expect(renderReadingList([]).children).toHaveLength(0);
  });
});
