import { describe, it, expect, vi } from "vitest";
import { PlayerSchema, TeamSchema, GameSchema, StandingsSchema, GameLogSchema } from "./schemas";
import { validateRows, validateRowsDetailed } from "./validate";
import {
  PLAYER_LEBRON, PLAYER_AD, SAMPLE_PLAYERS, SAMPLE_TEAMS, SAMPLE_GAMES,
  SAMPLE_GAME_LOG, INVALID_PLAYER_NULL_ID, INVALID_PLAYER_MISSING_NAME,
  INVALID_TEAM_NULL_ID,
} from "./tests/fixtures";

describe("PlayerSchema", () => {
  it("validates a correct player row", () => {
    const result = PlayerSchema.safeParse(PLAYER_LEBRON);
    expect(result.success).toBe(true);
  });

  it("validates all sample players", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(PlayerSchema.safeParse(p).success).toBe(true);
    }
  });

  it("rejects null PLAYER_ID", () => {
    const result = PlayerSchema.safeParse(INVALID_PLAYER_NULL_ID);
    expect(result.success).toBe(false);
  });

  it("rejects missing PLAYER_NAME", () => {
    const result = PlayerSchema.safeParse(INVALID_PLAYER_MISSING_NAME);
    expect(result.success).toBe(false);
  });

  it("preserves extra fields via passthrough", () => {
    const row = { ...PLAYER_LEBRON, CUSTOM_FIELD: "test", DRAFT_YEAR: 2003 };
    const result = PlayerSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).CUSTOM_FIELD).toBe("test");
      expect((result.data as any).DRAFT_YEAR).toBe(2003);
    }
  });
});

describe("TeamSchema", () => {
  it("validates correct team rows", () => {
    for (const t of SAMPLE_TEAMS) {
      expect(TeamSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects null TeamID", () => {
    expect(TeamSchema.safeParse(INVALID_TEAM_NULL_ID).success).toBe(false);
  });
});

describe("GameSchema", () => {
  it("validates correct game rows", () => {
    for (const g of SAMPLE_GAMES) {
      expect(GameSchema.safeParse(g).success).toBe(true);
    }
  });
});

describe("StandingsSchema", () => {
  it("validates standings rows with required fields", () => {
    for (const s of SAMPLE_TEAMS) {
      // SAMPLE_TEAMS have standings-compatible fields
      expect(StandingsSchema.safeParse(s).success).toBe(true);
    }
  });
});

describe("GameLogSchema", () => {
  it("validates game log rows", () => {
    for (const gl of SAMPLE_GAME_LOG) {
      expect(GameLogSchema.safeParse(gl).success).toBe(true);
    }
  });
});

describe("validateRows", () => {
  it("returns all rows when all valid", () => {
    const result = validateRows(PlayerSchema, SAMPLE_PLAYERS, "test");
    expect(result).toHaveLength(3);
  });

  it("filters out invalid rows", () => {
    const mixed = [...SAMPLE_PLAYERS, INVALID_PLAYER_NULL_ID, INVALID_PLAYER_MISSING_NAME];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateRows(PlayerSchema, mixed, "test");
    expect(result).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns empty array for empty input", () => {
    const result = validateRows(PlayerSchema, [], "test");
    expect(result).toHaveLength(0);
  });

  it("logs warning with source context for invalid rows", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateRows(PlayerSchema, [INVALID_PLAYER_NULL_ID], "players-endpoint");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("players-endpoint")
    );
    warnSpy.mockRestore();
  });
});

describe("validateRowsDetailed", () => {
  it("returns correct counts", () => {
    const mixed = [...SAMPLE_PLAYERS, INVALID_PLAYER_NULL_ID];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateRowsDetailed(PlayerSchema, mixed, "test");
    expect(result.total).toBe(4);
    expect(result.validCount).toBe(3);
    expect(result.invalidCount).toBe(1);
    vi.restoreAllMocks();
  });
});
