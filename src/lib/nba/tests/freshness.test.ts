// TARGET STATE: Tests define the data platform specification
// These tests require a live database connection — skip until DB is wired
import { describe, it } from "vitest";

describe("Data Freshness", () => {
  it.todo("most recent game in database is within 48 hours (during season)");
  it.todo("player roster updated within last 7 days");
  it.todo("standings reflect games through yesterday");
  it.todo("bronze ingestion log shows successful run in last 24h");
});
