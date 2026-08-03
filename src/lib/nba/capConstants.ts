/**
 * Official NBA salary-cap system figures for 2026-27, set by the league
 * effective 2026-07-01 (sources: hoopsrumors.com "Salary Cap, Tax Line Set
 * For 2026/27 NBA Season", bleacherreport.com 2026-27 cap reveal).
 *
 * ESPN keys seasons by ending year, so 2026-27 = season_year 2027.
 */
export const CAP_SEASON_YEAR = 2027;
export const CAP_SEASON_LABEL = "2026-27";

export const SALARY_CAP = 164_961_000;
export const SALARY_FLOOR = 148_465_000;
export const LUXURY_TAX = 200_428_000;
export const FIRST_APRON = 209_015_000;
export const SECOND_APRON = 221_686_000;

/**
 * Traded-player exception tiers index with cap growth (2023 CBA). The $7.5M
 * mid-tier bump and its bounds are the 2023-24 base values scaled by
 * cap(2026-27)/cap(2023-24) — an approximation of the league's official
 * indexed amounts, labeled as such in the UI.
 */
const CAP_2023_24 = 136_021_000;
const INDEX = SALARY_CAP / CAP_2023_24;

/** Outgoing salary at or below this: take back 200% + $250K. */
export const TPE_SMALL_MAX = Math.round(7_500_000 * INDEX);
/** Outgoing salary between small and mid bounds: take back outgoing + this. */
export const TPE_MID_BUMP = Math.round(7_500_000 * INDEX);
/** Outgoing salary above (mid bound): take back 125% + $250K. */
export const TPE_MID_MAX = Math.round(29_000_000 * INDEX);
export const TPE_KICKER = 250_000;
