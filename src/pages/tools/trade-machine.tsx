/**
 * /tools/trade-machine — NBA Salary Cap explorer & Trade Machine (2026-27).
 *
 * Four layers: the cap system explained (floor → cap → tax → aprons), every
 * team's payroll charted against those lines, a CBA-rules trade machine
 * powered by real ESPN contract data (via /api/nba/salaries), and the
 * legalese that shapes rosters — draft-pick trade rules, experience-based
 * salary tiers, and where the cap is headed.
 *
 * Chart colors follow the dataviz method: a single-hue ordinal ramp for the
 * payroll zones (validated on the slate-900 surface: monotone lightness,
 * visible step gaps), status colors only for trade verdicts, always paired
 * with an icon + word.
 */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { track } from "src/lib/analytics";
import {
  CAP_SEASON_LABEL,
  SALARY_CAP,
  SALARY_FLOOR,
  LUXURY_TAX,
  FIRST_APRON,
  SECOND_APRON,
} from "src/lib/nba/capConstants";
import { evaluateTrade, type TeamTradeSide, type SideVerdict } from "src/lib/nba/tradeRules";
import type { SalaryTeam, SalaryPlayer } from "src/pages/api/nba/salaries";

type SalariesResponse = {
  season: string;
  thresholds: { cap: number; floor: number; tax: number; firstApron: number; secondApron: number };
  teams: SalaryTeam[];
  contracts: number;
  updatedAt: string | null;
};

const INK = { primary: "#ffffff", secondary: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", axis: "#383835" };
const STATUS = { good: "#0ca30c", critical: "#d03b3b" };
// Ordinal payroll-zone ramp (one hue, dark→light = under cap → second apron;
// on a dark surface the light end pops, so the deepest spenders are loudest).
const ZONES = [
  { label: "Under the cap", color: "#184f95" },
  { label: "Over the cap", color: "#256abf" },
  { label: "Taxpayer", color: "#3987e5" },
  { label: "First apron", color: "#86b6ef" },
  { label: "Second apron", color: "#cde2fb" },
] as const;

function zoneIndex(payroll: number): number {
  if (payroll < SALARY_CAP) return 0;
  if (payroll < LUXURY_TAX) return 1;
  if (payroll < FIRST_APRON) return 2;
  if (payroll < SECOND_APRON) return 3;
  return 4;
}

const fmtM = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const fmtM0 = (n: number) => `$${Math.round(n / 1e6)}M`;

/** Bar with the data end rounded, baseline end square. */
function roundedBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - 2 * rr} a${rr},${rr} 0 0 1 -${rr},${rr} h-${w - rr} z`;
}

/* ---------------------------- The System ladder --------------------------- */

const LADDER = [
  {
    name: "Salary floor",
    value: SALARY_FLOOR,
    note: "Teams must spend at least this (90% of the cap). Come in under and the shortfall is paid to your own players.",
  },
  {
    name: "Salary cap",
    value: SALARY_CAP,
    note: "A soft cap — teams routinely pass it using exceptions (Bird rights, mid-level). Room below it is 'cap space'.",
  },
  {
    name: "Luxury tax",
    value: LUXURY_TAX,
    note: "Every dollar above this line is taxed on a progressive scale — repeat offenders pay steeper 'repeater' rates.",
  },
  {
    name: "First apron",
    value: FIRST_APRON,
    note: "Trade math tightens to 110% take-back, no sign-and-trade acquisitions, no buyout-market signings above the mid-level.",
  },
  {
    name: "Second apron",
    value: SECOND_APRON,
    note: "The freeze: no aggregating salaries in trades, no cash in deals, no taxpayer mid-level, and your 1st-round pick seven years out can be frozen.",
  },
];

function SystemLadder() {
  const min = 140_000_000;
  const max = 232_000_000;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="relative h-9 rounded-md overflow-hidden flex" aria-hidden="true">
        {ZONES.map((z, i) => {
          const from = i === 0 ? min : LADDER[i].value;
          const to = i === 4 ? max : LADDER[i + 1].value;
          return (
            <div
              key={z.label}
              style={{ width: `${pct(to) - pct(from)}%`, backgroundColor: z.color, marginLeft: i ? 2 : 0 }}
            />
          );
        })}
      </div>
      <div className="mt-5 space-y-4">
        {LADDER.map((row, i) => (
          <div key={row.name} className="flex gap-3">
            <span
              className="mt-1 h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: i === 0 ? INK.axis : ZONES[i - 0].color }}
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{row.name}</span>{" "}
              <span className="text-slate-400 tabular-nums">{fmtM(row.value)}</span>
              {" — "}
              {row.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- League payroll chart --------------------------- */

function PayrollChart({ teams }: { teams: SalaryTeam[] }) {
  const [hover, setHover] = useState<{ team: SalaryTeam; x: number; y: number } | null>(null);

  const W = 780;
  const ROW = 21;
  const TOP = 40;
  const LEFT = 46;
  const RIGHT = 58;
  const H = TOP + teams.length * ROW + 8;
  const domainMax = Math.max(SECOND_APRON + 10_000_000, ...teams.map((t) => t.payroll)) * 1.02;
  const x = (v: number) => LEFT + (v / domainMax) * (W - LEFT - RIGHT);

  const thresholds = [
    { label: "Floor", v: SALARY_FLOOR, row: 0 },
    { label: "Cap", v: SALARY_CAP, row: 1 },
    { label: "Tax", v: LUXURY_TAX, row: 0 },
    { label: "Apron 1", v: FIRST_APRON, row: 1 },
    { label: "Apron 2", v: SECOND_APRON, row: 0 },
  ];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3" role="list" aria-label="Payroll zones">
        {ZONES.map((z) => (
          <span key={z.label} role="listitem" className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: z.color }} aria-hidden="true" />
            {z.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px] h-auto"
          role="img"
          aria-label={`Team payrolls for ${CAP_SEASON_LABEL} against the cap, tax, and apron lines`}
          onMouseLeave={() => setHover(null)}
        >
          {thresholds.map((t) => (
            <g key={t.label}>
              <line x1={x(t.v)} x2={x(t.v)} y1={TOP - 4} y2={H - 6} stroke={INK.axis} strokeWidth={1} strokeDasharray="3 3" />
              <text x={x(t.v)} y={t.row === 0 ? 12 : 26} textAnchor="middle" fontSize={10} fill={INK.muted}>
                {t.label} {fmtM0(t.v)}
              </text>
            </g>
          ))}
          {teams.map((t, i) => {
            const y = TOP + i * ROW;
            const w = Math.max(2, x(t.payroll) - LEFT);
            const zone = ZONES[zoneIndex(t.payroll)];
            return (
              <g
                key={t.teamId}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({ team: t, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
              >
                <rect x={0} y={y - 3} width={W} height={ROW} fill="transparent" />
                <text x={LEFT - 6} y={y + 10} textAnchor="end" fontSize={10} fill={INK.secondary}>
                  {t.abbrev}
                </text>
                <path d={roundedBar(LEFT, y, w, 13, 4)} fill={zone.color} />
                <text
                  x={x(t.payroll) + 5}
                  y={y + 10}
                  fontSize={9.5}
                  fill={INK.muted}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtM(t.payroll)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-white/10 bg-slate-950/95 px-3 py-2 text-xs shadow-xl"
          style={{
            left: `min(calc(${(hover.x / W) * 100}% + 14px), calc(100% - 200px))`,
            top: hover.y + 10,
            width: 190,
          }}
        >
          <p className="font-semibold text-white">{hover.team.name}</p>
          <p className="text-slate-300 tabular-nums">
            {fmtM(hover.team.payroll)} · {ZONES[zoneIndex(hover.team.payroll)].label}
          </p>
          <p className="mt-1 text-slate-400">
            {hover.team.payroll < LUXURY_TAX
              ? `${fmtM(LUXURY_TAX - hover.team.payroll)} below the tax`
              : `${fmtM(hover.team.payroll - LUXURY_TAX)} into the tax`}
          </p>
          <ul className="mt-1.5 border-t border-white/10 pt-1.5 space-y-0.5">
            {hover.team.players.slice(0, 3).map((p) => (
              <li key={p.id} className="flex justify-between gap-2 text-slate-300">
                <span className="truncate">{p.name}</span>
                <span className="tabular-nums text-slate-400">{fmtM(p.salary)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">View as table</summary>
        <div className="overflow-x-auto mt-2">
          <table className="text-xs text-slate-300 w-full max-w-lg">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pr-4 py-1 font-medium">Team</th>
                <th className="pr-4 py-1 font-medium">Payroll</th>
                <th className="py-1 font-medium">Zone</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.teamId} className="border-t border-white/5">
                  <td className="pr-4 py-1">{t.name}</td>
                  <td className="pr-4 py-1 tabular-nums">{fmtM(t.payroll)}</td>
                  <td className="py-1">{ZONES[zoneIndex(t.payroll)].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------ Trade machine ----------------------------- */

function toTradePlayer(p: SalaryPlayer) {
  return { id: p.id, name: p.name, salary: p.salary, incoming: p.incoming, outgoing: p.outgoing };
}

function VerdictPanel({ v }: { v: SideVerdict }) {
  const zone = ZONES[zoneIndex(v.payrollAfter)];
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: v.legal ? `${STATUS.good}55` : `${STATUS.critical}66` }}
    >
      <p className="flex items-center gap-2 font-semibold" style={{ color: v.legal ? STATUS.good : STATUS.critical }}>
        <span aria-hidden="true">{v.legal ? "✓" : "✗"}</span>
        {v.abbrev}: {v.legal ? "Legal" : "Over the limit"}
      </p>
      <p className="mt-1 text-xs text-slate-400">{v.rule}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Sends out</dt>
          <dd className="text-slate-200 tabular-nums">{fmtM(v.outgoing)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Takes back</dt>
          <dd className="tabular-nums" style={{ color: v.legal ? "#e2e8f0" : STATUS.critical }}>
            {fmtM(v.incoming)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Allowed</dt>
          <dd className="text-slate-200 tabular-nums">{fmtM(v.allowed)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">
        Payroll after: <span className="tabular-nums text-slate-200">{fmtM(v.payrollAfter)}</span>{" "}
        <span className="inline-flex items-center gap-1 ml-1">
          <span className="h-2 w-2 rounded-sm inline-block" style={{ backgroundColor: zone.color }} aria-hidden="true" />
          {zone.label}
        </span>
      </p>
      {v.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs" style={{ color: STATUS.critical }}>
          ⚠ {w}
        </p>
      ))}
    </div>
  );
}

function TeamColumn({
  teams,
  teamId,
  onTeam,
  selected,
  onToggle,
  exclude,
}: {
  teams: SalaryTeam[];
  teamId: number;
  onTeam: (id: number) => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  exclude: number;
}) {
  const team = teams.find((t) => t.teamId === teamId);
  return (
    <div className="flex-1 min-w-0">
      <select
        value={teamId}
        onChange={(e) => onTeam(Number(e.target.value))}
        className="w-full rounded-md bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white"
        aria-label="Select team"
      >
        {teams
          .filter((t) => t.teamId !== exclude)
          .map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.name} — {fmtM(t.payroll)}
            </option>
          ))}
      </select>
      <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-white/5 divide-y divide-white/5">
        {team?.players.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
                className="accent-blue-500"
              />
              <span className="flex-1 truncate text-slate-200">{p.name}</span>
              {p.yearsRemaining > 1 && (
                <span className="text-slate-500">{p.yearsRemaining}yr</span>
              )}
              <span className="tabular-nums text-slate-400">{fmtM(p.salary)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeMachine({ teams }: { teams: SalaryTeam[] }) {
  const [teamA, setTeamA] = useState(() => teams.find((t) => t.abbrev === "LAL")?.teamId ?? teams[0].teamId);
  const [teamB, setTeamB] = useState(() => teams.find((t) => t.teamId !== teamA)!.teamId);
  const [outA, setOutA] = useState<Set<number>>(new Set());
  const [outB, setOutB] = useState<Set<number>>(new Set());
  const [tracked, setTracked] = useState(false);

  const a = teams.find((t) => t.teamId === teamA)!;
  const b = teams.find((t) => t.teamId === teamB)!;

  const verdict = useMemo(() => {
    if (outA.size === 0 && outB.size === 0) return null;
    const sideA: TeamTradeSide = {
      abbrev: a.abbrev,
      payroll: a.payroll,
      out: a.players.filter((p) => outA.has(p.id)).map(toTradePlayer),
      in_: b.players.filter((p) => outB.has(p.id)).map(toTradePlayer),
    };
    const sideB: TeamTradeSide = {
      abbrev: b.abbrev,
      payroll: b.payroll,
      out: b.players.filter((p) => outB.has(p.id)).map(toTradePlayer),
      in_: a.players.filter((p) => outA.has(p.id)).map(toTradePlayer),
    };
    return evaluateTrade(sideA, sideB);
  }, [a, b, outA, outB]);

  useEffect(() => {
    if (verdict && !tracked) {
      track("trade_machine_evaluate", { metadata: { legal: verdict.legal } });
      setTracked(true);
    }
  }, [verdict, tracked]);

  function pickTeam(side: "A" | "B", id: number) {
    if (side === "A") {
      setTeamA(id);
      setOutA(new Set());
    } else {
      setTeamB(id);
      setOutB(new Set());
    }
  }
  function toggle(side: "A" | "B", id: number) {
    const [sel, set] = side === "A" ? [outA, setOutA] : [outB, setOutB];
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set(next);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4">
        <TeamColumn teams={teams} teamId={teamA} onTeam={(id) => pickTeam("A", id)} selected={outA} onToggle={(id) => toggle("A", id)} exclude={teamB} />
        <div className="self-center text-slate-500 text-xl px-1" aria-hidden="true">⇄</div>
        <TeamColumn teams={teams} teamId={teamB} onTeam={(id) => pickTeam("B", id)} selected={outB} onToggle={(id) => toggle("B", id)} exclude={teamA} />
      </div>
      {verdict ? (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {verdict.sides.map((s) => (
            <VerdictPanel key={s.abbrev} v={s} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Check players on each side to test a trade against the {CAP_SEASON_LABEL} matching rules.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Models salary matching only — not hard-cap triggers, exceptions, sign-and-trades, or pick compensation.
        Tier bounds are cap-indexed approximations of the official CBA amounts.
      </p>
    </div>
  );
}

/* ------------------------ Experience & draft legalese --------------------- */

function ExperienceTiers() {
  const tiers = [
    { yrs: "0–6 years", pct: 0.25 },
    { yrs: "7–9 years", pct: 0.3 },
    { yrs: "10+ years", pct: 0.35 },
  ];
  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div key={t.yrs} className="rounded-lg border border-white/10 p-4">
            <p className="text-xs text-slate-400">{t.yrs} of service</p>
            <p className="mt-1 text-2xl font-semibold text-white">{fmtM(SALARY_CAP * t.pct)}</p>
            <p className="text-xs text-slate-500">max starting salary ({t.pct * 100}% of cap)</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        A max contract is defined by years of service, not talent: a 26-year-old superstar and a 26-year-old
        role player have the same 25% ceiling. Raises run 8% per year with Bird rights (re-signing with your own
        team) vs 5% leaving — that spread is why stars rarely walk for nothing. Minimum salaries also scale with
        experience, from roughly $1.4M for a rookie to about $4.2M at 10+ years (approximate {CAP_SEASON_LABEL}{" "}
        scale). Rookie first-rounders sign fixed &ldquo;rookie scale&rdquo; deals slotted by pick number — the
        cheapest good contracts in the sport, which is why picks are currency.
      </p>
    </div>
  );
}

function StepienTimeline() {
  const legal = [2027, 2029, 2031, 2033];
  const years = [2027, 2028, 2029, 2030, 2031, 2032, 2033];
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <p className="text-xs text-slate-400 mb-2">
        The Stepien rule in practice — a team can trade at most every-other future first:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {years.map((y) => {
          const traded = legal.includes(y);
          return (
            <span
              key={y}
              className="rounded px-2 py-1 text-xs tabular-nums"
              style={{
                backgroundColor: traded ? "rgba(57,135,229,0.22)" : "rgba(255,255,255,0.05)",
                color: traded ? "#9ec5f4" : "#898781",
              }}
            >
              {y} {traded ? "→ tradeable" : "→ must keep"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const PICK_RULES = [
  {
    name: "The Stepien rule",
    text: "A team may never leave itself without a first-round pick in two consecutive future drafts. Trade your 2027 first and your 2028 first is locked — which is why blockbusters are built on alternating years plus swaps.",
  },
  {
    name: "The seven-year window",
    text: "Picks can only be traded up to seven drafts out. You cannot mortgage a decade — the 2033 draft is the current horizon.",
  },
  {
    name: "Protections",
    text: "Picks travel with conditions — 'top-10 protected' means the seller keeps it if it lands in the top 10, and it rolls to next year or converts to second-rounders if it keeps missing.",
  },
  {
    name: "The second-apron pick freeze",
    text: "Finish a season above the second apron and your first seven years out is frozen (untradeable). Stay there three seasons in five and that pick drops to the end of the round — the CBA's way of making deep-tax dynasties pay in draft capital, not just dollars.",
  },
];

/* ----------------------------- Cap trajectory ----------------------------- */

const CAP_HISTORY: Array<[string, number]> = [
  ["2015-16", 70_000_000],
  ["2016-17", 94_143_000],
  ["2017-18", 99_093_000],
  ["2018-19", 101_869_000],
  ["2019-20", 109_140_000],
  ["2020-21", 109_140_000],
  ["2021-22", 112_414_000],
  ["2022-23", 123_655_000],
  ["2023-24", 136_021_000],
  ["2024-25", 140_588_000],
  ["2025-26", 154_647_000],
  ["2026-27", 164_961_000],
];

function CapTrajectory() {
  const [hover, setHover] = useState<number | null>(null);
  const PROJ_YEARS = ["2027-28", "2028-29", "2029-30", "2030-31"];
  const projection = PROJ_YEARS.map((label, i) => ({
    label,
    low: SALARY_CAP * Math.pow(1.045, i + 1),
    mid: SALARY_CAP * Math.pow(1.07, i + 1),
    high: SALARY_CAP * Math.pow(1.1, i + 1),
  }));

  const all = [...CAP_HISTORY.map(([label, v]) => ({ label, v })), ...projection.map((p) => ({ label: p.label, v: p.mid }))];
  const W = 780;
  const H = 260;
  const PAD = { l: 46, r: 16, t: 16, b: 28 };
  const maxV = projection[projection.length - 1].high * 1.05;
  const x = (i: number) => PAD.l + (i / (all.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxV) * (H - PAD.t - PAD.b);
  const histN = CAP_HISTORY.length;

  const histLine = CAP_HISTORY.map(([, v], i) => `${x(i)},${y(v)}`).join(" ");
  const midLine = [
    `${x(histN - 1)},${y(SALARY_CAP)}`,
    ...projection.map((p, i) => `${x(histN + i)},${y(p.mid)}`),
  ].join(" ");
  const band =
    `${x(histN - 1)},${y(SALARY_CAP)} ` +
    projection.map((p, i) => `${x(histN + i)},${y(p.high)}`).join(" ") +
    ` ${projection
      .map((p, i) => `${x(histN + projection.length - 1 - i)},${y(projection[projection.length - 1 - i].low)}`)
      .join(" ")} ${x(histN - 1)},${y(SALARY_CAP)}`;

  const hoverPoint =
    hover == null
      ? null
      : hover < histN
        ? { label: all[hover].label, v: CAP_HISTORY[hover][1], proj: false }
        : { label: all[hover].label, v: projection[hover - histN].mid, proj: true };

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px] h-auto"
          role="img"
          aria-label="Salary cap by season since 2015-16 with a projected range through 2030-31"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (all.length - 1));
            setHover(Math.max(0, Math.min(all.length - 1, i)));
          }}
        >
          {[80e6, 120e6, 160e6, 200e6].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={INK.grid} strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={9.5} fill={INK.muted}>
                {fmtM0(v)}
              </text>
            </g>
          ))}
          <polygon points={band} fill="#3987e5" opacity={0.14} />
          <polyline points={histLine} fill="none" stroke="#3987e5" strokeWidth={2} />
          <polyline points={midLine} fill="none" stroke="#3987e5" strokeWidth={2} strokeDasharray="5 4" />
          {[0, 4, 8, histN - 1, all.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill={INK.muted}>
              {all[i].label}
            </text>
          ))}
          {hover != null && hoverPoint && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke={INK.axis} strokeWidth={1} />
              <circle cx={x(hover)} cy={y(hoverPoint.v)} r={4} fill="#3987e5" stroke="#0f172a" strokeWidth={2} />
            </g>
          )}
        </svg>
      </div>
      {hover != null && hoverPoint && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md border border-white/10 bg-slate-950/95 px-3 py-1.5 text-xs"
          style={{ left: `min(calc(${(x(hover) / W) * 100}% + 10px), calc(100% - 150px))` }}
        >
          <span className="text-white font-medium">{hoverPoint.label}</span>{" "}
          <span className="text-slate-300 tabular-nums">{fmtM(hoverPoint.v)}</span>
          {hoverPoint.proj && <span className="text-slate-500"> · projected mid</span>}
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        The dashed line projects ~7% annual growth; the band spans a conservative 4.5% to the CBA&rsquo;s 10%
        yearly maximum (cap smoothing caps growth at 10% no matter how fast league revenue rises — the lesson of
        the 2016 spike, when a un-smoothed TV deal jumped the cap 34% in one summer and broke the market).
        2026-27 itself came in below early projections on a media-revenue dip. A contract that looks heavy today
        <em> deflates</em> as the cap grows — a $40M salary is 24% of this year&rsquo;s cap but ~18% of the
        projected 2030-31 cap. That&rsquo;s the &ldquo;growth&rdquo; bet behind every long extension; the
        deterioration bet is a declining player aging faster than the cap inflates his deal away.
      </p>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-slate-900 border border-white/5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function TradeMachinePage() {
  const [data, setData] = useState<SalariesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("trade_machine_view");
    fetch("/api/nba/salaries")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e16] text-slate-200">
      <Head>
        <title>NBA Salary Cap & Trade Machine — {CAP_SEASON_LABEL}</title>
        <meta
          name="description"
          content="Every NBA team's payroll against the cap, tax, and aprons — plus a CBA-rules trade machine, the draft-pick legalese, and where the cap is headed."
        />
      </Head>
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <header>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← brooksroley.com
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
            The Salary Cap, Visualized
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            {CAP_SEASON_LABEL} payrolls from live contract data, the apron system in plain English, a trade
            machine that enforces the real matching rules, and the legalese that turns draft picks into currency.
          </p>
        </header>

        <Section title="The system" sub="Five lines that define every front office's summer.">
          <SystemLadder />
        </Section>

        <Section
          title="Where all 30 teams stand"
          sub={data ? `Active ${data.season} contracts · updated ${data.updatedAt ? new Date(data.updatedAt as string).toLocaleDateString() : "recently"}` : undefined}
        >
          {error && (
            <p className="text-sm" style={{ color: STATUS.critical }}>
              ✗ Salary data unavailable: {error}
            </p>
          )}
          {!data && !error && <p className="text-sm text-slate-500">Loading contract data…</p>}
          {data && <PayrollChart teams={data.teams} />}
          {data && (
            <p className="mt-3 text-xs text-slate-500">
              Sums active player contracts only — cap holds, dead money from waived-and-stretched deals, and
              unsigned draft picks are not included, so official cap sheets will differ slightly.
            </p>
          )}
        </Section>

        <Section title="Trade machine" sub="Pick two teams, check the players going each way, and see whether the CBA lets it through.">
          {data ? (
            <TradeMachine teams={data.teams} />
          ) : (
            <p className="text-sm text-slate-500">{error ? "Needs salary data to work." : "Loading…"}</p>
          )}
        </Section>

        <Section title="What experience is worth" sub="Max salaries are set by years of service — a percentage of the cap, not a negotiation.">
          <ExperienceTiers />
        </Section>

        <Section title="Draft picks: the fine print" sub="Why 'we'll just trade picks' is harder than it sounds.">
          <div className="grid sm:grid-cols-2 gap-4">
            {PICK_RULES.map((r) => (
              <div key={r.name} className="rounded-lg border border-white/10 p-4">
                <p className="font-semibold text-white text-sm">{r.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <StepienTimeline />
          </div>
        </Section>

        <Section title="Where the cap is going" sub="Growth and deterioration: every contract is a bet against this curve.">
          <CapTrajectory />
        </Section>

        <footer className="text-xs text-slate-500 leading-relaxed">
          <p>
            Contract data: ESPN public API, refreshed daily. Cap figures: official {CAP_SEASON_LABEL} amounts set
            2026-07-01. Trade-tier bounds are cap-indexed approximations; this page explains the system and is
            not official cap accounting.
          </p>
          <p className="mt-2">
            More from the lab:{" "}
            <Link href="/tools/nba-accuracy" className="text-slate-400 hover:text-white underline">
              prediction accuracy
            </Link>{" "}
            ·{" "}
            <Link href="/games/hardwood" className="text-slate-400 hover:text-white underline">
              Hardwood Autochess
            </Link>{" "}
            ·{" "}
            <Link href="/funding" className="text-slate-400 hover:text-white underline">
              support this work
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
