import React, { useCallback, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import PuzzleBoard from 'src/components/go/PuzzleBoard'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import { eloDelta, rankLabel } from 'src/lib/go/elo'
import { PUZZLES, PUZZLE_BY_ID, difficultyColor } from 'src/lib/go/puzzles'

export async function getStaticPaths() {
  return {
    paths: PUZZLES.map(p => ({ params: { id: p.id } })),
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  return { props: { puzzleId: params.id } }
}

export default function GoPuzzlePage({ puzzleId }) {
  const puzzle = PUZZLE_BY_ID[puzzleId]
  const { ready, goElo, solved, recordAttempt } = useGoPlayerProfile()
  const [lastResult, setLastResult] = useState(null)

  const ordered = useMemo(() => PUZZLES.map(p => p.id), [])
  const idx = ordered.indexOf(puzzleId)
  const nextId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null
  const prevId = idx > 0 ? ordered[idx - 1] : null

  const handleAttempt = useCallback(({ solved: didSolve, usedHint }) => {
    if (!puzzle) return
    const result = recordAttempt({
      puzzleId: puzzle.id,
      puzzleRating: puzzle.rating,
      solved: didSolve,
      usedHint,
    })
    if (result) setLastResult({ ...result, solved: didSolve, usedHint })
  }, [puzzle, recordAttempt])

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-forest-950 text-white flex items-center justify-center">
        <p className="text-sm text-forest-400">Puzzle not found.</p>
      </div>
    )
  }

  const isSolved = solved.has(puzzle.id)

  return (
    <div className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>{puzzle.title} | Go Puzzles</title>
      </Head>

      <nav className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go/puzzles"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 border-r border-forest-800/60"
          >
            &larr; All puzzles
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide truncate">{puzzle.title}</span>
          <span className={`ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${difficultyColor(puzzle.difficulty)}`}>
            {puzzle.difficulty}
          </span>
          {ready && (
            <span className="text-[10px] text-forest-400 font-mono">
              you {goElo} · {rankLabel(goElo)}
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-4">
        <div className="rounded-xl border border-forest-700/50 bg-forest-900/70 px-4 py-3">
          <p className="text-sm text-forest-200 leading-relaxed">{puzzle.prompt}</p>
          <div className="flex items-center justify-between mt-1.5 text-xs">
            <span className="text-forest-500 font-mono">puzzle rating {puzzle.rating}</span>
            {isSolved && !lastResult && (
              <span className="text-green-400">✓ Solved previously</span>
            )}
          </div>
        </div>

        <PuzzleBoard puzzle={puzzle} onAttempt={handleAttempt} />

        {lastResult && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            lastResult.solved
              ? lastResult.usedHint
                ? 'bg-amber-900/20 border-amber-500/40 text-amber-100'
                : 'bg-green-900/20 border-green-500/40 text-green-100'
              : 'bg-red-900/20 border-red-500/40 text-red-100'
          }`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                {lastResult.solved
                  ? (lastResult.usedHint ? 'Solved with hint' : 'Solved')
                  : 'Not solved'}
              </span>
              <span className="font-mono">
                {lastResult.eloBefore} → {lastResult.eloAfter}
                <span className="ml-2 text-forest-300">{eloDelta(lastResult.eloBefore, lastResult.eloAfter)}</span>
              </span>
            </div>
          </div>
        )}

        <footer className="flex items-center justify-between text-sm pt-3 border-t border-forest-800/60">
          {prevId ? (
            <Link href={`/posts/go/puzzles/${prevId}`} className="text-forest-400 hover:text-candy-300">
              &larr; Previous
            </Link>
          ) : <span />}
          {nextId ? (
            <Link
              href={`/posts/go/puzzles/${nextId}`}
              className="px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-candy-200 hover:bg-candy-500/30 transition"
            >
              Next puzzle &rarr;
            </Link>
          ) : (
            <Link
              href="/posts/go/puzzles"
              className="px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-candy-200 hover:bg-candy-500/30 transition"
            >
              Back to catalog
            </Link>
          )}
        </footer>
      </div>
    </div>
  )
}
