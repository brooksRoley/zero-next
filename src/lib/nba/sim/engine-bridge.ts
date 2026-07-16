/**
 * WASM engine bridge for server-side simulation.
 * Falls back to a pure TypeScript simulator when WASM is unavailable.
 */
import type { EnginePlayer } from "./stat-mapper";
import { ZONES } from "src/lib/nba/tft/zones";

export interface SimScore {
  homeScore: number;
  awayScore: number;
  synergies: { name: string; tier: number; shootingBuff: number; defenseBuff: number; speedBuff: number }[];
}

export interface PlayerLine {
  playerId: number;
  pts: number;
  reb: number;
  ast: number;
  fga: number;
  fga3: number;
  shots: { zoneId: string; made: boolean; loc_x: number; loc_y: number }[];
}

export interface SimGameResult extends SimScore {
  playerLines: PlayerLine[];
}

function polyCentroid(poly: string): [number, number] {
  const pts = poly.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const n = pts.length;
  return [
    pts.reduce((s, [x]) => s + x, 0) / n,
    pts.reduce((s, [, y]) => s + y, 0) / n,
  ];
}

/**
 * Pure TypeScript simulation fallback.
 * Each tick, a random team "possesses" and shoots. Shot probability uses the
 * engine formula: (shooting/100) * 0.48 - defender contest. Per-player box
 * stats and shot origins are tracked across all possessions.
 * Preserves seeded PRNG (mulberry32) and synergy detection from original.
 */
export function simulateGameTS(
  home: EnginePlayer[],
  away: EnginePlayer[],
  seed: number,
  ticks: number,
): SimGameResult {
  // Seeded PRNG (mulberry32)
  let s = seed | 0;
  function rand(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Initialize per-player lines
  const lineFor = new Map<number, PlayerLine>();
  const initLine = (p: EnginePlayer) => {
    const line: PlayerLine = { playerId: p.id, pts: 0, reb: 0, ast: 0, fga: 0, fga3: 0, shots: [] };
    lineFor.set(p.id, line);
    return line;
  };
  for (const p of home) initLine(p);
  for (const p of away) initLine(p);

  // Compute team averages for sim
  const avg = (players: EnginePlayer[], key: keyof EnginePlayer) =>
    players.reduce((sum, p) => sum + (Number(p[key]) || 0), 0) / players.length;

  const homeShooting = avg(home, "shooting");
  const homeDefense = avg(home, "defense");
  const awayShooting = avg(away, "shooting");
  const awayDefense = avg(away, "defense");

  // Synergy detection (simplified, unchanged from original)
  const synergies: SimScore["synergies"] = [];
  const homeTeams: Record<string, number> = {};
  for (const p of home) {
    homeTeams[p.team] = (homeTeams[p.team] || 0) + 1;
  }
  for (const team of Object.keys(homeTeams)) {
    const count = homeTeams[team];
    if (count >= 2) {
      synergies.push({
        name: `${team} Franchise`, tier: Math.floor(count / 2),
        shootingBuff: 5 * Math.floor(count / 2), defenseBuff: 0, speedBuff: 0,
      });
    }
  }
  const giants = home.filter((p) => p.height_inches >= 82).length;
  if (giants >= 2) {
    synergies.push({ name: "Twin Towers", tier: giants - 1, shootingBuff: 0, defenseBuff: 15, speedBuff: -5 });
  }

  // Apply synergy buffs
  const homeShootBuff = synergies.reduce((sum, b) => sum + b.shootingBuff, 0);
  const homeDefBuff = synergies.reduce((sum, b) => sum + b.defenseBuff, 0);
  const effHomeShooting = Math.min(100, homeShooting + homeShootBuff);
  const effHomeDefense = Math.min(100, homeDefense + homeDefBuff);

  /** Pick shooter weighted by shooting rating */
  function pickShooter(team: EnginePlayer[]): EnginePlayer {
    const totalWeight = team.reduce((sum, p) => sum + p.shooting, 0);
    let r = rand() * totalWeight;
    for (const p of team) { r -= p.shooting; if (r <= 0) return p; }
    return team[team.length - 1];
  }

  /** Pick a random zone; return zone id and centroid as shot location */
  function pickZone(): { zoneId: string; loc: [number, number] } {
    const idx = Math.floor(rand() * ZONES.length);
    const z = ZONES[idx];
    return { zoneId: z.id, loc: polyCentroid(z.poly) };
  }

  /** Award an assist on a made basket (60% of makes); passer weighted by playmaking proxy */
  function assist(team: EnginePlayer[], shooter: EnginePlayer) {
    if (rand() > 0.6) return;
    const others = team.filter((p) => p.id !== shooter.id);
    const w = others.reduce((sum, p) => sum + (100 - p.shooting), 0);
    let r = rand() * w;
    for (const p of others) {
      r -= (100 - p.shooting);
      if (r <= 0) { lineFor.get(p.id)!.ast += 1; return; }
    }
  }

  /** Award a defensive rebound weighted by height */
  function rebound(defTeam: EnginePlayer[]) {
    const w = defTeam.reduce((sum, p) => sum + p.height_inches, 0);
    let r = rand() * w;
    for (const p of defTeam) {
      r -= p.height_inches;
      if (r <= 0) { lineFor.get(p.id)!.reb += 1; return; }
    }
  }

  let homeScore = 0;
  let awayScore = 0;

  // Sim loop: ~2 possessions per tick at game pace
  const possessionsPerTick = 0.15;
  for (let t = 0; t < ticks; t++) {
    if (rand() < possessionsPerTick) {
      // Home possession
      const shooter = pickShooter(home);
      const { zoneId, loc } = pickZone();
      const isThree = zoneId.includes("3") || (zoneId === "top-of-key" && rand() < 0.4);
      const shotProb = (effHomeShooting / 100) * 0.48 - (awayDefense / 100) * 0.08;
      const line = lineFor.get(shooter.id)!;
      line.fga += 1;
      if (isThree) line.fga3 += 1;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        const pts = isThree ? 3 : 2;
        homeScore += pts;
        line.pts += pts;
        line.shots.push({ zoneId, made: true, loc_x: loc[0], loc_y: loc[1] });
        assist(home, shooter);
      } else {
        line.shots.push({ zoneId, made: false, loc_x: loc[0], loc_y: loc[1] });
        rebound(away);
      }
    }

    if (rand() < possessionsPerTick) {
      // Away possession
      const shooter = pickShooter(away);
      const { zoneId, loc } = pickZone();
      const isThree = zoneId.includes("3") || (zoneId === "top-of-key" && rand() < 0.4);
      const shotProb = (awayShooting / 100) * 0.48 - (effHomeDefense / 100) * 0.08;
      const line = lineFor.get(shooter.id)!;
      line.fga += 1;
      if (isThree) line.fga3 += 1;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        const pts = isThree ? 3 : 2;
        awayScore += pts;
        line.pts += pts;
        line.shots.push({ zoneId, made: true, loc_x: loc[0], loc_y: loc[1] });
        assist(away, shooter);
      } else {
        line.shots.push({ zoneId, made: false, loc_x: loc[0], loc_y: loc[1] });
        rebound(home);
      }
    }
  }

  return { homeScore, awayScore, synergies, playerLines: Array.from(lineFor.values()) };
}
