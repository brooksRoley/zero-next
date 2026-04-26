import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import { PUZZLES, DIFFICULTY_ORDER, difficultyColor } from 'src/lib/go/puzzles'

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'unsolved', label: 'Unsolved' },
  { key: 'solved',   label: 'Solved' },
]

export default function PuzzleCatalog() {
  const { solved } = useGoPlayerProfile()
  const [filter, setFilter] = useState('all')

  const visible = useMemo(() => {
    let list = [...PUZZLES]
    list.sort((a, b) => {
      const da = DIFFICULTY_ORDER.indexOf(a.difficulty)
      const db = DIFFICULTY_ORDER.indexOf(b.difficulty)
      if (da !== db) return da - db
      return (a.rating || 0) - (b.rating || 0)
    })
    if (filter === 'solved')   list = list.filter(p => solved.has(p.id))
    if (filter === 'unsolved') list = list.filter(p => !solved.has(p.id))
    return list
  }, [filter, solved])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-forest-400">Filter:</span>
        {FILTERS.map(f => {
          const count = f.key === 'all'
            ? PUZZLES.length
            : f.key === 'solved'
              ? solved.size
              : PUZZLES.length - solved.size
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md border transition ${
                filter === f.key
                  ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                  : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
              }`}
            >
              {f.label} <span className="text-forest-600">{count}</span>
            </button>
          )
        })}
        <span className="ml-auto text-forest-500">
          {solved.size} / {PUZZLES.length} solved
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-forest-800/60 bg-forest-900/40 p-6 text-center text-sm text-forest-400">
          {filter === 'solved'
            ? 'No solved puzzles yet — pick one to start.'
            : 'Nothing here.'}
        </div>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {visible.map(p => {
            const done = solved.has(p.id)
            return (
              <li key={p.id}>
                <Link
                  href={`/posts/go/puzzles/${p.id}`}
                  className="block rounded-xl border border-forest-700/60 bg-forest-900/70 hover:border-candy-400/50 hover:bg-forest-900 px-4 py-3 transition"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${difficultyColor(p.difficulty)}`}>
                      {p.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-forest-300 leading-relaxed">{p.prompt}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-forest-500">
                    <span className="font-mono">{p.size}×{p.size} · rating {p.rating}</span>
                    {done && (
                      <span className="text-green-400 font-medium">✓ Solved</span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
