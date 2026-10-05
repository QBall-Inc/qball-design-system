import { describe, expect, it } from "vitest";
import type { SourceRef } from "../types";
import { resolveSourceBadge, sourceHost, type SourceBadgeOptions } from "./source-badge";
import { safeExternalUrl } from "./url";

function source(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    episode_id: "ep-1",
    title: "A saved article",
    url: "https://example.org/post",
    source_type: "web",
    save_date: "2026-05-01",
    ...overrides,
  };
}

const companies: SourceBadgeOptions = {
  domains: {
    "example-lab.com": { mark: "EL", label: "Example Lab" },
    "meta.example": { mark: "MX", label: "Meta Example" },
    "ai.meta.example": { mark: "MAI", label: "Meta Example AI" },
  },
};

describe("safeExternalUrl", () => {
  it.each(["https://example.org/a", "http://example.org", "HTTPS://EXAMPLE.ORG/x"])(
    "accepts %s",
    (raw) => {
      expect(safeExternalUrl(raw)).not.toBeNull();
    },
  );

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//example.org/protocol-relative",
    "/relative/path",
    "not a url",
    "",
    "ftp://example.org/file",
  ])("rejects %s", (raw) => {
    expect(safeExternalUrl(raw)).toBeNull();
  });
});

describe("resolveSourceBadge — built-in platforms", () => {
  it.each([
    ["github", "GH", "GitHub"],
    ["youtube", "YT", "YouTube"],
    ["substack", "SB", "Substack"],
    ["medium", "MD", "Medium"],
    ["linkedin", "LI", "LinkedIn"],
    ["reddit", "RD", "Reddit"],
    ["arxiv", "AX", "arXiv"],
    ["x", "X", "X"],
    ["huggingface", "HF", "Hugging Face"],
  ])("source_type %s → %s / %s", (type, mark, label) => {
    expect(resolveSourceBadge(source({ source_type: type }))).toEqual({ mark, label });
  });

  it("matches source_type case-insensitively and ignores surrounding space", () => {
    expect(resolveSourceBadge(source({ source_type: " GitHub " }))).toEqual({
      mark: "GH",
      label: "GitHub",
    });
  });

  it.each(["web", "blog", "", "constructor", "__proto__", "toString"])(
    "unknown source_type %j → no badge",
    (type) => {
      expect(resolveSourceBadge(source({ source_type: type }))).toBeNull();
    },
  );
});

describe("resolveSourceBadge — consumer domains", () => {
  it("matches the exact host, a subdomain and a www host", () => {
    for (const url of [
      "https://example-lab.com/news/a",
      "https://blog.example-lab.com/b",
      "https://www.example-lab.com/c",
    ]) {
      expect(resolveSourceBadge(source({ url }), companies)).toEqual({
        mark: "EL",
        label: "Example Lab",
      });
    }
  });

  it("does not match a host that merely ends with the same letters", () => {
    expect(
      resolveSourceBadge(source({ url: "https://notexample-lab.com/x" }), companies),
    ).toBeNull();
  });

  it("prefers the longest matching domain key", () => {
    expect(resolveSourceBadge(source({ url: "https://ai.meta.example/p" }), companies)?.mark).toBe(
      "MAI",
    );
    expect(
      resolveSourceBadge(source({ url: "https://about.meta.example/p" }), companies)?.mark,
    ).toBe("MX");
  });

  it("checks consumer domains before the platform table", () => {
    const options: SourceBadgeOptions = {
      domains: { "github.com": { mark: "ORG", label: "Org" } },
    };
    expect(
      resolveSourceBadge(source({ source_type: "github", url: "https://github.com/o/r" }), options),
    ).toEqual({ mark: "ORG", label: "Org" });
  });

  it("falls back to the platform when no domain matches", () => {
    expect(
      resolveSourceBadge(source({ source_type: "youtube", url: "https://youtu.be/x" }), companies),
    ).toEqual({ mark: "YT", label: "YouTube" });
  });

  it("never matches a domain through a non-http(s) URL", () => {
    expect(
      resolveSourceBadge(source({ url: "javascript://example-lab.com/%0Aalert(1)" }), companies),
    ).toBeNull();
  });

  it("normalises domain keys (case, www)", () => {
    const options: SourceBadgeOptions = {
      domains: { "WWW.Example-Lab.com": { mark: "EL", label: "Example Lab" } },
    };
    expect(resolveSourceBadge(source({ url: "https://example-lab.com/" }), options)?.label).toBe(
      "Example Lab",
    );
  });

  it.each([
    [{ mark: "", label: "Lab" }, /mark must be 1-4/],
    [{ mark: "TOOLONG", label: "Lab" }, /mark must be 1-4/],
    [{ mark: "L", label: "  " }, /label must not be empty/],
  ])("rejects a malformed consumer badge %j", (badge, message) => {
    expect(() =>
      resolveSourceBadge(source({ url: "https://example-lab.com/" }), {
        domains: { "example-lab.com": badge },
      }),
    ).toThrow(message);
  });

  it.each([
    "https://example-lab.com",
    "example-lab.com/news",
    "example-lab.com:443",
    "localhost",
    "",
    ".example-lab.com",
    "example lab.com",
  ])("rejects malformed domain key %j", (key) => {
    expect(() =>
      resolveSourceBadge(source({ url: "https://unrelated.example/" }), {
        domains: { [key]: { mark: "EL", label: "Example Lab" } },
      }),
    ).toThrow(/must be a bare hostname/);
  });

  it("validates every entry, even one that would not match the source", () => {
    expect(() =>
      resolveSourceBadge(source({ url: "https://example-lab.com/" }), {
        domains: {
          "example-lab.com": { mark: "EL", label: "Example Lab" },
          "other.example": { mark: "TOOLONG", label: "Other" },
        },
      }),
    ).toThrow(/mark must be 1-4/);
  });

  it("validates entries even when the source URL is not http(s)", () => {
    expect(() =>
      resolveSourceBadge(source({ url: "javascript:alert(1)" }), {
        domains: { "example-lab.com": { mark: "L", label: "" } },
      }),
    ).toThrow(/label must not be empty/);
  });
});

describe("sourceHost", () => {
  it("returns the lowercase host without www", () => {
    expect(sourceHost(source({ url: "https://WWW.Example.org/a" }))).toBe("example.org");
  });

  it("returns null for a non-http(s) URL", () => {
    expect(sourceHost(source({ url: "data:text/plain,x" }))).toBeNull();
  });
});
