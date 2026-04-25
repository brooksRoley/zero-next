// TARGET STATE: Tests define the data platform specification
import { describe, it, expect } from "vitest";
import {
  parseTrackingData, validateTimestamps, validateCoordinates,
  calculateSpeed, calculatePlayerMovement, segmentPossessions,
  COURT_LENGTH_FT, COURT_WIDTH_FT, TRACKING_FPS, PLAYERS_PER_FRAME,
} from "../tracking";
import { TRACKING_FRAMES_10, TRACKING_FRAMES_100 } from "./fixtures";

describe("Tracking Data - XY Coordinate Parsing", () => {
  it("parses 25fps player position data into typed records", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    expect(frames).toHaveLength(10);
    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].timestamp).toBeCloseTo(1 / TRACKING_FPS);
  });

  it("each frame has 10 players + ball (x, y, z for ball)", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    for (const f of frames) {
      const players = f.entities.filter((e) => e.entityId !== -1);
      const ball = f.entities.find((e) => e.entityId === -1);
      expect(players).toHaveLength(PLAYERS_PER_FRAME);
      expect(ball).toBeDefined();
      expect(ball!.z).toBeDefined();
    }
  });

  it("coordinates are in feet (court is 94x50)", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    expect(COURT_LENGTH_FT).toBe(94);
    expect(COURT_WIDTH_FT).toBe(50);
    expect(validateCoordinates(frames)).toBe(true);
  });

  it("timestamps are monotonically increasing", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    expect(validateTimestamps(frames)).toBe(true);
  });
});

describe("Tracking Data - Derived Metrics", () => {
  it("player speed calculated from consecutive frames (feet/sec)", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    // LeBron (2544) moves 0.5 ft per frame at 25fps = 12.5 ft/sec
    const speed = calculateSpeed(frames[0], frames[1], 2544);
    expect(speed).not.toBeNull();
    expect(speed!).toBeCloseTo(12.5, 0);
  });

  it("distance traveled accumulated over possession", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_100);
    const movement = calculatePlayerMovement(frames, 2544);
    expect(movement.totalDistanceFt).toBeGreaterThan(0);
    // LeBron moves 0.5 ft/frame for 99 intervals
    expect(movement.totalDistanceFt).toBeCloseTo(49.5, 0);
    expect(movement.frameCount).toBe(100);
  });

  it("possession segmented by change of possession events", () => {
    const frames = parseTrackingData(TRACKING_FRAMES_10);
    const possessions = segmentPossessions(frames);
    // Ball starts near Lakers players, so at least 1 possession
    expect(possessions.length).toBeGreaterThanOrEqual(1);
    for (const p of possessions) {
      expect(p.teamId).toBeGreaterThan(0);
      expect(p.endFrame).toBeGreaterThanOrEqual(p.startFrame);
      expect(p.endTimestamp).toBeGreaterThanOrEqual(p.startTimestamp);
    }
  });
});

describe("Tracking Data - Performance", () => {
  it("can process 100 frames of tracking data quickly", () => {
    const start = performance.now();
    const frames = parseTrackingData(TRACKING_FRAMES_100);
    calculatePlayerMovement(frames, 2544);
    segmentPossessions(frames);
    const elapsed = performance.now() - start;
    // 100 frames should process in under 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it("can process 1 full game of tracking data (72000 frames)", () => {
    // Generate inline to avoid memory in fixtures
    const rawFrames: any[] = [];
    for (let i = 0; i < 72000; i++) {
      rawFrames.push({
        timestamp: i / 25,
        frameIndex: i,
        quarter: Math.floor(i / 18000) + 1,
        gameClock: 720 - (i % 18000) / 25,
        shotClock: 24 - ((i / 25) % 24),
        players: [
          { playerId: 2544, teamId: 1610612747, x: 20 + (i % 74) * 0.5, y: 25 },
          { playerId: 203076, teamId: 1610612747, x: 30, y: 15 },
          { playerId: 1630559, teamId: 1610612747, x: 40, y: 30 },
          { playerId: 1001, teamId: 1610612747, x: 15, y: 10 },
          { playerId: 1002, teamId: 1610612747, x: 25, y: 40 },
          { playerId: 2001, teamId: 1610612738, x: 60, y: 20 },
          { playerId: 2002, teamId: 1610612738, x: 70, y: 30 },
          { playerId: 2003, teamId: 1610612738, x: 50, y: 40 },
          { playerId: 2004, teamId: 1610612738, x: 65, y: 10 },
          { playerId: 2005, teamId: 1610612738, x: 75, y: 25 },
        ],
        ball: { x: 22, y: 25, z: 4 },
      });
    }

    const start = performance.now();
    const frames = parseTrackingData(rawFrames);
    expect(frames).toHaveLength(72000);
    const elapsed = performance.now() - start;
    // Full game parse should complete in under 30 seconds
    expect(elapsed).toBeLessThan(30000);
  });

  it("movement calculation completes in reasonable time for full game", () => {
    // Use 10000 frames as a scaled test
    const rawFrames: any[] = [];
    for (let i = 0; i < 10000; i++) {
      rawFrames.push({
        timestamp: i / 25,
        frameIndex: i,
        quarter: 1,
        gameClock: 720 - i / 25,
        shotClock: 24,
        players: [
          { playerId: 2544, teamId: 1610612747, x: 20 + (i % 74) * 0.5, y: 25 },
          { playerId: 203076, teamId: 1610612747, x: 30, y: 15 },
        ],
        ball: { x: 22, y: 25, z: 4 },
      });
    }
    const frames = parseTrackingData(rawFrames);
    const start = performance.now();
    const movement = calculatePlayerMovement(frames, 2544);
    const elapsed = performance.now() - start;
    expect(movement.totalDistanceFt).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });
});
