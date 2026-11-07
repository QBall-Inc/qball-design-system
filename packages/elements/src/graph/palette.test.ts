import { describe, expect, it } from "vitest";
import { resolvedCanvasTokens } from "./canvas-test-support";
import { CLASS_ROLE, ROLE_TOKEN, classRole } from "./palette";

describe("classRole", () => {
  it("maps each known class to its own role", () => {
    for (const [cls, role] of Object.entries(CLASS_ROLE)) expect(classRole(cls)).toBe(role);
  });

  it.each(["unclassified", "", "Tool", "no-such-class"])(
    "renders an unknown class %j in the dedicated unclassified grey",
    (cls) => {
      expect(classRole(cls)).toBe("unclassified");
      expect(ROLE_TOKEN[classRole(cls)]).toBe("--stage-unclassified");
    },
  );
});

describe("resolved class colours on the canvas stage (shipped tokens CSS)", () => {
  // Roles can differ while their tokens resolve to the same hex (the 0.6.0
  // legend bug: muted == data-flat). Compare the colours a browser would paint.
  const tokens = resolvedCanvasTokens();
  const colourOf = (cls: string): string => {
    const value = tokens[ROLE_TOKEN[classRole(cls)]] ?? "";
    expect(value.length, `${cls} resolves to a colour`).toBeGreaterThan(0);
    return value.toUpperCase();
  };
  const classes = [...Object.keys(CLASS_ROLE), "unclassified"];

  it("gives every known class and the unknown-class swatch a different colour", () => {
    expect(classes.length).toBeGreaterThan(1);
    const colours = classes.map(colourOf);
    expect(new Set(colours).size).toBe(classes.length);
  });

  it("paints unknown classes in the shipped --stage-unclassified grey, apart from standard-protocol's", () => {
    // The exact value (owner-picked slate) is pinned by the Chromium legend test.
    expect(colourOf("no-such-class")).toBe(tokens["--stage-unclassified"]?.toUpperCase());
    expect(colourOf("no-such-class")).not.toBe(colourOf("standard-protocol"));
  });
});
