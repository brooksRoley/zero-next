// TARGET STATE: Tests define the data platform specification
// Tracking data = future work (Second Spectrum / NBA player tracking)
import { describe, it } from "vitest";

describe("Tracking Data - XY Coordinate Parsing", () => {
  it.todo("parses 25fps player position data into typed records");
  it.todo("each frame has 10 players + ball (x, y, z for ball)");
  it.todo("coordinates are in feet (court is 94x50)");
  it.todo("timestamps are monotonically increasing");
});

describe("Tracking Data - Derived Metrics", () => {
  it.todo("player speed calculated from consecutive frames (feet/sec)");
  it.todo("distance traveled accumulated over possession");
  it.todo("possession segmented by change of possession events");
});

describe("Tracking Data - Performance", () => {
  it.todo("can process 1 full game of tracking data (48 min * 25fps * 11 entities)");
  it.todo("processing completes in under 30 seconds");
  it.todo("memory usage stays under 500MB for single game");
});
