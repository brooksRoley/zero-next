import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { NBA_DISPLAY_FONT, NBA_RED_LIGHT } from "src/lib/nba/brand";

type AccuracyStats = {
  totalPredictions: number;
  covers: number;
  misses: number;
  pushes: number;
  modelMae: number;
  vegasMae: number;
  beatVegas: number;
};

type WeeklyBucket = {
  week: string;
  games: number;
  coverRate: number;
  modelMae: number;
  vegasMae: number;
  beatVegas: number;
};

type AccuracyResponse = {
  data: AccuracyStats;
  rollingCover: number[];
  weekly?: WeeklyBucket[];
  _meta?: { rollingWindow?: number };
};

const ACCENT = NBA_RED_LIGHT;

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function Sparkline({ values, window }: { values: number[]; window: number }) {
  if (values.length < 2) {
    return (
      <p className="text-sm text-slate-500">
        Not enough settled games yet to chart a trend.
      </p>
    );
  }

  const W = 640;
  const H = 120;
  const PAD = 6;
  const n = values.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / 100) * (H - PAD * 2);

  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;
  const last = values[n - 1];
  const breakEvenY = y(52.4); // ~break-even ATS hit rate against standard -110 juice

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Rolling ${window}-game cover rate, currently ${last}%`}
      >
        <line
          x1={PAD}
          x2={W - PAD}
          y1={breakEvenY}
          y2={breakEvenY}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <polygon points={area} fill={ACCENT} opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(n - 1)} cy={y(last)} r={3.5} fill={ACCENT} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Dashed line ≈ 52.4% break-even vs −110</span>
        <span>
          Latest: <span className="text-slate-300 font-medium">{last}%</span>
        </span>
      </div>
    </div>
  );
}

function WeeklyTrend({ weekly }: { weekly: WeeklyBucket[] }) {
  if (weekly.length < 2) {
    return (
      <p className="text-sm text-slate-500">
        Need at least two weeks of settled games to chart a weekly trend.
      </p>
    );
  }

  const W = 640;
  const H = 140;
  const PAD = 6;
  const LABEL_H = 16;
  const n = weekly.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - LABEL_H - (v / 100) * (H - PAD * 2 - LABEL_H);

  const values = weekly.map((w) => w.coverRate);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values[n - 1];
  const breakEvenY = y(52.4);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Weekly cover rate across ${n} weeks, most recent ${last}%`}
      >
        <line
          x1={PAD}
          x2={W - PAD}
          y1={breakEvenY}
          y2={breakEvenY}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <polyline
          points={line}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {weekly.map((w, i) => (
          <circle key={w.week} cx={x(i)} cy={y(w.coverRate)} r={3.5} fill={ACCENT}>
            <title>{`${w.week}: ${w.coverRate}% cover (${w.games} games, MAE ${w.modelMae})`}</title>
          </circle>
        ))}
        <text
          x={PAD}
          y={H - 2}
          fill="#64748b"
          fontSize={10}
          fontFamily="monospace"
        >
          {weekly[0].week}
        </text>
        <text
          x={W - PAD}
          y={H - 2}
          fill="#64748b"
          fontSize={10}
          fontFamily="monospace"
          textAnchor="end"
        >
          {weekly[n - 1].week}
        </text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Dashed line ≈ 52.4% break-even vs −110</span>
        <span>
          Latest week:{" "}
          <span className="text-slate-300 font-medium">{last}%</span> over{" "}
          {weekly[n - 1].games} games
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl border bg-slate-900/40 p-5"
      style={{ borderColor: highlight ? `${ACCENT}66` : "#1e293b" }}
    >
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div
        className="mt-2 text-3xl font-bold"
        style={{ color: highlight ? ACCENT : "#e2e8f0" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function NbaAccuracy() {
  const [resp, setResp] = useState<AccuracyResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Guard against a hanging request: abort after 7s and show an honest
    // fallback instead of spinning forever.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setTimedOut(true);
      controller.abort();
    }, 7000);

    fetch("/api/nba/predictions/accuracy?groupBy=week", {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "Failed to load accuracy data");
        }
        return r.json();
      })
      .then(setResp)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return; // timeout state already set
        setError(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const stats = resp?.data;
  const decided = stats ? stats.covers + stats.misses : 0;
  const coverRate = stats ? pct(stats.covers, decided) : 0;
  const beatVegasRate = stats ? pct(stats.beatVegas, stats.totalPredictions) : 0;
  const maeEdge = stats ? Math.round((stats.vegasMae - stats.modelMae) * 100) / 100 : 0;
  const window = resp?._meta?.rollingWindow ?? 10;

  return (
    <main className="min-h-screen bg-[#0a0e16] text-slate-100 font-sans">
      <Head>
        <title>NBA Prediction Accuracy | Brooks Roley</title>
        <meta
          name="description"
          content="How a spread-prediction model performs against the Vegas line — cover rate, MAE, and a rolling cover-rate trend."
        />
      </Head>

      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/nba" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            &larr; NBA Explorer
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Home
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${ACCENT}1f`, color: ACCENT }}
          >
            Model vs. Vegas
          </span>
          <h1
            className="mt-4 text-4xl sm:text-5xl text-white uppercase tracking-wide"
            style={{ fontFamily: NBA_DISPLAY_FONT }}
          >
            NBA Prediction <span style={{ color: NBA_RED_LIGHT }}>Accuracy</span>
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
            Every settled prediction is scored against the closing Vegas spread.
            This is the honest scoreboard — against-the-spread cover rate and
            mean absolute error, with no cherry-picking.
          </p>
        </div>

        {loading && (
          <p className="text-slate-500 text-sm py-16 text-center">Loading results…</p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && !stats && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-12 text-center text-slate-400">
            {timedOut
              ? "Results are taking longer than expected. Predictions settle nightly — check back after tonight's games."
              : "No settled predictions yet. Predictions settle nightly — check back after tonight's games."}
          </div>
        )}

        {!loading && !error && stats && stats.totalPredictions === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-12 text-center text-slate-400">
            No settled predictions yet. Predictions settle nightly — check back
            after tonight&apos;s games.
          </div>
        )}

        {!loading && !error && stats && stats.totalPredictions > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Cover Rate"
                value={`${coverRate}%`}
                sub={`${stats.covers}–${stats.misses}${stats.pushes ? ` · ${stats.pushes} push` : ""}`}
                highlight
              />
              <StatCard
                label="Beat Vegas"
                value={`${beatVegasRate}%`}
                sub={`${stats.beatVegas} of ${stats.totalPredictions} games`}
              />
              <StatCard
                label="Model MAE"
                value={`${stats.modelMae}`}
                sub={maeEdge >= 0 ? `${maeEdge} pts better` : `${Math.abs(maeEdge)} pts worse`}
              />
              <StatCard label="Vegas MAE" value={`${stats.vegasMae}`} sub="baseline" />
            </div>

            <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                  Rolling {window}-Game Cover Rate
                </h2>
                <span className="text-xs text-slate-500">{stats.totalPredictions} graded</span>
              </div>
              <Sparkline values={resp.rollingCover} window={window} />
            </section>

            {resp.weekly && resp.weekly.length > 0 && (
              <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                    Weekly Cover Rate
                  </h2>
                  <span className="text-xs text-slate-500">
                    {resp.weekly.length} {resp.weekly.length === 1 ? "week" : "weeks"}
                  </span>
                </div>
                <WeeklyTrend weekly={resp.weekly} />
              </section>
            )}

            <p className="mt-8 text-xs text-slate-600">
              MAE = mean absolute error between the predicted margin and the
              actual final margin (lower is better). Cover rate excludes pushes.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
