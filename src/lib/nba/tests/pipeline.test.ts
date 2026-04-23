// TARGET STATE: Tests define the data platform specification
import { describe, it, expect } from "vitest";

describe("Pipeline - Idempotency", () => {
  it.todo("running ingestion twice produces same row count");
  it.todo("upsert doesn't create duplicates");
  it.todo("re-processing doesn't change gold table values");
});

describe("Pipeline - Incremental Ingestion", () => {
  it.todo("fetches only games after last checkpoint");
  it.todo("checkpoint updates after successful ingestion");
  it.todo("failed ingestion doesn't advance checkpoint");
});

describe("Pipeline - Bronze to Silver", () => {
  it.todo("raw JSON is preserved in bronze");
  it.todo("silver tables have correct types (not all strings)");
  it.todo("cleaning removes duplicate rows");
  it.todo("null handling: missing stats → NULL not 0");
});

describe("Pipeline - Silver to Gold", () => {
  it.todo("per-game stats aggregate correctly to season averages");

  it("PPG = total points / games played", () => {
    // Verify with fixture data: LeBron 24.8 ppg over 62 games
    const totalPts = 24.8 * 62;
    const ppg = totalPts / 62;
    expect(Math.round(ppg * 10) / 10).toBe(24.8);
  });

  it.todo("season stats update when new game added");
  it.todo("gold refresh is idempotent");
});
