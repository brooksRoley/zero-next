/**
 * NBA season utilities.
 */

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

export const LAKERS_TEAM_ID = 1610612747;
