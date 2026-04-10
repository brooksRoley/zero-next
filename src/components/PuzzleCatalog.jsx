import React, { useState, useMemo } from 'react'
import { puzzles, PUZZLE_CATEGORIES, DIFFICULTY_LABELS, getRecommendedPuzzle } from 'src/lib/pente/puzzles'
import MountainProgress from 'src/components/MountainProgress'

export default function PuzzleCatalog({
  onSelectPuzzle,
  isSolved,
  solvedCount,
  currentStreak,
  bestStreak,
  elo,
  peakElo,
  eloHistory,
}) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState(0) // 0 = all

  const filtered = useMemo(() => {
    return puzzles.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (difficultyFilter > 0 && p.difficulty !== difficultyFilter) return false
      return true
    })
  }, [categoryFilter, difficultyFilter])

  // Get recommended puzzle for current ELO
  const solvedIds = useMemo(() => puzzles.filter(p => isSolved(p.id)).map(p => p.id), [isSolved])
  const recommended = useMemo(() => getRecommendedPuzzle(elo, solvedIds), [elo, solvedIds])

  return (
    <div>
      {/* Mountain visualizer */}
      <div className="mb-6">
        <MountainProgress elo={elo} peakElo={peakElo} eloHistory={eloHistory} />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-forest-500 uppercase tracking-wider">Solved</span>
          <span className="text-sm font-semibold text-white">{solvedCount}/{puzzles.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-forest-500 uppercase tracking-wider">Streak</span>
          <span className="text-sm font-semibold text-candy-400">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
        </div>
        {bestStreak > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-forest-500 uppercase tracking-wider">Best</span>
            <span className="text-sm font-semibold text-forest-300">{bestStreak}</span>
          </div>
        )}
        {/* Progress bar */}
        <div className="flex-1 min-w-[100px]">
          <div className="h-1.5 rounded-full bg-forest-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-candy-500 to-candy-400 transition-all duration-500"
              style={{ width: `${(solvedCount / puzzles.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recommended puzzle */}
      {recommended && (
        <div className="mb-5">
          <span className="text-xs text-forest-500 uppercase tracking-wider mb-2 block">Recommended for you</span>
          <button
            onClick={() => onSelectPuzzle(recommended)}
            className="w-full text-left p-4 rounded-xl border-2 border-candy-500/40 bg-candy-900/10 hover:bg-candy-900/20 transition-all hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{recommended.title}</h3>
                <p className="text-xs text-forest-400 mt-0.5">{recommended.description}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="text-xs text-forest-500">Rating {recommended.rating}</div>
                <div className="text-[10px] text-forest-600 mt-0.5">
                  {recommended.category.replace(/_/g, ' ')} &middot; {'★'.repeat(recommended.difficulty)}{'☆'.repeat(4 - recommended.difficulty)}
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md bg-forest-950 border border-forest-700/40 text-forest-200 focus:outline-none focus:border-candy-400/50"
        >
          <option value="all">All Categories</option>
          {PUZZLE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </option>
          ))}
        </select>

        {/* Difficulty */}
        <div className="flex gap-1">
          <button
            onClick={() => setDifficultyFilter(0)}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              difficultyFilter === 0
                ? 'bg-forest-700/60 text-white border-forest-600'
                : 'text-forest-400 border-forest-700/40 hover:text-forest-200'
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4].map(d => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d === difficultyFilter ? 0 : d)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                difficultyFilter === d
                  ? 'bg-forest-700/60 text-white border-forest-600'
                  : 'text-forest-400 border-forest-700/40 hover:text-forest-200'
              }`}
              title={DIFFICULTY_LABELS[d - 1]}
            >
              {'★'.repeat(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Puzzle grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-forest-500 text-sm py-8">
          No puzzles match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(puzzle => {
            const solved = isSolved(puzzle.id)
            const isRecommended = recommended?.id === puzzle.id
            const aboveLevel = puzzle.rating > elo + 200
            return (
              <button
                key={puzzle.id}
                onClick={() => onSelectPuzzle(puzzle)}
                className={`text-left p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                  isRecommended
                    ? 'border-candy-500/40 bg-candy-900/10'
                    : solved
                      ? 'bg-forest-900/40 border-forest-600/40'
                      : aboveLevel
                        ? 'bg-forest-900/80 border-forest-700/20 opacity-70'
                        : 'bg-forest-900/80 border-forest-700/40 hover:border-candy-400/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white leading-tight">{puzzle.title}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {solved && (
                      <span className="text-green-400 text-xs">Solved</span>
                    )}
                    <span className="text-[10px] text-forest-500 font-mono">{puzzle.rating}</span>
                  </div>
                </div>
                <p className="text-xs text-forest-400 mt-1 line-clamp-2">{puzzle.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    puzzle.category === 'capture' ? 'text-red-400 border-red-700/40' :
                    puzzle.category === 'five_in_a_row' ? 'text-green-400 border-green-700/40' :
                    puzzle.category === 'defense' ? 'text-blue-400 border-blue-700/40' :
                    puzzle.category === 'opening' ? 'text-yellow-400 border-yellow-700/40' :
                    puzzle.category === 'teamplay' ? 'text-pink-400 border-pink-700/40' :
                    'text-purple-400 border-purple-700/40'
                  }`}>
                    {puzzle.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-forest-500">
                    {'★'.repeat(puzzle.difficulty)}{'☆'.repeat(4 - puzzle.difficulty)}
                  </span>
                  {aboveLevel && !solved && (
                    <span className="text-[10px] text-forest-600 ml-auto">above level</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
