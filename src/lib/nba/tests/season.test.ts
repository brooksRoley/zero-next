import { describe, it, expect, vi, afterEach } from "vitest";
import { currentNbaSeason, nbaSeasonForDate } from "src/lib/nba/season";

afterEach(() => {
  vi.useRealTimers();
});

describe("nbaSeasonForDate", () => {
  it.each([
    [new Date(2026, 2, 15), "2025-26"], // mid-season
    [new Date(2026, 5, 20), "2025-26"], // Finals
    [new Date(2026, 8, 30), "2025-26"], // last day before the rollover
    [new Date(2026, 9, 1), "2026-27"], // rollover
    [new Date(2026, 11, 25), "2026-27"],
    [new Date(2027, 0, 1), "2026-27"],
    [new Date(1999, 10, 2), "1999-00"], // century boundary keeps two digits
  ])("%s → %s", (date, season) => {
    expect(nbaSeasonForDate(date)).toBe(season);
  });
});

describe("currentNbaSeason", () => {
  it("is the season of today's date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7));
    expect(currentNbaSeason()).toBe("2026-27");
    vi.setSystemTime(new Date(2026, 8, 7));
    expect(currentNbaSeason()).toBe("2025-26");
  });
});
