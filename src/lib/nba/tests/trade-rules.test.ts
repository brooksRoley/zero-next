import { describe, it, expect } from "vitest";
import {
  evaluateSide,
  evaluateTrade,
  standardAllowance,
  type TeamTradeSide,
  type TradePlayer,
} from "src/lib/nba/tradeRules";
import {
  SALARY_CAP,
  FIRST_APRON,
  SECOND_APRON,
  TPE_SMALL_MAX,
  TPE_MID_MAX,
  TPE_KICKER,
  TPE_MID_BUMP,
} from "src/lib/nba/capConstants";

let nextId = 1;
function player(salary: number, name = `P${nextId}`): TradePlayer {
  return { id: nextId++, name, salary, incoming: salary, outgoing: salary };
}

function side(payroll: number, out: TradePlayer[], in_: TradePlayer[]): TeamTradeSide {
  return { abbrev: "TST", payroll, out, in_ };
}

describe("standardAllowance", () => {
  it("uses 200% + 250K for small outgoing salaries", () => {
    expect(standardAllowance(5_000_000)).toBe(10_000_000 + TPE_KICKER);
    expect(standardAllowance(TPE_SMALL_MAX)).toBe(TPE_SMALL_MAX * 2 + TPE_KICKER);
  });

  it("uses outgoing + mid bump in the middle tier", () => {
    const mid = TPE_SMALL_MAX + 1_000_000;
    expect(standardAllowance(mid)).toBe(mid + TPE_MID_BUMP);
  });

  it("uses 125% + 250K above the mid tier", () => {
    const big = TPE_MID_MAX + 5_000_000;
    expect(standardAllowance(big)).toBe(big * 1.25 + TPE_KICKER);
  });
});

describe("evaluateSide", () => {
  it("legal: over-cap, below-apron team takes back within 200% of a small salary", () => {
    // Over the cap (no room to absorb into) but below the first apron.
    const v = evaluateSide(side(175_000_000, [player(5_000_000)], [player(9_000_000)]));
    expect(v.legal).toBe(true);
    expect(v.rule).toContain("200%");
  });

  it("illegal: over-cap team exceeds the matching allowance", () => {
    const v = evaluateSide(side(175_000_000, [player(5_000_000)], [player(11_000_000)]));
    expect(v.legal).toBe(false);
  });

  it("first-apron team is capped at 110%", () => {
    // Payroll lands above the first apron after the trade.
    const payroll = FIRST_APRON + 5_000_000;
    const legal = evaluateSide(side(payroll, [player(20_000_000)], [player(21_900_000)]));
    expect(legal.legal).toBe(true);
    expect(legal.rule).toContain("110%");
    const illegal = evaluateSide(side(payroll, [player(20_000_000)], [player(22_100_000)]));
    expect(illegal.legal).toBe(false);
  });

  it("second-apron team cannot take back more than it sends or aggregate", () => {
    const payroll = SECOND_APRON + 10_000_000;
    const even = evaluateSide(side(payroll, [player(30_000_000)], [player(30_000_000)]));
    expect(even.legal).toBe(true);
    expect(even.rule).toContain("Second apron");

    const over = evaluateSide(side(payroll, [player(30_000_000)], [player(30_000_001)]));
    expect(over.legal).toBe(false);

    const aggregated = evaluateSide(
      side(payroll, [player(15_000_000), player(15_000_000)], [player(29_000_000)])
    );
    expect(aggregated.legal).toBe(false);
    expect(aggregated.warnings.join(" ")).toContain("aggregate");
  });

  it("apron status is judged on post-trade payroll, not pre-trade", () => {
    // Pre-trade payroll above the first apron, but dumping salary drops the
    // team below it — the standard (not 110%) rule applies.
    const payroll = FIRST_APRON + 1_000_000;
    const v = evaluateSide(side(payroll, [player(40_000_000)], [player(10_000_000)]));
    expect(v.aprons.beforeFirst).toBe(true);
    expect(v.aprons.afterFirst).toBe(false);
    expect(v.rule).not.toContain("110%");
    expect(v.legal).toBe(true);
  });

  it("a team with cap space can absorb salary with nothing outgoing", () => {
    const payroll = SALARY_CAP - 30_000_000; // $30M in room
    const v = evaluateSide(side(payroll, [], [player(25_000_000)]));
    expect(v.legal).toBe(true);
    expect(v.rule).toContain("absorption");

    const over = evaluateSide(side(payroll, [], [player(31_000_000)]));
    expect(over.legal).toBe(false);
  });

  it("payrollAfter reflects salaries in and out", () => {
    const v = evaluateSide(side(180_000_000, [player(20_000_000)], [player(25_000_000)]));
    expect(v.payrollAfter).toBe(185_000_000);
  });
});

describe("evaluateTrade", () => {
  it("both sides must pass", () => {
    // Team A (below apron) dumps $30M for $10M — legal for A.
    const a = side(190_000_000, [player(30_000_000)], [player(10_000_000)]);
    // Team B (second apron) takes back $30M for $10M — illegal for B.
    const b: TeamTradeSide = {
      abbrev: "TAX",
      payroll: SECOND_APRON + 5_000_000,
      out: [player(10_000_000)],
      in_: [player(30_000_000)],
    };
    const verdict = evaluateTrade(a, b);
    expect(verdict.sides[0].legal).toBe(true);
    expect(verdict.sides[1].legal).toBe(false);
    expect(verdict.legal).toBe(false);
  });
});
