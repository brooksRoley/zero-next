import React from "react";

export type Prediction = {
  event_id: string;
  game_id?: string | null;
  home_team: string;
  away_team: string;
  sim_median_spread: number | string | null;
  sim_mean_spread?: number | string | null;
  sim_home_win_pct?: number | string | null;
  vegas_spread: number | string | null;
  edge: number | string | null;
  edge_direction?: "home" | "away" | "none" | null;
  confidence?: "high" | "medium" | "low" | null;
  book_spread?: number | string | null;
  bookmaker?: string | null;
  created_at?: string;
};

const CONFIDENCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", text: "#4ade80" },
  medium: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fb923c" },
  low: { bg: "rgba(139,143,163,0.12)", border: "rgba(139,143,163,0.25)", text: "#8b8fa3" },
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const signed = (n: number, digits = 1): string => (n > 0 ? "+" : "") + n.toFixed(digits);

const formatSpread = (n: number | null): string => (n === null ? "—" : signed(n));

export default function PredictionCard({ p }: { p: Prediction }) {
  const modelSpread = num(p.sim_median_spread);
  const vegasSpread = num(p.vegas_spread) ?? num(p.book_spread);
  const edgePoints = num(p.edge);
  const winPct = num(p.sim_home_win_pct);
  const confidence = (p.confidence ?? "low") as keyof typeof CONFIDENCE_COLORS;
  const conf = CONFIDENCE_COLORS[confidence] ?? CONFIDENCE_COLORS.low;
  const direction = p.edge_direction ?? "none";
  const leanTeam = direction === "home" ? p.home_team : direction === "away" ? p.away_team : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 240,
        flex: "1 1 240px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.2px" }}>
          {p.away_team} <span style={{ color: "var(--text2)", fontWeight: 400 }}>@</span> {p.home_team}
        </div>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 999,
            background: conf.bg,
            border: `1px solid ${conf.border}`,
            color: conf.text,
          }}
        >
          {confidence}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Model
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#06b6d4", fontWeight: 600 }}>
            {formatSpread(modelSpread)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Vegas {p.bookmaker ? `· ${p.bookmaker}` : ""}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "var(--text)", fontWeight: 600 }}>
            {formatSpread(vegasSpread)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          background: "var(--surface2)",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Edge
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "var(--accent)", fontWeight: 700 }}>
            {edgePoints === null ? "—" : `${signed(Math.abs(edgePoints))} pts`}
          </span>
          {leanTeam && (
            <span style={{ fontSize: 11, color: "var(--text2)" }}>
              → <span style={{ color: "var(--text)", fontWeight: 600 }}>{leanTeam}</span>
            </span>
          )}
        </div>
      </div>

      {winPct !== null && (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)" }}>
          Home win prob: <span style={{ color: "var(--text)" }}>{(winPct * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
