import { describe, expect, it } from "vitest";
import { CLASS_ROLE, ROLE_TOKEN, classRole } from "./palette";

describe("classRole", () => {
  it("maps each known class to its own role", () => {
    for (const [cls, role] of Object.entries(CLASS_ROLE)) expect(classRole(cls)).toBe(role);
  });

  it.each(["unclassified", "", "Tool", "no-such-class"])(
    "renders an unknown class %j in the neutral muted grey (owner S139)",
    (cls) => {
      expect(classRole(cls)).toBe("muted");
      expect(ROLE_TOKEN[classRole(cls)]).toBe("--text-muted");
    },
  );

  it("no known class shares the unknown-class colour, so the legend shows no duplicate swatch", () => {
    expect(Object.values(CLASS_ROLE)).not.toContain("muted");
  });
});
