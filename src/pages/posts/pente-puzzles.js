import React, { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PuzzleCatalog from 'src/components/PuzzleCatalog'
import PuzzleSolver from 'src/components/PuzzleSolver'
import EndlessPuzzle from 'src/components/EndlessPuzzle'
import DailyChallenge from 'src/components/pente/DailyChallenge'
import PenteTopNav from 'src/components/pente/PenteTopNav'
import SolarField from 'src/components/pente/SolarField'
import Leaderboard from 'src/components/pente/Leaderboard'
import PostSolveTip from 'src/components/pente/PostSolveTip'
import SupportCta from 'src/components/SupportCta'
import usePlayerProfile from 'src/hooks/usePlayerProfile'
import { getZone } from 'src/lib/pente/elo'
import { puzzles, getRecommendedPuzzle } from 'src/lib/pente/puzzles'
import { track } from 'src/lib/analytics'

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

  // Deep-link: /posts/pente-puzzles?mode=endless jumps straight into endless mode.
  // Used by the /pente top-level redirect.
  useEffect(() => {
    if (!router.isReady) return
    const queryMode = router.query.mode
    if (queryMode === 'endless' || queryMode === 'catalog' || queryMode === 'daily') {
      setMode(queryMode)
    }
  }, [router.isReady, router.query.mode])

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
    track('puzzle_solved', {
      page: '/posts/pente-puzzles',
      metadata: {
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
      },
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
    <div className="min-h-screen bg-forest-950 relative">
      <Head>
        <title>Pente Puzzles | Brooks Roley</title>
        <meta name="description" content="Practice Pente tactics with puzzles — captures, five-in-a-row, defense, and more. Track your rating as you climb." />
        <meta property="og:title" content="Pente Puzzles | Brooks Roley" />
        <meta property="og:description" content="Practice Pente tactics with puzzles. Climb the mountain." />
      </Head>

      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <SolarField intensity={0.75} accentHex={zone?.color} />
      </div>

      <PenteTopNav active={mode === 'endless' ? 'endless' : 'catalog'} />

      <div className="relative z-10 max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pente Puzzles</h1>
            <p className="text-sm text-forest-400 mt-1">Climb the mountain — sharpen your tactics.</p>
          </div>
          {mode !== 'solving' && (
            <div className="flex rounded-lg border border-forest-700/40 overflow-hidden">
              {MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`text-xs px-3 py-1.5 transition-colors ${
                    mode === m.key
                      ? 'bg-candy-600/20 text-candy-400 border-candy-500/30'
                      : 'text-forest-400 hover:text-forest-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-4 sm:p-6">
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

        <footer className="mt-6 text-center">
          <SupportCta
            page="/posts/pente-puzzles"
            location="pente_puzzles_tip"
            label="Enjoying the puzzles? Support development →"
          />
        </footer>
      </div>

      <PostSolveTip trigger={solveSignal} page="/posts/pente-puzzles" />
    </div>
  )
}
