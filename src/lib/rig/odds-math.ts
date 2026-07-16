/**
 * The Rig Report — odds math.
 *
 * Pure, deterministic sportsbook arithmetic. This is the sober half of the
 * satire machine: every "the books are hiding something" joke on the page is
 * backed by one of these functions showing exactly what the books are doing
 * in plain arithmetic (spoiler: charging a fee).
 */

/**
 * Convert American odds to the probability the price implies.
 *
 *   -110 => 110 / (110 + 100) ≈ 0.5238
 *   +150 => 100 / (150 + 100) = 0.4
 *
 * Note this is the probability *with the book's margin baked in* — the sum of
 * implied probabilities across all outcomes exceeds 1. See {@link overround}.
 */
export function impliedProbability(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new Error(`Invalid American odds: ${americanOdds}`);
  }
  const abs = Math.abs(americanOdds);
  return americanOdds < 0 ? abs / (abs + 100) : 100 / (abs + 100);
}

/** American odds -> decimal odds (total return per 1 unit staked). */
export function decimalOdds(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new Error(`Invalid American odds: ${americanOdds}`);
  }
  const abs = Math.abs(americanOdds);
  return americanOdds < 0 ? 1 + 100 / abs : 1 + abs / 100;
}

/**
 * Overround (a.k.a. vig, juice, the market's markup) for one market.
 *
 * Takes every outcome's American odds and returns how far the implied
 * probabilities sum past 1.0. A fair two-way market sums to exactly 1;
 * a standard -110 / -110 spread market sums to ~1.0476, an overround of
 * ~0.0476 (4.76%).
 */
export function overround(lines: number[]): number {
  if (lines.length < 2) {
    throw new Error("overround needs at least two outcomes");
  }
  const total = lines.reduce((sum, l) => sum + impliedProbability(l), 0);
  return total - 1;
}

/**
 * The house hold: the fraction of total handle the book expects to keep if
 * money comes in proportionally to the implied probabilities. Expressed as a
 * percentage (e.g. 4.54 for the classic -110/-110 market).
 *
 * hold = overround / (1 + overround)
 */
export function holdPercent(lines: number[]): number {
  const o = overround(lines);
  return (o / (1 + o)) * 100;
}

/**
 * Remove the vig by proportional normalization: rescale implied probabilities
 * so they sum to 1. This is the simplest de-vig method (it ignores
 * favorite-longshot bias, which is itself one of our exhibits).
 */
export function devig(lines: number[]): number[] {
  const implied = lines.map(impliedProbability);
  const total = implied.reduce((a, b) => a + b, 0);
  return implied.map((p) => p / total);
}

/**
 * The win rate you'd need at these odds just to break even — same number as
 * the implied probability, framed as the bettor's hurdle. At -110 you must be
 * right 52.38% of the time to make $0. That gap between 50% and 52.38% is the
 * house's entire business model.
 */
export function breakEvenWinRate(americanOdds: number): number {
  return impliedProbability(americanOdds) * 100;
}

/**
 * Expected loss in dollars per $100 wagered for a bettor picking randomly in
 * a market with this hold. The "house always wins" number.
 */
export function expectedLossPer100(lines: number[]): number {
  return holdPercent(lines);
}

/** Round to a fixed number of decimals (avoids float junk in displayed stats). */
export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
