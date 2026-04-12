import React, { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import PuzzleCatalog from 'src/components/PuzzleCatalog'
import PuzzleSolver from 'src/components/PuzzleSolver'
import EndlessPuzzle from 'src/components/EndlessPuzzle'
import usePlayerProfile from 'src/hooks/usePlayerProfile'
import { puzzles, getRecommendedPuzzle } from 'src/lib/pente/puzzles'

const MODES = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'endless', label: 'Endless' },
]

export default function PentePuzzlesPage() {
  const router = useRouter()
  const [mode, setMode] = useState('catalog') // catalog | endless | solving
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  const {
    playerId,
    markSolved,
    recordAttempt,
    isSolved,
    solvedCount,
    currentStreak,
    bestStreak,
    elo,
    peakElo,
    eloHistory,
    profile,
  } = usePlayerProfile()

  // Deep-link: /posts/pente-puzzles?mode=endless jumps straight into endless mode.
  // Used by the /pente top-level redirect.
  useEffect(() => {
    if (!router.isReady) return
    const queryMode = router.query.mode
    if (queryMode === 'endless' || queryMode === 'catalog') {
      setMode(queryMode)
    }
  }, [router.isReady, router.query.mode])

  // Smart next: pick the recommended puzzle for current ELO, or cycle
  const handleNext = useCallback(() => {
    if (!selectedPuzzle) return
    const solvedIds = profile.solvedPuzzles
    const recommended = getRecommendedPuzzle(elo, [...solvedIds, selectedPuzzle.id])
    if (recommended) {
      setSelectedPuzzle(recommended)
    } else {
      const currentIndex = puzzles.findIndex(p => p.id === selectedPuzzle.id)
      const nextIndex = (currentIndex + 1) % puzzles.length
      setSelectedPuzzle(puzzles[nextIndex])
    }
  }, [selectedPuzzle, elo, profile.solvedPuzzles])

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

  return (
    <div className="min-h-screen bg-forest-950">
      <Head>
        <title>Pente Puzzles | Brooks Roley</title>
        <meta name="description" content="Practice Pente tactics with puzzles — captures, five-in-a-row, defense, and more. Track your rating as you climb." />
        <meta property="og:title" content="Pente Puzzles | Brooks Roley" />
        <meta property="og:description" content="Practice Pente tactics with puzzles. Climb the mountain." />
      </Head>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pente Puzzles</h1>
            <p className="text-sm text-forest-400 mt-1">Climb the mountain — sharpen your tactics.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode toggle (only show when not actively solving) */}
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
            <Link
              href="/posts/pente"
              className="text-xs text-forest-400 hover:text-candy-400 transition-colors px-3 py-1.5 rounded-md border border-forest-700/40 hover:border-candy-400/30"
            >
              Play Pente
            </Link>
          </div>
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
              onSolve={markSolved}
              onAttempt={recordAttempt}
              elo={elo}
              peakElo={peakElo}
              eloHistory={eloHistory}
            />
          ) : mode === 'endless' ? (
            <EndlessPuzzle
              playerId={playerId}
              elo={elo}
              peakElo={peakElo}
              eloHistory={eloHistory}
              onSolve={markSolved}
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
              elo={elo}
              peakElo={peakElo}
              eloHistory={eloHistory}
            />
          )}
        </div>
      </div>
    </div>
  )
}
