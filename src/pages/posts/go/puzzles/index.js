import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import PuzzleCatalog from 'src/components/go/PuzzleCatalog'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import { rankLabel } from 'src/lib/go/elo'

export default function GoPuzzlesIndex() {
  const { ready, goElo, peakElo, attempts } = useGoPlayerProfile()
  const totalAttempts = attempts.length
  const solvedCount = attempts.filter(a => a.solved).length

  return (
    <div className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Go Puzzles | Brooks Roley</title>
        <meta name="description" content="Curated tsumego — Go life-and-death and capture problems. Click a puzzle to solve it interactively." />
      </Head>

      <nav className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 border-r border-forest-800/60"
          >
            &larr; Play
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide">Go Puzzles</span>
          <Link
            href="/posts/go/learn"
            className="ml-auto text-[11px] text-forest-500 hover:text-candy-300 transition-colors"
          >
            Learn the rules
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tsumego</h1>
          <p className="text-sm text-forest-400 mt-1.5 leading-relaxed">
            Tsumego are Go life-and-death problems — set positions where one
            specific move solves the puzzle. They&rsquo;re the fastest way to
            sharpen your reading. Start with the beginners; the rating climbs
            as you go.
          </p>
        </header>

        {ready && (
          <div className="mb-5 rounded-xl border border-candy-400/30 bg-forest-900/70 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-forest-500">Your tsumego rating</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-candy-200 font-mono">{goElo}</span>
                <span className="text-sm text-forest-300">{rankLabel(goElo)}</span>
                {peakElo > goElo && (
                  <span className="text-[10px] text-forest-500 ml-1">peak {peakElo}</span>
                )}
              </div>
            </div>
            <div className="text-xs text-forest-400 text-right">
              <div>{totalAttempts} attempt{totalAttempts === 1 ? '' : 's'}</div>
              <div className="text-forest-500">{solvedCount} solved</div>
            </div>
          </div>
        )}

        <PuzzleCatalog />
      </div>
    </div>
  )
}
