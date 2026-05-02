/**
 * NBA season utilities.
 */

export type SeasonType = "Regular Season" | "Playoffs";

/** Returns the current NBA season string, e.g. "2025-26". */
export function currentNbaSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // Seasons begin in October — Oct–Dec belong to the new season year
  if (month >= 10) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Auto-detect whether we're in the playoff window.
 * NBA regular season typically ends mid-April; playoffs run late April–June.
 * Returns "Playoffs" from April 15 through June 30, "Regular Season" otherwise.
 */
export function currentSeasonType(): SeasonType {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if ((month === 4 && day >= 15) || month === 5 || month === 6) {
    return "Playoffs";
  }
  return "Regular Season";
}

/**
 * Parse season_type from a query parameter, falling back to auto-detection.
 * Accepts "Regular Season", "Playoffs", or "regular"/"playoffs" shorthand.
 */
export function parseSeasonType(raw: unknown): SeasonType {
  if (typeof raw === "string") {
    const lower = raw.toLowerCase().trim();
    if (lower === "playoffs" || lower === "playoff") return "Playoffs";
    if (lower === "regular season" || lower === "regular") return "Regular Season";
  }
  return currentSeasonType();
}

export const LAKERS_TEAM_ID = 1610612747;
