// TARGET STATE: Tests define the data platform specification
import { describe, it } from "vitest";

describe("Storage - Parquet Export", () => {
  it.todo("gold tables export to valid Parquet format");
  it.todo("exported file contains correct column types");
  it.todo("Parquet file is smaller than equivalent JSON");
});

describe("Storage - Query Performance", () => {
  it.todo("team season stats query returns in < 200ms");
  it.todo("player game log query returns in < 200ms");
  it.todo("full standings query returns in < 100ms");
});

describe("Storage - Schema Evolution", () => {
  it.todo("adding a new column doesn't break existing queries");
  it.todo("removing a column is handled gracefully");
  it.todo("column type changes are validated");
});
