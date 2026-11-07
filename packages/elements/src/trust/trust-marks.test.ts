import { describe, expect, it } from "vitest";
import { ALL_TRUST_MARKS, resolveTrustMarks } from "./trust-marks";

describe("resolveTrustMarks", () => {
  it("shows every mark when left out", () => {
    expect(resolveTrustMarks(undefined)).toEqual({
      stamp: true,
      footer: true,
      endorsed: true,
      verified: true,
      superseded: true,
      confidence: true,
    });
    expect(resolveTrustMarks(undefined)).toBe(ALL_TRUST_MARKS);
  });

  it("turns off only the keys set to false", () => {
    expect(resolveTrustMarks({ verified: false, stamp: true })).toEqual({
      ...ALL_TRUST_MARKS,
      verified: false,
    });
  });

  it.each([
    [null, "trustMarks must be an object of booleans."],
    [[], "trustMarks must be an object of booleans."],
    [true, "trustMarks must be an object of booleans."],
    [{ stamp: "no" }, "trustMarks.stamp must be a boolean."],
    [{ verifed: false }, 'trustMarks has an unknown key "verifed"'],
  ])("rejects %j", (value, message) => {
    expect(() => resolveTrustMarks(value)).toThrow(message);
  });
});
