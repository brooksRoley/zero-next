/**
 * CBA salary-matching rules for two-team trades (2023 CBA, 2026-27 figures).
 *
 * Sources: the traded-player exception tiers and apron restrictions as
 * commonly summarized (cbafaq.com); tier bounds index with cap growth and
 * are approximations of the league's official indexed amounts — the UI
 * labels them as such. This models MATCHING legality only: it does not model
 * hard-cap consequences, exceptions (MLE/BAE), sign-and-trades, or draft
 * pick compensation.
 *
 * Rules modeled:
 * - Team below the first apron post-trade takes back up to the greater of:
 *     · 200% of outgoing + $250K            (outgoing ≤ small tier)
 *     · outgoing + indexed mid bump          (small tier < outgoing ≤ mid tier)
 *     · 125% of outgoing + $250K             (outgoing > mid tier)
 * - Team at/above the first apron post-trade: incoming ≤ 110% of outgoing.
 * - Team at/above the second apron post-trade: incoming ≤ 100% of outgoing,
 *   and it may not aggregate (send more than one player).
 * - A team with cap space may absorb salary into that space instead
 *   (incoming ≤ cap space + $100K room allowance approximation) — the
 *   evaluator picks whichever allowance is greater.
 */
import {
  SALARY_CAP,
  FIRST_APRON,
  SECOND_APRON,
  TPE_SMALL_MAX,
  TPE_MID_BUMP,
  TPE_MID_MAX,
  TPE_KICKER,
} from "src/lib/nba/capConstants";

export type TradePlayer = {
  id: number;
  name: string;
  salary: number;
  /** CBA trade-matching values from ESPN (equal to salary when absent). */
  incoming: number;
  outgoing: number;
};

export type TeamTradeSide = {
  abbrev: string;
  /** Full current payroll including the players being sent out. */
  payroll: number;
  out: TradePlayer[];
  in_: TradePlayer[];
};

export type SideVerdict = {
  abbrev: string;
  legal: boolean;
  rule: string;
  outgoing: number;
  incoming: number;
  allowed: number;
  payrollAfter: number;
  aprons: {
    beforeFirst: boolean;
    afterFirst: boolean;
    afterSecond: boolean;
  };
  warnings: string[];
};

export type TradeVerdict = {
  legal: boolean;
  sides: SideVerdict[];
};

export function sum(players: TradePlayer[], key: "incoming" | "outgoing" | "salary"): number {
  return players.reduce((a, p) => a + p[key], 0);
}

/** Matching allowance for a team below the first apron. */
export function standardAllowance(outgoing: number): number {
  if (outgoing <= TPE_SMALL_MAX) return outgoing * 2 + TPE_KICKER;
  if (outgoing <= TPE_MID_MAX) return outgoing + TPE_MID_BUMP;
  return outgoing * 1.25 + TPE_KICKER;
}

const ROOM_ALLOWANCE = 100_000;

export function evaluateSide(side: TeamTradeSide): SideVerdict {
  const outgoing = sum(side.out, "outgoing");
  const incoming = sum(side.in_, "incoming");
  const payrollAfter = side.payroll - sum(side.out, "salary") + sum(side.in_, "salary");
  const capSpace = Math.max(0, SALARY_CAP - (side.payroll - sum(side.out, "salary")));

  const afterFirst = payrollAfter >= FIRST_APRON;
  const afterSecond = payrollAfter >= SECOND_APRON;
  const warnings: string[] = [];

  let allowed: number;
  let rule: string;
  if (afterSecond) {
    allowed = outgoing;
    rule = "Second apron: incoming may not exceed outgoing (100%)";
    if (side.out.length > 1) {
      warnings.push("Second-apron teams may not aggregate salaries — this side sends more than one player.");
    }
  } else if (afterFirst) {
    allowed = outgoing * 1.1;
    rule = "First apron: incoming capped at 110% of outgoing";
  } else {
    const matching = standardAllowance(outgoing);
    const absorption = capSpace + ROOM_ALLOWANCE;
    if (absorption > matching) {
      allowed = absorption;
      rule = "Cap-space absorption: incoming fits into room";
    } else {
      allowed = matching;
      rule =
        outgoing <= TPE_SMALL_MAX
          ? "Standard matching: 200% of outgoing + $250K"
          : outgoing <= TPE_MID_MAX
            ? "Standard matching: outgoing + indexed mid-tier bump"
            : "Standard matching: 125% of outgoing + $250K";
    }
  }

  const aggregationIllegal = afterSecond && side.out.length > 1;
  const legal = incoming <= allowed && !aggregationIllegal;

  if (side.in_.length > 0 && side.out.length === 0 && capSpace + ROOM_ALLOWANCE < incoming) {
    warnings.push("Taking back salary with nothing outgoing requires cap space or an exception.");
  }

  return {
    abbrev: side.abbrev,
    legal,
    rule,
    outgoing,
    incoming,
    allowed: Math.round(allowed),
    payrollAfter: Math.round(payrollAfter),
    aprons: {
      beforeFirst: side.payroll >= FIRST_APRON,
      afterFirst,
      afterSecond,
    },
    warnings,
  };
}

/** Evaluate a two-team trade: each side is judged independently. */
export function evaluateTrade(a: TeamTradeSide, b: TeamTradeSide): TradeVerdict {
  const sides = [evaluateSide(a), evaluateSide(b)];
  return { legal: sides.every((s) => s.legal), sides };
}
