import React, { useEffect, useRef, useState, useCallback } from 'react'
import PuzzleSolver from 'src/components/PuzzleSolver'
import useDailyChallenge from 'src/hooks/useDailyChallenge'
import { track } from 'src/lib/analytics'
import {
  getDailyPuzzle,
  getDailyStamp,
  recentStamps,
  DAILY_PRO_PRICE,
  DAILY_PRO_TIER,
} from 'src/lib/pente/dailyChallenge'

const PRO_FEATURES = [
  'Full puzzle history & one-tap replay',
  'Daily leaderboard with your global rank',
  'Streak insurance — one freeze per month',
  'Exportable solve stats & rating trend',
]

function StreakHeader({ daily }) {
  const stamps = recentStamps(14)
  const today = getDailyStamp()
  return (
    <div className="rounded-xl bg-forest-900/70 border border-forest-700/40 p-4 mb-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-candy-400 leading-none">
              {daily.streak}
              <span className="text-base">🔥</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forest-500 mt-1">
              Day streak
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white leading-none">{daily.bestStreak}</div>
            <div className="text-[10px] uppercase tracking-wider text-forest-500 mt-1">Best</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white leading-none">{daily.totalCompleted}</div>
            <div className="text-[10px] uppercase tracking-wider text-forest-500 mt-1">Solved</div>
          </div>
        </div>

        {/* Last 14 days — completed days light up. */}
        <div className="flex items-center gap-1" aria-hidden>
          {stamps.map((s) => {
            const done = Boolean(daily.history?.[s])
            const isToday = s === today
            return (
              <span
                key={s}
                title={s}
                className={`w-2.5 h-2.5 rounded-full ${
                  done ? 'bg-candy-500' : 'bg-forest-700/60'
                } ${isToday ? 'ring-2 ring-candy-400/50' : ''}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PremiumTeaser({ daily }) {
  const [submitted, setSubmitted] = useState(false)

  const handleInterest = () => {
    track('premium_interest', {
      page: '/posts/pente-puzzles',
      metadata: {
        tier: DAILY_PRO_TIER,
        price: DAILY_PRO_PRICE,
        streak: daily.streak,
        best_streak: daily.bestStreak,
        total_completed: daily.totalCompleted,
      },
    })
    setSubmitted(true)
  }

  return (
    <div className="relative mt-5 rounded-xl border border-candy-500/30 bg-gradient-to-b from-candy-900/20 to-forest-900/40 p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-candy-400" aria-hidden>🔒</span>
            <h3 className="text-base font-semibold text-white">Daily Challenge Pro</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-candy-500/20 text-candy-300 border border-candy-500/30">
              Coming soon
            </span>
          </div>
          <p className="text-sm text-forest-300 mt-1">
            Keep your streak honest and prove it on the global board.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-candy-300 leading-none">${DAILY_PRO_PRICE}</div>
          <div className="text-[10px] uppercase tracking-wider text-forest-500">per month</div>
        </div>
      </div>

      <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-forest-200">
            <span className="text-candy-400 mt-0.5 shrink-0" aria-hidden>✦</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {submitted ? (
          <p className="text-sm text-candy-300">
            Noted — you&apos;ll be first to know when Pro launches. Keep the streak alive.
          </p>
        ) : (
          <button
            onClick={handleInterest}
            className="text-sm px-5 py-2.5 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold hover:from-candy-400 hover:to-candy-500 transition-all shadow-lg shadow-candy-500/20"
          >
            Notify me when it launches
          </button>
        )}
      </div>
    </div>
  )
}

function DoneView({ daily, puzzle, onReplay }) {
  return (
    <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-6 text-center">
      <div className="text-3xl mb-2" aria-hidden>✓</div>
      <h2 className="text-lg font-semibold text-white">Today&apos;s challenge complete</h2>
      <p className="text-sm text-forest-300 mt-1">
        You&apos;re on a <span className="text-candy-400 font-semibold">{daily.streak}-day</span> streak.
        Come back tomorrow for a fresh puzzle.
      </p>
      <button
        onClick={onReplay}
        className="mt-4 text-xs px-4 py-2 rounded-md border border-forest-600 text-forest-300 hover:text-candy-400 hover:border-candy-500/40 transition-colors"
      >
        Replay today&apos;s puzzle ({puzzle?.title})
      </button>
    </div>
  )
}

export default function DailyChallenge({ playerId, elo, peakElo, eloHistory, onSolve, onAttempt, onBack }) {
  const { daily, loaded, completedToday, recordCompletion } = useDailyChallenge(playerId)
  const puzzle = getDailyPuzzle()

  // Decide play vs done view once, after localStorage has loaded, so we neither
  // flash the wrong state nor flip away from the solver the moment it's solved.
  const [playing, setPlaying] = useState(false)
  const initRef = useRef(false)
  useEffect(() => {
    if (loaded && !initRef.current) {
      initRef.current = true
      setPlaying(!completedToday)
      track('daily_challenge_view', {
        page: '/posts/pente-puzzles',
        metadata: { puzzle_id: puzzle?.id ?? null, completed_today: completedToday, streak: daily.streak },
      })
    }
  }, [loaded, completedToday, puzzle, daily.streak])

  // Daily solves still flow through the parent's markSolved (ELO + analytics),
  // and additionally fold into the daily streak. We pass isSolved={false} so the
  // ritual is replayable even if the puzzle was already solved in the catalog.
  const handleSolve = useCallback(
    (puzzleId, rating, attempts, usedHint, solveTimeMs) => {
      const result = onSolve?.(puzzleId, rating, attempts, usedHint, solveTimeMs)
      const next = recordCompletion({ puzzleId, attempts, usedHint, solveTimeMs })
      track('daily_challenge_completed', {
        page: '/posts/pente-puzzles',
        metadata: {
          puzzle_id: puzzleId,
          rating: rating ?? null,
          attempts,
          used_hint: usedHint,
          streak: next.streak,
          best_streak: next.bestStreak,
        },
      })
      return result
    },
    [onSolve, recordCompletion]
  )

  if (!puzzle) {
    return <p className="text-sm text-forest-400">No daily puzzle available right now.</p>
  }

  if (!loaded) {
    return <div className="h-40 rounded-xl bg-forest-900/40 border border-forest-700/30 animate-pulse" />
  }

  return (
    <div>
      <StreakHeader daily={daily} />

      {playing ? (
        <PuzzleSolver
          key={`daily-${getDailyStamp()}`}
          puzzle={puzzle}
          onBack={onBack}
          onNext={undefined}
          isSolved={false}
          onSolve={handleSolve}
          onAttempt={onAttempt}
          elo={elo}
          peakElo={peakElo}
          eloHistory={eloHistory}
        />
      ) : (
        <DoneView daily={daily} puzzle={puzzle} onReplay={() => setPlaying(true)} />
      )}

      {completedToday && <PremiumTeaser daily={daily} />}
    </div>
  )
}
