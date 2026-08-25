/**
 * Live results of the TFT engine's 2025-26 backtest, read from /api/nba/tft/*.
 *
 * Degrades to an explanatory message when the endpoint returns 503 (no active
 * coefficients) rather than spinning forever — the backtest is not always
 * activated against production.
 */
import { useState, useEffect } from 'react'
import TeamResidualsTable from 'src/components/tft/TeamResidualsTable'
import CoefficientsTable from 'src/components/tft/CoefficientsTable'
import ShotHeatmap from 'src/components/tft/ShotHeatmap'

// ── TFT Backtest Section ──────────────────────────────────────────────────────

export default function TftBacktestSection() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [heroPlayerId] = useState(2544) // LeBron ESPN id — fallback if not in backtest
  const [heroData, setHeroData] = useState(null)

  useEffect(() => {
    fetch('/api/nba/tft/summary').then(async (r) => {
      if (r.ok) setSummary(await r.json())
      else setError((await r.json()).error)
    }).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!heroPlayerId) return
    fetch(`/api/nba/tft/player/${heroPlayerId}`).then(async (r) => {
      if (r.ok) setHeroData(await r.json())
      else setHeroData(null)
    }).catch(() => setHeroData(null))
  }, [heroPlayerId])

  if (error) return <div className="text-sm opacity-70">Backtest not yet activated: {error}</div>
  if (!summary) return <div className="text-sm opacity-70">Loading backtest...</div>

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Scorecard label="Wins MAE" value={summary.metrics?.best_loss?.toFixed(3) ?? 'n/a'} />
        <Scorecard label="Fit season" value={summary.fit_season} />
        <Scorecard label="Version" value={summary.version} />
      </div>
      <div>
        <h3 className="text-xl mb-3">Team residuals</h3>
        <TeamResidualsTable rows={summary.teams ?? []} />
      </div>
      {heroData && (
        <div>
          <h3 className="text-xl mb-3">Player shot origins (sim vs prior)</h3>
          <ShotHeatmap simBins={heroData.sim_shot_bins ?? {}} priorBins={heroData.actual_shot_bins ?? {}} />
        </div>
      )}
      <div>
        <h3 className="text-xl mb-3">Active coefficients</h3>
        <CoefficientsTable coeffs={summary.coefficients ?? {}} />
      </div>
      <details className="text-sm opacity-80">
        <summary className="cursor-pointer opacity-100">Methodology</summary>
        <p className="mt-3 leading-relaxed">
          The engine uses a stat-mapper (real season stats → 0-100 ratings) feeding a
          Monte Carlo game simulator. Coefficients are fit with CMA-ES against a
          weighted multi-objective loss: L = 0.4·L_wl + 0.4·L_box + 0.2·L_spa,
          where L_wl is MAE of season wins ÷ 82, L_box is per-player normalized
          RMSE across (PTS, REB, AST), and L_spa is Jensen-Shannon divergence
          between simulated and prior 8-zone shot-origin distributions.
          Shot priors are generated from position, height, and 3-point rate;
          real shot-chart ingest is deferred pending a new data source (stats.nba.com
          stopped serving in 2026). Scheme extraction is a heuristic pattern-match
          on opponent shot mix.
        </p>
      </details>
    </div>
  )
}

function Scorecard({ label, value }) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-2xl font-mono mt-1">{value}</div>
    </div>
  )
}
