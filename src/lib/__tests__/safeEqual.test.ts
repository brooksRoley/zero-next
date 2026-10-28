import { describe, it, expect } from "vitest";
import { safeEqual } from "src/lib/safeEqual";

describe("safeEqual", () => {
  it("accepts identical strings", () => {
    expect(safeEqual("s3cret", "s3cret")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });
  it("rejects different strings, prefixes and length mismatches", () => {
    expect(safeEqual("s3cret", "s3creT")).toBe(false);
    expect(safeEqual("s3cret", "s3cre")).toBe(false);
    expect(safeEqual("s3cre", "s3cret")).toBe(false);
    expect(safeEqual("abc", "abc\0")).toBe(false);
  });
  it("rejects non-strings, including undefined === undefined", () => {
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual(["a"], "a")).toBe(false);
    expect(safeEqual(null, "x")).toBe(false);
  });
});
