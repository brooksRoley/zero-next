import React, { useEffect, useState } from 'react'

/**
 * Top-20 puzzle solvers, fetched from /api/pente/leaderboard.
 *
 * Social proof for the puzzle trainer: seeing a ranked board of climbers is the
 * hook that turns a one-off solver into a returning one. The viewer's own row
 * (matched by `currentPlayerId`) is highlighted so they can find themselves.
 */
export default function Leaderboard({ currentPlayerId }) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', rows: [], error: null })

    fetch('/api/pente/leaderboard')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ready', rows: data.leaderboard ?? [], error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', rows: [], error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { status, rows, error } = state

  return (
    <section
      aria-label="Pente puzzle leaderboard"
      className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-4 sm:p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <span className="text-xs text-forest-500">Top 20 by rating</span>
      </div>

      {status === 'loading' && (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="h-9 rounded-lg bg-forest-800/40 animate-pulse"
            />
          ))}
        </ul>
      )}

      {status === 'error' && (
        <p className="text-sm text-forest-400 py-6 text-center">
          Couldn&apos;t load the leaderboard right now.
          <span className="block text-xs text-forest-600 mt-1">{error}</span>
        </p>
      )}

      {status === 'ready' && rows.length === 0 && (
        <p className="text-sm text-forest-400 py-6 text-center">
          No ranked solvers yet — solve a puzzle to claim the top spot.
        </p>
      )}

      {status === 'ready' && rows.length > 0 && (
        <ol className="space-y-1">
          {rows.map((p) => {
            const isYou = currentPlayerId && p.id === currentPlayerId
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isYou
                    ? 'bg-candy-600/15 border border-candy-500/40'
                    : 'border border-transparent hover:bg-forest-800/40'
                }`}
              >
                <span
                  className={`w-6 shrink-0 text-right font-mono tabular-nums ${
                    p.rank <= 3 ? 'text-candy-400 font-bold' : 'text-forest-500'
                  }`}
                >
                  {p.rank}
                </span>
                <span
                  className="w-2.5 h-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.zone?.color || '#4a7c59' }}
                  title={p.zone?.name || ''}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-forest-100">
                  {p.name}
                  {isYou && <span className="ml-2 text-xs text-candy-300">you</span>}
                </span>
                <span className="hidden sm:block text-xs text-forest-500 shrink-0">
                  {p.puzzles_solved} solved
                </span>
                <span className="w-12 shrink-0 text-right font-mono tabular-nums text-white">
                  {p.elo}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
