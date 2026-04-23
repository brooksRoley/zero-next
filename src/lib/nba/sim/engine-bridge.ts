/**
 * WASM engine bridge for server-side simulation.
 * Falls back to a pure TypeScript simulator when WASM is unavailable.
 */
import type { EnginePlayer } from "./stat-mapper";

export interface SimScore {
  homeScore: number;
  awayScore: number;
  synergies: { name: string; tier: number; shootingBuff: number; defenseBuff: number; speedBuff: number }[];
}

/**
 * Pure TypeScript simulation fallback.
 * Simplified model: each tick, a random team "possesses" and shoots.
 * Shot probability uses the engine formula: (shooting/100) * exp(-dist * 0.05) - defender contest.
 * This is intentionally simpler than the C++ engine but captures the same stat relationships.
 */
export function simulateGameTS(
  home: EnginePlayer[],
  away: EnginePlayer[],
  seed: number,
  ticks: number,
): SimScore {
  // Simple seeded PRNG (mulberry32)
  let s = seed | 0;
  function rand(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let homeScore = 0;
  let awayScore = 0;

  // Compute team averages for sim
  const avg = (players: EnginePlayer[], key: keyof EnginePlayer) =>
    players.reduce((s, p) => s + (Number(p[key]) || 0), 0) / players.length;

  const homeShooting = avg(home, "shooting");
  const homeDefense = avg(home, "defense");
  const awayShooting = avg(away, "shooting");
  const awayDefense = avg(away, "defense");

  // Synergy detection (simplified)
  const synergies: SimScore["synergies"] = [];
  const homeTeams: Record<string, number> = {};
  for (const p of home) {
    homeTeams[p.team] = (homeTeams[p.team] || 0) + 1;
  }
  for (const team of Object.keys(homeTeams)) {
    const count = homeTeams[team];
    if (count >= 2) {
      synergies.push({ name: `${team} Franchise`, tier: Math.floor(count / 2), shootingBuff: 5 * Math.floor(count / 2), defenseBuff: 0, speedBuff: 0 });
    }
  }
  const giants = home.filter((p) => p.height_inches >= 82).length;
  if (giants >= 2) {
    synergies.push({ name: "Twin Towers", tier: giants - 1, shootingBuff: 0, defenseBuff: 15, speedBuff: -5 });
  }

  // Apply synergy buffs
  const homeShootBuff = synergies.reduce((s, b) => s + b.shootingBuff, 0);
  const homeDefBuff = synergies.reduce((s, b) => s + b.defenseBuff, 0);

  const effHomeShooting = Math.min(100, homeShooting + homeShootBuff);
  const effHomeDefense = Math.min(100, homeDefense + homeDefBuff);

  // Sim loop: ~2 possessions per tick at game pace
  const possessionsPerTick = 0.15;
  for (let t = 0; t < ticks; t++) {
    if (rand() < possessionsPerTick) {
      // Home possession
      const shotProb = (effHomeShooting / 100) * 0.48 - (awayDefense / 100) * 0.08;
      const threeProb = 0.35;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        homeScore += rand() < threeProb ? 3 : 2;
      }
    }
    if (rand() < possessionsPerTick) {
      // Away possession
      const shotProb = (awayShooting / 100) * 0.48 - (effHomeDefense / 100) * 0.08;
      const threeProb = 0.35;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        awayScore += rand() < threeProb ? 3 : 2;
      }
    }
  }

  return { homeScore, awayScore, synergies };
}
