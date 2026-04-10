import React, { useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import PuzzleCatalog from 'src/components/PuzzleCatalog'
import PuzzleSolver from 'src/components/PuzzleSolver'
import usePuzzleProgress from 'src/hooks/usePuzzleProgress'
import { puzzles, getRecommendedPuzzle } from 'src/lib/pente/puzzles'

export default function PentePuzzlesPage() {
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  const {
    markSolved,
    recordAttempt,
    isSolved,
    solvedCount,
    currentStreak,
    bestStreak,
    elo,
    peakElo,
    eloHistory,
    progress,
  } = usePuzzleProgress()

  // Smart next: pick the recommended puzzle for current ELO, or cycle
  const handleNext = useCallback(() => {
    if (!selectedPuzzle) return
    const solvedIds = progress.solved
    const recommended = getRecommendedPuzzle(elo, [...solvedIds, selectedPuzzle.id])
    if (recommended) {
      setSelectedPuzzle(recommended)
    } else {
      // All solved — cycle through
      const currentIndex = puzzles.findIndex(p => p.id === selectedPuzzle.id)
      const nextIndex = (currentIndex + 1) % puzzles.length
      setSelectedPuzzle(puzzles[nextIndex])
    }
  }, [selectedPuzzle, elo, progress.solved])

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
          <Link
            href="/posts/pente"
            className="text-xs text-forest-400 hover:text-candy-400 transition-colors px-3 py-1.5 rounded-md border border-forest-700/40 hover:border-candy-400/30"
          >
            Play Pente
          </Link>
        </div>

        {/* Content area */}
        <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-4 sm:p-6">
          {selectedPuzzle ? (
            <PuzzleSolver
              key={selectedPuzzle.id}
              puzzle={selectedPuzzle}
              onBack={() => setSelectedPuzzle(null)}
              onNext={handleNext}
              isSolved={isSolved(selectedPuzzle.id)}
              onSolve={markSolved}
              onAttempt={recordAttempt}
              elo={elo}
              peakElo={peakElo}
              eloHistory={eloHistory}
            />
          ) : (
            <PuzzleCatalog
              onSelectPuzzle={setSelectedPuzzle}
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
