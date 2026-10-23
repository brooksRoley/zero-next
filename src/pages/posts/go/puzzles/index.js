import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import PuzzleCatalog from 'src/components/go/PuzzleCatalog'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import { rankLabel } from 'src/lib/go/elo'
import { PUZZLE_BY_ID } from 'src/lib/go/puzzles'
import { dueForReview, goAttempts, nextDue } from 'src/lib/review'
import ReviewLane from 'src/components/ReviewLane'

export default function GoPuzzlesIndex() {
  const { ready, goElo, peakElo, attempts } = useGoPlayerProfile()
  const totalAttempts = attempts.length
  const solvedCount = attempts.filter(a => a.solved).length

  // "Now" is read after mount so the server render never guesses the client's clock.
  const [now, setNow] = useState(null)
  useEffect(() => { setNow(Date.now()) }, [])
  const review = useMemo(() => {
    if (!now) return { items: [], next: null }
    const history = goAttempts(attempts).filter(a => PUZZLE_BY_ID[a.puzzleId])
    const items = dueForReview(history, now).map(item => {
      const p = PUZZLE_BY_ID[item.puzzleId]
      return {
        id: item.puzzleId,
        title: p.title,
        detail: `missed ${item.lapses}× · rating ${p.rating}`,
        href: `/posts/go/puzzles/${item.puzzleId}`,
      }
    })
    return { items, next: nextDue(history) }
  }, [attempts, now])

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Head>
        <title>Go Puzzles | Brooks Roley</title>
        <meta name="description" content="Curated tsumego — Go life-and-death and capture problems. Click a puzzle to solve it interactively." />
      </Head>

      <nav className="sticky top-0 z-30 backdrop-blur bg-ink-950/70 border-b border-ink-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go"
            className="text-[11px] text-ink-500 hover:text-brass-400 transition-colors pr-3 border-r border-ink-800/60"
          >
            &larr; Play
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide">Go Puzzles</span>
          <Link
            href="/posts/go/learn"
            className="ml-auto text-[11px] text-ink-500 hover:text-brass-300 transition-colors"
          >
            Learn the rules
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tsumego</h1>
          <p className="text-sm text-ink-400 mt-1.5 leading-relaxed">
            Tsumego are Go life-and-death problems — set positions where one
            specific move solves the puzzle. They&rsquo;re the fastest way to
            sharpen your reading. Start with the beginners; the rating climbs
            as you go.
          </p>
        </header>

        {ready && (
          <div className="mb-5 rounded-xl border border-brass-400/30 bg-ink-900/70 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500">Your tsumego rating</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-brass-200 font-mono">{goElo}</span>
                <span className="text-sm text-ink-300">{rankLabel(goElo)}</span>
                {peakElo > goElo && (
                  <span className="text-[10px] text-ink-500 ml-1">peak {peakElo}</span>
                )}
              </div>
            </div>
            <div className="text-xs text-ink-400 text-right">
              <div>{totalAttempts} attempt{totalAttempts === 1 ? '' : 's'}</div>
              <div className="text-ink-500">{solvedCount} solved</div>
            </div>
          </div>
        )}

        {ready && now && <ReviewLane items={review.items} nextDueAt={review.next} now={now} />}

        <PuzzleCatalog />
      </div>
    </div>
  )
}
