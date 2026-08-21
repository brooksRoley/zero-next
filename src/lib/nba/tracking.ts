/**
 * Player tracking data parser — handles Second Spectrum / NBA tracking format.
 * 25fps XY coordinate data for 10 players + ball per frame.
 * Court dimensions: 94ft x 50ft.
 */

export const COURT_LENGTH_FT = 94;
export const COURT_WIDTH_FT = 50;
export const TRACKING_FPS = 25;
export const PLAYERS_PER_FRAME = 10;

export interface TrackingEntity {
  entityId: number;      // player_id or -1 for ball
  teamId: number;        // team_id or 0 for ball
  x: number;             // feet from left baseline
  y: number;             // feet from bottom sideline
  z?: number;            // feet above court (ball only)
}

export interface TrackingFrame {
  timestamp: number;     // seconds from game start
  frameIndex: number;
  quarter: number;
  gameClock: number;     // seconds remaining in quarter
  shotClock: number | null;
  entities: TrackingEntity[];
}

export interface Possession {
  startFrame: number;
  endFrame: number;
  teamId: number;
  startTimestamp: number;
  endTimestamp: number;
  frames: TrackingFrame[];
}

export interface PlayerMovementStats {
  playerId: number;
  totalDistanceFt: number;
  avgSpeedFtPerSec: number;
  maxSpeedFtPerSec: number;
  frameCount: number;
}

/** One frame as published by the tracking feed, before normalization —
 *  field names vary by provider (camelCase vs snake_case), hence the pairs. */
type RawTrackingFrame = {
  timestamp?: number;
  frameIndex?: number;
  quarter?: number;
  period?: number;
  gameClock?: number;
  game_clock?: number;
  shotClock?: number | null;
  players?: Array<{
    playerId?: number;
    player_id?: number;
    teamId?: number;
    team_id?: number;
    x: number | string;
    y: number | string;
  }>;
  ball?: { x: number | string; y: number | string; z?: number | string };
};

/**
 * Parse raw tracking JSON into typed TrackingFrame array.
 * Expected input: array of frame objects from tracking feed.
 */
export function parseTrackingData(raw: RawTrackingFrame[]): TrackingFrame[] {
  const frames: TrackingFrame[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const entities: TrackingEntity[] = [];

    if (Array.isArray(r.players)) {
      for (const p of r.players) {
        entities.push({
          entityId: p.playerId ?? p.player_id ?? NaN,
          teamId: p.teamId ?? p.team_id ?? 0,
          x: Number(p.x),
          y: Number(p.y),
        });
      }
    }

    if (r.ball) {
      entities.push({
        entityId: -1,
        teamId: 0,
        x: Number(r.ball.x),
        y: Number(r.ball.y),
        z: r.ball.z != null ? Number(r.ball.z) : undefined,
      });
    }

    frames.push({
      timestamp: Number(r.timestamp ?? i / TRACKING_FPS),
      frameIndex: r.frameIndex ?? i,
      quarter: r.quarter ?? r.period ?? 1,
      gameClock: Number(r.gameClock ?? r.game_clock ?? 720),
      shotClock: r.shotClock != null ? Number(r.shotClock) : null,
      entities,
    });
  }

  return frames;
}

/**
 * Validate that frames have monotonically increasing timestamps.
 */
export function validateTimestamps(frames: TrackingFrame[]): boolean {
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].timestamp <= frames[i - 1].timestamp) return false;
  }
  return true;
}

/**
 * Validate that all coordinates are within court bounds.
 */
export function validateCoordinates(frames: TrackingFrame[]): boolean {
  for (const f of frames) {
    for (const e of f.entities) {
      if (e.x < 0 || e.x > COURT_LENGTH_FT) return false;
      if (e.y < 0 || e.y > COURT_WIDTH_FT) return false;
    }
  }
  return true;
}

/**
 * Calculate distance between two 2D points in feet.
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Calculate speed between consecutive frames for a given entity (feet/sec).
 */
export function calculateSpeed(
  prev: TrackingFrame,
  curr: TrackingFrame,
  entityId: number
): number | null {
  const prevEntity = prev.entities.find((e) => e.entityId === entityId);
  const currEntity = curr.entities.find((e) => e.entityId === entityId);
  if (!prevEntity || !currEntity) return null;

  const dt = curr.timestamp - prev.timestamp;
  if (dt <= 0) return null;

  const dist = distance(prevEntity.x, prevEntity.y, currEntity.x, currEntity.y);
  return dist / dt;
}

/**
 * Calculate total distance traveled and speed stats for a player across frames.
 */
export function calculatePlayerMovement(
  frames: TrackingFrame[],
  playerId: number
): PlayerMovementStats {
  let totalDistance = 0;
  let maxSpeed = 0;
  const speeds: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const speed = calculateSpeed(frames[i - 1], frames[i], playerId);
    if (speed != null) {
      const dt = frames[i].timestamp - frames[i - 1].timestamp;
      totalDistance += speed * dt;
      speeds.push(speed);
      if (speed > maxSpeed) maxSpeed = speed;
    }
  }

  return {
    playerId,
    totalDistanceFt: totalDistance,
    avgSpeedFtPerSec: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    maxSpeedFtPerSec: maxSpeed,
    frameCount: frames.length,
  };
}

/**
 * Segment frames into possessions by detecting team changes in ball proximity.
 * Simple heuristic: possession belongs to team of nearest player to ball.
 */
export function segmentPossessions(frames: TrackingFrame[]): Possession[] {
  const possessions: Possession[] = [];
  let currentTeamId = 0;
  let possStart = 0;

  for (let i = 0; i < frames.length; i++) {
    const ball = frames[i].entities.find((e) => e.entityId === -1);
    if (!ball) continue;

    // Find nearest player to ball
    let minDist = Infinity;
    let nearestTeam = 0;
    for (const e of frames[i].entities) {
      if (e.entityId === -1) continue; // skip ball
      const d = distance(ball.x, ball.y, e.x, e.y);
      if (d < minDist) {
        minDist = d;
        nearestTeam = e.teamId;
      }
    }

    if (nearestTeam !== currentTeamId && nearestTeam !== 0) {
      if (currentTeamId !== 0 && i > possStart) {
        possessions.push({
          startFrame: possStart,
          endFrame: i - 1,
          teamId: currentTeamId,
          startTimestamp: frames[possStart].timestamp,
          endTimestamp: frames[i - 1].timestamp,
          frames: frames.slice(possStart, i),
        });
      }
      currentTeamId = nearestTeam;
      possStart = i;
    }
  }

  // Final possession
  if (currentTeamId !== 0 && possStart < frames.length) {
    possessions.push({
      startFrame: possStart,
      endFrame: frames.length - 1,
      teamId: currentTeamId,
      startTimestamp: frames[possStart].timestamp,
      endTimestamp: frames[frames.length - 1].timestamp,
      frames: frames.slice(possStart),
    });
  }

  return possessions;
}
