import React, { useState, useCallback, useEffect, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PuzzleCatalog from 'src/components/PuzzleCatalog'
import PuzzleSolver from 'src/components/PuzzleSolver'
import EndlessPuzzle from 'src/components/EndlessPuzzle'
import DailyChallenge from 'src/components/pente/DailyChallenge'
import PenteTopNav from 'src/components/pente/PenteTopNav'
import SolarField from 'src/components/pente/SolarField'
import Leaderboard from 'src/components/pente/Leaderboard'
import UpdatesCard from 'src/components/UpdatesCard'
import usePlayerProfile from 'src/hooks/usePlayerProfile'
import { getZone } from 'src/lib/pente/elo'
import { puzzles, getRecommendedPuzzle, getPuzzleById, DIFFICULTY_LABELS } from 'src/lib/pente/puzzles'
import { dueForReview, nextDue, penteAttempts } from 'src/lib/review'
import ReviewLane from 'src/components/ReviewLane'
import { trackGame } from 'src/lib/analytics'

const MODES = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'daily', label: 'Daily' },
  { key: 'endless', label: 'Endless' },
]

export default function PentePuzzlesPage() {
  const router = useRouter()
  const [mode, setMode] = useState('catalog') // catalog | endless | solving
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  // Bumped on every solve to arm the one-shot post-solve tip banner.
  const [solveSignal, setSolveSignal] = useState(0)
  const {
    playerId,
    markSolved,
    recordAttempt,
    isSolved,
    solvedCount,
    currentStreak,
    bestStreak,
    puzzleElo,
    puzzlePeakElo,
    eloHistory,
    profile,
  } = usePlayerProfile()

  // Deep-links: ?mode=endless|catalog|daily picks a mode (used by the /pente
  // redirect); ?puzzle=<id> opens one catalog puzzle (used by review links).
  useEffect(() => {
    if (!router.isReady) return
    const queryPuzzle = typeof router.query.puzzle === 'string' ? getPuzzleById(router.query.puzzle) : null
    if (queryPuzzle) {
      setSelectedPuzzle(queryPuzzle)
      setMode('solving')
      return
    }
    const queryMode = router.query.mode
    if (queryMode === 'endless' || queryMode === 'catalog' || queryMode === 'daily') {
      setMode(queryMode)
    }
  }, [router.isReady, router.query.mode, router.query.puzzle])

  // Missed catalog puzzles come back on a spaced schedule (src/lib/review.ts),
  // read from the rating history's solve/wrong events plus local re-solves.
  const [now, setNow] = useState(null)
  useEffect(() => { setNow(Date.now()) }, [mode])
  const review = useMemo(() => {
    if (!now) return { items: [], next: null }
    const isCatalog = (id) => Boolean(getPuzzleById(id))
    const history = [
      ...penteAttempts(eloHistory, isCatalog),
      ...penteAttempts(profile.reviewLog, isCatalog),
    ]
    const items = dueForReview(history, now).map(item => {
      const p = getPuzzleById(item.puzzleId)
      return {
        id: item.puzzleId,
        title: p.title,
        detail: `missed ${item.lapses}× · ${DIFFICULTY_LABELS[p.difficulty - 1] ?? ''}`.trim(),
        onOpen: () => { setSelectedPuzzle(p); setMode('solving') },
      }
    })
    return { items, next: nextDue(history) }
  }, [eloHistory, profile.reviewLog, now])

  // Smart next: pick the recommended puzzle for current ELO, or cycle
  const handleNext = useCallback(() => {
    if (!selectedPuzzle) return
    const solvedIds = profile.solvedPuzzles
    const recommended = getRecommendedPuzzle(puzzleElo, [...solvedIds, selectedPuzzle.id])
    if (recommended) {
      setSelectedPuzzle(recommended)
    } else {
      const currentIndex = puzzles.findIndex(p => p.id === selectedPuzzle.id)
      const nextIndex = (currentIndex + 1) % puzzles.length
      setSelectedPuzzle(puzzles[nextIndex])
    }
  }, [selectedPuzzle, puzzleElo, profile.solvedPuzzles])

  // Wrap markSolved so every solve also fires a first-party `puzzle_solved`
  // event — the puzzle trainer had zero instrumentation before this. Returns
  // markSolved's result untouched so the solver/endless components still get
  // their elo delta. `delta === 0` means a re-solve (no ELO awarded).
  const handleSolve = useCallback((puzzleId, puzzleRating, attempts = 0, usedHint = false, solveTimeMs = null) => {
    const result = markSolved(puzzleId, puzzleRating, attempts, usedHint, solveTimeMs)
    setSolveSignal(s => s + 1)
    trackGame('puzzle_solved', 'pente', {
      puzzle_id: puzzleId,
      rating: puzzleRating ?? null,
      attempts,
      used_hint: usedHint,
      solve_time_ms: solveTimeMs,
      mode: mode === 'endless' ? 'endless' : mode === 'daily' ? 'daily' : 'catalog',
      elo_delta: result?.delta ?? 0,
      new_elo: result?.newElo ?? null,
      zone: result?.zone?.name ?? null,
      repeat: (result?.delta ?? 0) === 0,
    })
    return result
  }, [markSolved, mode])

  const handleSelectPuzzle = useCallback((puzzle) => {
    setSelectedPuzzle(puzzle)
    setMode('solving')
  }, [])

  const handleBackFromSolver = useCallback(() => {
    setSelectedPuzzle(null)
    setMode('catalog')
  }, [])

  const handleBackFromEndless = useCallback(() => {
    setMode('catalog')
  }, [])

  const zone = getZone(puzzleElo)

  return (
    <div className="min-h-screen bg-ink-950 relative">
      <Head>
        <title>Pente Puzzles | Brooks Roley</title>
        <meta name="description" content="Practice Pente tactics with puzzles — captures, five-in-a-row, defense, and more. Track your rating as you climb." />
        <meta property="og:title" content="Pente Puzzles | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Practice Pente tactics with puzzles. Climb the mountain." key="og:description" />
      </Head>

      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <SolarField intensity={0.75} accentHex={zone?.color} />
      </div>

      <PenteTopNav active={mode === 'endless' ? 'endless' : 'catalog'} />

      <div className="relative z-10 max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pente Puzzles</h1>
            <p className="text-sm text-ink-400 mt-1">Climb the mountain — sharpen your tactics.</p>
          </div>
          {mode !== 'solving' && (
            <div className="flex rounded-lg border border-ink-700/40 overflow-hidden">
              {MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`text-xs px-3 py-1.5 transition-colors ${
                    mode === m.key
                      ? 'bg-brass-600/20 text-brass-400 border-brass-500/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'catalog' && now && <ReviewLane items={review.items} nextDueAt={review.next} now={now} />}

        {/* Content area */}
        <div className="rounded-xl bg-ink-900/60 border border-ink-700/40 p-4 sm:p-6">
          {mode === 'solving' && selectedPuzzle ? (
            <PuzzleSolver
              key={selectedPuzzle.id}
              puzzle={selectedPuzzle}
              onBack={handleBackFromSolver}
              onNext={handleNext}
              isSolved={isSolved(selectedPuzzle.id)}
              onSolve={handleSolve}
              onAttempt={recordAttempt}
              elo={puzzleElo}
              peakElo={puzzlePeakElo}
              eloHistory={eloHistory}
            />
          ) : mode === 'daily' ? (
            <DailyChallenge
              playerId={playerId}
              elo={puzzleElo}
              peakElo={puzzlePeakElo}
              eloHistory={eloHistory}
              onSolve={handleSolve}
              onAttempt={recordAttempt}
              onBack={() => setMode('catalog')}
            />
          ) : mode === 'endless' ? (
            <EndlessPuzzle
              playerId={playerId}
              elo={puzzleElo}
              peakElo={puzzlePeakElo}
              eloHistory={eloHistory}
              onSolve={handleSolve}
              onAttempt={recordAttempt}
              onBack={handleBackFromEndless}
            />
          ) : (
            <PuzzleCatalog
              onSelectPuzzle={handleSelectPuzzle}
              isSolved={isSolved}
              solvedCount={solvedCount}
              currentStreak={currentStreak}
              bestStreak={bestStreak}
              elo={puzzleElo}
              peakElo={puzzlePeakElo}
              eloHistory={eloHistory}
            />
          )}
        </div>

        {/* Leaderboard — catalog view only, so it doesn't distract mid-solve */}
        {mode === 'catalog' && (
          <div className="mt-4 sm:mt-6">
            <Leaderboard currentPlayerId={playerId} />
          </div>
        )}
      </div>

      <UpdatesCard trigger={solveSignal} page="/posts/pente-puzzles" />
    </div>
  )
}
