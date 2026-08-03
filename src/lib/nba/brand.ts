/**
 * NBA-flavored brand tokens for the site's NBA surfaces.
 *
 * Colors are the NBA logo's red/white/blue plus hardwood tones. The league's
 * actual typeface (Action NBA) is licensed and can't be embedded — Anton is
 * the free condensed athletic face standing in for it; Outfit and DM Mono
 * stay for body and data.
 *
 * Chart-mark colors are NOT these raw brand hues: series colors must clear
 * the dataviz checks on the dark surface (#12151c). The validated steps live
 * with the charts (e.g. LeagueLens POS_COLORS — blue #3987e5 / red #e66767 /
 * gold #c98500, worst adjacent CVD ΔE 35.9, all ≥3:1).
 */

export const NBA_RED = "#C8102E";
export const NBA_BLUE = "#1D428A";
/** Lighter steps that survive on dark surfaces (chrome accents, not marks). */
export const NBA_RED_LIGHT = "#e5484d";
export const NBA_BLUE_LIGHT = "#3987e5";

/** Hardwood court tones (washes — keep alpha low under dark UI). */
export const COURT_MAPLE = "#c18a4e";
export const COURT_LINE = "rgba(255,255,255,0.14)";

export const NBA_DISPLAY_FONT = "'Anton', 'Outfit', sans-serif";
