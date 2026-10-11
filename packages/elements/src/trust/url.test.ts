import { describe, expect, it } from "vitest";
import { safeInternalUrl } from "./url";

describe("safeInternalUrl (AD-4 internal-link policy)", () => {
  it.each([
    ["/explore", "/explore"],
    ["/explore?e=agent-memory", "/explore?e=agent-memory"],
    ["/explore#panel", "/explore#panel"],
    ["/a/../b", "/b"],
  ])("keeps the root-relative path %j as %j", (raw, href) => {
    expect(safeInternalUrl(raw)).toBe(href);
  });

  it("keeps an http(s) URL whose origin is allow-listed", () => {
    expect(safeInternalUrl("https://example.com/explore?e=x", ["https://example.com"])).toBe(
      "https://example.com/explore?e=x",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example/path",
    "/\\evil.example/path",
    "\\\\evil.example",
    "explore",
    "../explore",
    "",
    "https://evil.example/explore",
    "http://example.com/explore",
  ])("rejects %j", (raw) => {
    expect(safeInternalUrl(raw, ["https://example.com"])).toBeNull();
  });
});
