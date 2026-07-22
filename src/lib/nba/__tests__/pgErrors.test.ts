import { describe, it, expect } from "vitest";
import { isMissingTable } from "../pgErrors";

describe("isMissingTable", () => {
  it("matches on the Postgres 42P01 SQLSTATE code", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
  });

  it("matches on a wrapped 'relation ... does not exist' message", () => {
    expect(
      isMissingTable(new Error('relation "tft_predictions" does not exist'))
    ).toBe(true);
  });

  it("is false for unrelated errors", () => {
    expect(isMissingTable(new Error("connection terminated"))).toBe(false);
    expect(isMissingTable({ code: "23505" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable(undefined)).toBe(false);
  });
});
