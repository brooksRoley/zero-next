/**
 * League Lens — outlier/similarity explorer over stored, source-published
 * stats (3 seasons of ESPN per-game averages + contract salaries).
 * Rendered inside the /nba explorer when the league_lens node is active.
 *
 * All numbers shown are stored fields or arithmetic on them (z-scores for
 * position, deltas between seasons); nothing here fabricates advanced stats.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { zScores, zScoreMatrix, nearestNeighbors } from "src/lib/nba/analysis";
import type { LensPlayerRow } from "src/pages/api/nba/analytics/league-lens";

type LensTeam = {
  id: number;
  abbrev: string;
  name: string;
  conference: string;
  wins: number;
  losses: number;
  win_pct: number;
  payroll: number | null;
};

type LensPayload = {
  current_season: string;
  salary_season: string;
  thresholds: { cap: number; tax: number; firstApron: number; secondApron: number };
  players: LensPlayerRow[];
  teams: LensTeam[];
};

// ── Stat axes (stored fields only) ───────────────────────────────────────────
const STAT_OPTIONS: Array<{ key: keyof LensPlayerRow; label: string }> = [
  { key: "ppg", label: "Points /g" },
  { key: "rpg", label: "Rebounds /g" },
  { key: "apg", label: "Assists /g" },
  { key: "spg", label: "Steals /g" },
  { key: "bpg", label: "Blocks /g" },
  { key: "topg", label: "Turnovers /g" },
  { key: "fga", label: "FG att /g" },
  { key: "fg3a", label: "3P att /g" },
  { key: "fta", label: "FT att /g" },
  { key: "fg_pct", label: "FG%" },
  { key: "fg3_pct", label: "3P%" },
  { key: "ft_pct", label: "FT%" },
  { key: "mpg", label: "Minutes /g" },
  { key: "gp", label: "Games" },
  { key: "age", label: "Age" },
  { key: "salary", label: "Salary" },
];

// Fields the similarity engine z-scores (per-game statistical profile)
const SIM_FIELDS: Array<keyof LensPlayerRow> = [
  "ppg", "rpg", "apg", "spg", "bpg", "topg", "fga", "fg3a", "fta",
  "fg_pct", "fg3_pct", "ft_pct", "mpg",
];

// Validated dark-surface categorical palette (dataviz skill, surface #12151c):
// worst adjacent CVD ΔE 41.3, all ≥3:1. Order is fixed — never cycled.
const POS_COLORS: Record<string, string> = {
  G: "#3987e5",
  F: "#199e70",
  C: "#c98500",
  "?": "#8b8fa3",
};
const CONF_COLORS: Record<string, string> = { East: "#3987e5", West: "#199e70" };

const SURFACE = "#12151c";
const GRID = "#252a36";
const AXIS = "#8b8fa3";
const INK = "#e2e4e9";
const INK2 = "#8b8fa3";

function posGroup(pos: string): string {
  if (pos.includes("G")) return "G";
  if (pos.includes("F")) return "F";
  if (pos.includes("C")) return "C";
  return "?";
}

function fmtValue(key: string, v: number): string {
  if (key === "salary") return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`;
  if (key.endsWith("_pct")) return `${(v * 100).toFixed(1)}%`;
  if (key === "gp" || key === "age") return String(Math.round(v));
  return v.toFixed(1);
}

function fmtPayroll(v: number): string {
  return `$${(v / 1e6).toFixed(0)}M`;
}

/** 4-tick "nice" axis: clean step sizes over the data extent. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

// ── Scatter geometry ─────────────────────────────────────────────────────────
const W = 640;
const H = 400;
const PAD = { top: 16, right: 20, bottom: 40, left: 56 };

type Tooltip = { x: number; y: number; lines: Array<{ label: string; value: string; strong?: boolean }> };

export default function LeagueLens() {
  const [payload, setPayload] = useState<LensPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"scatter" | "breakout" | "teams">("scatter");
  const [season, setSeason] = useState<string>("");
  const [xKey, setXKey] = useState<keyof LensPlayerRow>("fga");
  const [yKey, setYKey] = useState<keyof LensPlayerRow>("ppg");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [youngOnly, setYoungOnly] = useState(true);
  const [breakoutPeriod, setBreakoutPeriod] = useState<string>("");
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/nba/analytics/league-lens")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!alive) return;
        setPayload(json.data);
        setSeason(json.data.current_season);
        const seasons: string[] = [...new Set<string>(json.data.players.map((p: LensPlayerRow) => p.season))].sort();
        if (seasons.length >= 2) setBreakoutPeriod(`${seasons[seasons.length - 2]}→${seasons[seasons.length - 1]}`);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  const seasons = useMemo(
    () => (payload ? [...new Set(payload.players.map((p) => p.season))].sort() : []),
    [payload]
  );

  // Rotation players for the selected season; salary axes drop unsigned rows.
  const pool = useMemo(() => {
    if (!payload) return [];
    let rows = payload.players.filter((p) => p.season === season && p.gp >= 20);
    if (xKey === "salary" || yKey === "salary") rows = rows.filter((p) => p.salary != null);
    if (xKey === "age" || yKey === "age") rows = rows.filter((p) => p.age != null);
    return rows;
  }, [payload, season, xKey, yKey]);

  const scatter = useMemo(() => {
    if (pool.length < 2) return null;
    const xs = pool.map((p) => Number(p[xKey]) || 0);
    const ys = pool.map((p) => Number(p[yKey]) || 0);
    const zx = zScores(xs);
    const zy = zScores(ys);
    const outlierScore = pool.map((_, i) => zx[i] ** 2 + zy[i] ** 2);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const px = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right);
    const py = (v: number) => H - PAD.bottom - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
    // Label up to 6 outliers, greedily skipping any whose label would sit on
    // top of an already-placed one (outlier clusters otherwise collide).
    const outliers = new Set<number>();
    const placed: Array<[number, number]> = [];
    for (const i of [...outlierScore.keys()].sort((a, b) => outlierScore[b] - outlierScore[a])) {
      if (outliers.size >= 6) break;
      const x = px(xs[i]), y = py(ys[i]);
      if (placed.some(([ox, oy]) => Math.abs(ox - x) < 70 && Math.abs(oy - y) < 14)) continue;
      outliers.add(i);
      placed.push([x, y]);
    }
    return { xs, ys, px, py, outliers, xTicks: niceTicks(xMin, xMax), yTicks: niceTicks(yMin, yMax) };
  }, [pool, xKey, yKey]);

  // Similarity: z-scored per-game profile, same-season pool
  const comps = useMemo(() => {
    if (selectedId == null || pool.length < 6) return null;
    const idx = pool.findIndex((p) => p.id === selectedId);
    if (idx < 0) return null;
    const vectors = zScoreMatrix(pool, SIM_FIELDS.map((f) => (row: LensPlayerRow) => Number(row[f]) || 0));
    return { target: pool[idx], rows: nearestNeighbors(vectors, idx, 5).map((n) => pool[n.index]) };
  }, [pool, selectedId]);

  // Breakout: deltas of stored values between consecutive seasons
  const breakout = useMemo(() => {
    if (!payload || !breakoutPeriod) return [];
    const [from, to] = breakoutPeriod.split("→");
    const fromRows = new Map(payload.players.filter((p) => p.season === from && p.gp >= 15).map((p) => [p.id, p]));
    return payload.players
      .filter((p) => p.season === to && p.gp >= 15 && fromRows.has(p.id))
      .filter((p) => !youngOnly || (p.age != null && p.age <= 25))
      .map((p) => {
        const prev = fromRows.get(p.id)!;
        return { p, dMpg: p.mpg - prev.mpg, dPpg: p.ppg - prev.ppg, dFga: p.fga - prev.fga };
      })
      .sort((a, b) => b.dPpg - a.dPpg)
      .slice(0, 25);
  }, [payload, breakoutPeriod, youngOnly]);

  const teamScatter = useMemo(() => {
    if (!payload) return null;
    const teams = payload.teams.filter((t) => t.payroll != null);
    if (teams.length < 2) return null;
    const xs = teams.map((t) => t.payroll!);
    const ys = teams.map((t) => t.wins);
    const zx = zScores(xs), zy = zScores(ys);
    const score = teams.map((_, i) => zx[i] ** 2 + zy[i] ** 2);
    const labeled = new Set([...score.keys()].sort((a, b) => score[b] - score[a]).slice(0, 6));
    const xMin = Math.min(...xs, payload.thresholds.cap * 0.9);
    const xMax = Math.max(...xs, payload.thresholds.secondApron * 1.02);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const px = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right);
    const py = (v: number) => H - PAD.bottom - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
    return { teams, px, py, labeled, yTicks: niceTicks(yMin, yMax), xMin, xMax };
  }, [payload]);

  const statLabel = (key: string) => STAT_OPTIONS.find((s) => s.key === key)?.label ?? key;

  const showTip = (evt: React.MouseEvent | React.FocusEvent, lines: Tooltip["lines"]) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const target = (evt.target as SVGElement).getBoundingClientRect();
    // Clamp so the ~150px tooltip never clips at the panel's right edge
    setTooltip({
      x: Math.min(target.left + target.width / 2 - rect.left, rect.width - 160),
      y: target.top - rect.top,
      lines,
    });
  };

  if (error) {
    return (
      <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
        <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>League Lens unavailable</div>
        <div style={{ fontSize: 12, color: INK2 }}>{error}</div>
      </div>
    );
  }
  if (!payload) {
    return <div style={{ fontSize: 12, color: INK2, fontFamily: "'DM Mono', monospace", padding: "12px 0" }}>Loading league dataset…</div>;
  }

  const select = (value: string, onChange: (v: string) => void, options: Array<{ value: string; label: string }>, ariaLabel: string) => (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: "5px 8px", background: SURFACE, border: `1px solid ${GRID}`, borderRadius: 4, color: INK, fontFamily: "'DM Mono', monospace", fontSize: 11, outline: "none" }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const tabBtn = (key: typeof view, label: string) => (
    <button
      key={key}
      onClick={() => { setView(key); setTooltip(null); }}
      style={{
        padding: "5px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer",
        background: view === key ? GRID : "transparent", color: view === key ? INK : INK2,
        border: `1px solid ${GRID}`, borderRadius: 4,
      }}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Filter row — one row, above the charts */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {tabBtn("scatter", "Players")}
        {tabBtn("breakout", "Breakouts")}
        {tabBtn("teams", "Payroll vs Wins")}
        <span style={{ flex: 1 }} />
        {view !== "teams" && season && select(
          view === "scatter" ? season : breakoutPeriod,
          (v) => (view === "scatter" ? setSeason(v) : setBreakoutPeriod(v)),
          view === "scatter"
            ? seasons.map((s) => ({ value: s, label: s }))
            : seasons.slice(0, -1).map((s, i) => ({ value: `${s}→${seasons[i + 1]}`, label: `${s} → ${seasons[i + 1]}` })),
          view === "scatter" ? "Season" : "Period"
        )}
      </div>

      {view === "scatter" && scatter && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: INK2 }}>X</span>
            {select(String(xKey), (v) => setXKey(v as keyof LensPlayerRow), STAT_OPTIONS.map((s) => ({ value: String(s.key), label: s.label })), "X axis stat")}
            <span style={{ fontSize: 11, color: INK2 }}>Y</span>
            {select(String(yKey), (v) => setYKey(v as keyof LensPlayerRow), STAT_OPTIONS.map((s) => ({ value: String(s.key), label: s.label })), "Y axis stat")}
            {/* Legend — identity never rides color alone; labels are text tokens */}
            <span style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
              {(["G", "F", "C"] as const).map((g) => (
                <span key={g} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: INK2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: POS_COLORS[g], display: "inline-block" }} />
                  {g === "G" ? "Guards" : g === "F" ? "Forwards" : "Centers"}
                </span>
              ))}
            </span>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: SURFACE, borderRadius: 8, display: "block" }} role="img" aria-label={`${statLabel(String(yKey))} vs ${statLabel(String(xKey))} scatter`}>
            {/* hairline grid + ticks */}
            {scatter.yTicks.map((t) => (
              <g key={`y${t}`}>
                <line x1={PAD.left} x2={W - PAD.right} y1={scatter.py(t)} y2={scatter.py(t)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={scatter.py(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="'DM Mono', monospace">{fmtValue(String(yKey), t)}</text>
              </g>
            ))}
            {scatter.xTicks.map((t) => (
              <text key={`x${t}`} x={scatter.px(t)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={10} fill={AXIS} fontFamily="'DM Mono', monospace">{fmtValue(String(xKey), t)}</text>
            ))}
            <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke={GRID} strokeWidth={1} />
            <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={INK2}>{statLabel(String(xKey))}</text>
            <text x={12} y={(PAD.top + H - PAD.bottom) / 2} textAnchor="middle" fontSize={11} fill={INK2} transform={`rotate(-90 12 ${(PAD.top + H - PAD.bottom) / 2})`}>{statLabel(String(yKey))}</text>

            {/* marks: ≥8px dots, 2px surface ring; selected mark lifts */}
            {pool.map((p, i) => {
              const cx = scatter.px(scatter.xs[i]);
              const cy = scatter.py(scatter.ys[i]);
              const isSel = p.id === selectedId;
              return (
                <g key={`${p.id}-${p.season}`}>
                  <circle cx={cx} cy={cy} r={isSel ? 6 : 4.5} fill={POS_COLORS[posGroup(p.pos)]} stroke={SURFACE} strokeWidth={2} opacity={selectedId != null && !isSel ? 0.55 : 1} />
                  {/* 24px transparent hit target — the mark is never the hit area */}
                  <circle
                    cx={cx} cy={cy} r={12} fill="transparent" style={{ cursor: "pointer" }} tabIndex={0}
                    aria-label={`${p.name}: ${fmtValue(String(xKey), scatter.xs[i])} ${statLabel(String(xKey))}, ${fmtValue(String(yKey), scatter.ys[i])} ${statLabel(String(yKey))}`}
                    onMouseEnter={(e) => showTip(e, [
                      { label: "", value: p.name, strong: true },
                      { label: statLabel(String(xKey)), value: fmtValue(String(xKey), scatter.xs[i]) },
                      { label: statLabel(String(yKey)), value: fmtValue(String(yKey), scatter.ys[i]) },
                      { label: `${p.team} · ${p.pos || "—"}`, value: p.salary != null ? fmtValue("salary", p.salary) : "unsigned" },
                    ])}
                    onFocus={(e) => showTip(e, [{ label: "", value: p.name, strong: true }, { label: statLabel(String(yKey)), value: fmtValue(String(yKey), scatter.ys[i]) }])}
                    onMouseLeave={() => setTooltip(null)}
                    onBlur={() => setTooltip(null)}
                    onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                  />
                  {/* selective direct labels: statistical outliers only, in ink;
                      anchor flips near the right edge so text never clips */}
                  {scatter.outliers.has(i) && (
                    <text
                      x={cx > W - 90 ? cx - 8 : cx + 8}
                      y={cy - 7}
                      textAnchor={cx > W - 90 ? "end" : "start"}
                      fontSize={10} fill={INK} fontFamily="'Outfit', sans-serif"
                    >
                      {p.name.split(" ").slice(-1)[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 10, color: INK2, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
            {pool.length} players · ≥20 GP · {season} · labels mark the 6 biggest combined-z outliers · click a dot for comps
            <button onClick={() => setShowTable(!showTable)} style={{ marginLeft: 10, background: "none", border: "none", color: "#fb923c", cursor: "pointer", fontSize: 10, fontFamily: "inherit", padding: 0 }}>
              {showTable ? "hide table" : "table view"}
            </button>
          </div>

          {showTable && (
            <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8, border: `1px solid ${GRID}`, borderRadius: 6 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", fontFamily: "'DM Mono', monospace" }}>
                <thead>
                  <tr style={{ color: INK2, textAlign: "left" }}>
                    {["Player", "Team", "Pos", statLabel(String(xKey)), statLabel(String(yKey))].map((h) => (
                      <th key={h} style={{ padding: "6px 10px", position: "sticky", top: 0, background: SURFACE, fontVariantNumeric: "tabular-nums" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...pool].sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0)).map((p) => (
                    <tr key={`${p.id}-t`} style={{ color: INK, borderTop: `1px solid ${GRID}` }}>
                      <td style={{ padding: "4px 10px" }}>{p.name}</td>
                      <td style={{ padding: "4px 10px", color: INK2 }}>{p.team}</td>
                      <td style={{ padding: "4px 10px", color: INK2 }}>{p.pos || "—"}</td>
                      <td style={{ padding: "4px 10px", fontVariantNumeric: "tabular-nums" }}>{fmtValue(String(xKey), Number(p[xKey]) || 0)}</td>
                      <td style={{ padding: "4px 10px", fontVariantNumeric: "tabular-nums" }}>{fmtValue(String(yKey), Number(p[yKey]) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {comps && (
            <div style={{ marginTop: 12, border: `1px solid ${GRID}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 6 }}>
                Closest statistical comps — {comps.target.name} <span style={{ color: INK2, fontWeight: 400 }}>({season}, z-scored per-game profile)</span>
              </div>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", fontFamily: "'DM Mono', monospace" }}>
                <thead>
                  <tr style={{ color: INK2, textAlign: "left" }}>
                    {["Player", "Team", "Pos", "PPG", "RPG", "APG", "Salary"].map((h) => <th key={h} style={{ padding: "4px 8px" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[comps.target, ...comps.rows].map((p, i) => (
                    <tr key={`${p.id}-c`} style={{ color: i === 0 ? "#fb923c" : INK, borderTop: `1px solid ${GRID}` }}>
                      <td style={{ padding: "4px 8px" }}>{p.name}</td>
                      <td style={{ padding: "4px 8px", color: INK2 }}>{p.team}</td>
                      <td style={{ padding: "4px 8px", color: INK2 }}>{p.pos || "—"}</td>
                      <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{p.ppg.toFixed(1)}</td>
                      <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{p.rpg.toFixed(1)}</td>
                      <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{p.apg.toFixed(1)}</td>
                      <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{p.salary != null ? fmtValue("salary", p.salary) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: INK2, marginTop: 6 }}>Trade-comp lens: similar production at a different price is the anomaly worth a look.</div>
            </div>
          )}
        </>
      )}

      {view === "breakout" && (
        <>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: INK2, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={youngOnly} onChange={(e) => setYoungOnly(e.target.checked)} />
            age ≤ 25 only
          </label>
          <div style={{ border: `1px solid ${GRID}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", fontFamily: "'DM Mono', monospace" }}>
              <thead>
                <tr style={{ color: INK2, textAlign: "left" }}>
                  {["Player", "Team", "Age", "Δ PPG", "Δ MPG", "Δ FGA", "PPG now"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", background: SURFACE }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakout.map(({ p, dMpg, dPpg, dFga }) => (
                  <tr key={`${p.id}-b`} style={{ color: INK, borderTop: `1px solid ${GRID}` }}>
                    <td style={{ padding: "5px 10px" }}>{p.name}</td>
                    <td style={{ padding: "5px 10px", color: INK2 }}>{p.team}</td>
                    <td style={{ padding: "5px 10px", fontVariantNumeric: "tabular-nums", color: INK2 }}>{p.age ?? "—"}</td>
                    {[dPpg, dMpg, dFga].map((d, i) => (
                      <td key={i} style={{ padding: "5px 10px", fontVariantNumeric: "tabular-nums", color: d > 0 ? "#0ca30c" : INK2 }}>
                        {d > 0 ? "▲" : "▽"} {Math.abs(d).toFixed(1)}
                      </td>
                    ))}
                    <td style={{ padding: "5px 10px", fontVariantNumeric: "tabular-nums" }}>{p.ppg.toFixed(1)}</td>
                  </tr>
                ))}
                {breakout.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 14, color: INK2, textAlign: "center" }}>No players match — need rows in both seasons (≥15 GP each).</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: INK2, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
            Year-over-year deltas of stored per-game averages, sorted by scoring growth. Rising minutes + rising volume is the classic pre-breakout shape.
          </div>
        </>
      )}

      {view === "teams" && teamScatter && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 8, justifyContent: "flex-end" }}>
            {(["East", "West"] as const).map((c) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: INK2 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: CONF_COLORS[c], display: "inline-block" }} />
                {c}
              </span>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: SURFACE, borderRadius: 8, display: "block" }} role="img" aria-label="Team payroll vs wins scatter">
            {teamScatter.yTicks.map((t) => (
              <g key={`ty${t}`}>
                <line x1={PAD.left} x2={W - PAD.right} y1={teamScatter.py(t)} y2={teamScatter.py(t)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={teamScatter.py(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="'DM Mono', monospace">{Math.round(t)}</text>
              </g>
            ))}
            {/* CBA thresholds as reference hairlines (values from capConstants via API) */}
            {([["Cap", payload.thresholds.cap], ["Tax", payload.thresholds.tax], ["Apron 2", payload.thresholds.secondApron]] as const).map(([label, v]) => (
              <g key={label}>
                <line x1={teamScatter.px(v)} x2={teamScatter.px(v)} y1={PAD.top} y2={H - PAD.bottom} stroke={GRID} strokeWidth={1} strokeDasharray="none" />
                <text x={teamScatter.px(v)} y={PAD.top - 2} textAnchor="middle" fontSize={9} fill={AXIS} fontFamily="'DM Mono', monospace">{label}</text>
              </g>
            ))}
            <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke={GRID} strokeWidth={1} />
            {niceTicks(teamScatter.xMin, teamScatter.xMax, 4).map((t) => (
              <text key={`tx${t}`} x={teamScatter.px(t)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={10} fill={AXIS} fontFamily="'DM Mono', monospace">{fmtPayroll(t)}</text>
            ))}
            <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={INK2}>Payroll ({payload.salary_season}, active contracts)</text>
            <text x={12} y={(PAD.top + H - PAD.bottom) / 2} textAnchor="middle" fontSize={11} fill={INK2} transform={`rotate(-90 12 ${(PAD.top + H - PAD.bottom) / 2})`}>Wins ({payload.current_season})</text>

            {teamScatter.teams.map((t, i) => {
              const cx = teamScatter.px(t.payroll!);
              const cy = teamScatter.py(t.wins);
              return (
                <g key={t.id}>
                  <circle cx={cx} cy={cy} r={5} fill={CONF_COLORS[t.conference] ?? "#8b8fa3"} stroke={SURFACE} strokeWidth={2} />
                  <circle
                    cx={cx} cy={cy} r={12} fill="transparent" tabIndex={0}
                    aria-label={`${t.name}: ${fmtPayroll(t.payroll!)} payroll, ${t.wins} wins`}
                    onMouseEnter={(e) => showTip(e, [
                      { label: "", value: t.name, strong: true },
                      { label: "Payroll", value: fmtPayroll(t.payroll!) },
                      { label: "Record", value: `${t.wins}–${t.losses}` },
                    ])}
                    onFocus={(e) => showTip(e, [{ label: "", value: t.name, strong: true }, { label: "Record", value: `${t.wins}–${t.losses}` }])}
                    onMouseLeave={() => setTooltip(null)}
                    onBlur={() => setTooltip(null)}
                  />
                  {teamScatter.labeled.has(i) && (
                    <text x={cx + 9} y={cy + 3} fontSize={10} fill={INK} fontFamily="'Outfit', sans-serif">{t.abbrev}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 10, color: INK2, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
            Upper-left is the CBA jackpot: wins without the tax bill. Payrolls understate teams whose 2026-27 rosters are still unsigned.
          </div>
        </>
      )}

      {/* Tooltip — values lead, labels follow; built from JSX (auto-escaped) */}
      {tooltip && (
        <div style={{
          position: "absolute", left: Math.max(tooltip.x + 10, 0), top: Math.max(tooltip.y - 10, 0),
          background: "#1a1e28", border: `1px solid ${GRID}`, borderRadius: 6, padding: "8px 10px",
          pointerEvents: "none", zIndex: 20, minWidth: 140, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          {tooltip.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: l.strong ? 12 : 11 }}>
              <span style={{ color: INK2 }}>{l.label}</span>
              <span style={{ color: INK, fontWeight: l.strong ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
