import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

const STAGES = [
  { num: 0, slug: '0', title: 'The Void', subtitle: 'Board, stones, intersections', status: 'available' },
  { num: 1, slug: '1', title: 'Breath',   subtitle: 'Liberties, atari, capture',  status: 'available' },
  { num: 2, slug: '2', title: 'Survival', subtitle: 'Eyes, two-eye life, vital point', status: 'available' },
  { num: 3, slug: '3', title: 'Expansion',subtitle: 'Territory, corners vs center',status: 'available' },
  { num: 4, slug: '4', title: 'Combat',   subtitle: 'Ladders, snapbacks',         status: 'planned' },
  { num: 5, slug: '5', title: 'Flow',     subtitle: 'Ko, sente and gote',         status: 'planned' },
]

export default function GoLearnHub() {
  return (
    <div className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Learn Go | Brooks Roley</title>
        <meta name="description" content="Learn Go from scratch — interactive lessons covering liberties, captures, life and death, territory, ladders, and ko." />
      </Head>

      <nav className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 border-r border-forest-800/60"
          >
            &larr; Play
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide">Learn Go</span>
          <Link
            href="/posts/go/puzzles"
            className="ml-auto text-[11px] text-candy-400 hover:text-candy-300 transition-colors px-2 py-0.5 rounded border border-candy-400/30 hover:border-candy-400/60"
          >
            Puzzles
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Learn Go</h1>
          <p className="text-sm text-forest-400 mt-1.5">
            A six-stage path from clicking your first stone to reading the flow of a real game.
            Each stage is interactive — you’ll be playing within seconds.
          </p>
        </header>

        <ol className="space-y-2">
          {STAGES.map(stage => {
            const available = stage.status === 'available'
            const inner = (
              <div className={`flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl border transition ${
                available
                  ? 'bg-forest-900/70 border-forest-700/60 hover:border-candy-400/60 hover:bg-forest-900'
                  : 'bg-forest-900/40 border-forest-800/40 opacity-60'
              }`}>
                <span className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full font-mono text-sm ${
                  available ? 'bg-candy-500/20 text-candy-200' : 'bg-forest-800/60 text-forest-500'
                }`}>
                  {stage.num}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-white">{stage.title}</h2>
                    {!available && (
                      <span className="text-[10px] uppercase tracking-wider text-forest-500">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-forest-400 mt-0.5">{stage.subtitle}</p>
                </div>
                {available && (
                  <span className="text-candy-400 text-sm">→</span>
                )}
              </div>
            )
            return (
              <li key={stage.num}>
                {available ? (
                  <Link href={`/posts/go/learn/${stage.slug}`} className="block">{inner}</Link>
                ) : (
                  <div>{inner}</div>
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-8 pt-6 border-t border-forest-800/60 text-xs text-forest-500">
          Already know how to play?{' '}
          <Link href="/posts/go" className="text-candy-300 hover:text-candy-200">
            Skip the lessons and play a full game →
          </Link>
        </div>
      </div>
    </div>
  )
}
