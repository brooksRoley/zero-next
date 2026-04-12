import React, { useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import MountainProgress from 'src/components/MountainProgress'
import PenteTopNav from 'src/components/pente/PenteTopNav'
import SolarField from 'src/components/pente/SolarField'
import usePlayerProfile from 'src/hooks/usePlayerProfile'
import { getZone, ALTITUDE_ZONES } from 'src/lib/pente/elo'

const GAME_MODES = [
  {
    key: 'classic',
    title: 'Classic 1v1',
    desc: 'Two players, one board. Capture 5 pairs or get five in a row.',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle cx="12" cy="16" r="6" fill="#1a1a1a" stroke="#555" strokeWidth="1" />
        <circle cx="20" cy="16" r="6" fill="#f5f5f5" stroke="#ccc" strokeWidth="1" />
      </svg>
    ),
    href: '/posts/pente?mode=local',
  },
  {
    key: 'bot',
    title: 'vs Bot',
    desc: 'Challenge the AI — difficulty scales to your rating.',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <rect x="8" y="8" width="16" height="16" rx="3" fill="#2d6a4f" stroke="#4a7c59" strokeWidth="1" />
        <circle cx="13" cy="15" r="2" fill="#ff69b4" />
        <circle cx="19" cy="15" r="2" fill="#ff69b4" />
        <rect x="12" y="20" width="8" height="2" rx="1" fill="#ff69b4" />
      </svg>
    ),
    href: '/posts/pente?mode=bot1v1',
  },
  {
    key: 'ffa',
    title: 'Free-for-All',
    desc: '4 players, no teams. Capture any opponent\'s pair.',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle cx="10" cy="10" r="4" fill="#1a1a1a" stroke="#555" strokeWidth="0.5" />
        <circle cx="22" cy="10" r="4" fill="#f5f5f5" stroke="#ccc" strokeWidth="0.5" />
        <circle cx="10" cy="22" r="4" fill="#dc2626" />
        <circle cx="22" cy="22" r="4" fill="#2563eb" />
      </svg>
    ),
    href: '/posts/pente?mode=bot4ffa',
  },
  {
    key: 'team',
    title: '2v2 Teams',
    desc: 'Teammate brackets count for captures. Shared capture total.',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle cx="10" cy="12" r="4" fill="#1a1a1a" stroke="#555" strokeWidth="0.5" />
        <circle cx="22" cy="12" r="4" fill="#f5f5f5" stroke="#ccc" strokeWidth="0.5" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="#4a7c59" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="10" cy="22" r="4" fill="#dc2626" />
        <circle cx="22" cy="22" r="4" fill="#2563eb" />
        <line x1="10" y1="26" x2="22" y2="26" stroke="#dc2626" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      </svg>
    ),
    href: '/posts/pente?mode=bot2v2',
  },
  {
    key: 'online',
    title: 'Play Online',
    desc: 'Find an opponent and play in real-time.',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle cx="16" cy="16" r="10" fill="none" stroke="#4a7c59" strokeWidth="1.5" />
        <ellipse cx="16" cy="16" rx="5" ry="10" fill="none" stroke="#4a7c59" strokeWidth="1" />
        <line x1="6" y1="16" x2="26" y2="16" stroke="#4a7c59" strokeWidth="1" />
        <circle cx="16" cy="16" r="2" fill="#ff69b4" />
      </svg>
    ),
    href: '/posts/pente?mode=online',
  },
]

const PUZZLE_MODES = [
  {
    key: 'catalog',
    title: 'Puzzle Catalog',
    desc: 'Hand-crafted puzzles across difficulty levels.',
    href: '/posts/pente-puzzles',
  },
  {
    key: 'endless',
    title: 'Endless Mode',
    desc: 'AI-generated puzzles matched to your rating. Never runs out.',
    href: '/posts/pente-puzzles?mode=endless',
  },
]

export default function PenteHub() {
  const router = useRouter()
  const {
    playerId,
    playerName,
    setPlayerName,
    elo,
    peakElo,
    eloHistory,
    zone,
    puzzlesSolved,
    gamesPlayed,
    gamesWon,
    currentStreak,
    bestStreak,
    solvedCount,
    synced,
  } = usePlayerProfile()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const startEditName = useCallback(() => {
    setNameInput(playerName || '')
    setEditingName(true)
  }, [playerName])

  const saveName = useCallback(() => {
    const trimmed = nameInput.trim()
    if (trimmed) setPlayerName(trimmed)
    setEditingName(false)
  }, [nameInput, setPlayerName])

  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0

  return (
    <div className="min-h-screen bg-forest-950 relative">
      <Head>
        <title>Pente Arena | Brooks Roley</title>
        <meta name="description" content="Play Pente — classic, free-for-all, 2v2, or online. Solve puzzles, climb the mountain, track your rating." />
        <meta property="og:title" content="Pente Arena | Brooks Roley" />
        <meta property="og:description" content="Play Pente — classic, free-for-all, 2v2, or online. Solve puzzles, track your rating." />
      </Head>

      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <SolarField intensity={0.9} accentHex={zone?.color} />
      </div>

      <PenteTopNav active="hub" />

      <div className="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Pente</h1>
          <p className="text-sm text-forest-400 mt-1">Play, practice, climb.</p>
        </div>

        {/* Player Profile Card */}
        <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Left: identity + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-candy-500 to-candy-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(playerName || 'P')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  {editingName ? (
                    <form onSubmit={(e) => { e.preventDefault(); saveName() }} className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        maxLength={24}
                        className="bg-forest-800 border border-forest-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-candy-500 w-40"
                        placeholder="Your name"
                      />
                      <button type="submit" className="text-xs text-candy-400 hover:text-candy-300">Save</button>
                      <button type="button" onClick={() => setEditingName(false)} className="text-xs text-forest-500 hover:text-forest-300">Cancel</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white truncate">{playerName || 'Anonymous Player'}</span>
                      <button onClick={startEditName} className="text-xs text-forest-500 hover:text-candy-400 transition-colors">edit</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-forest-500">{zone.name}</span>
                    {synced && (
                      <span className="text-[10px] text-green-600" title="Synced to cloud">synced</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Rating" value={elo} accent />
                <StatCard label="Peak" value={peakElo} />
                <StatCard label="Puzzles" value={puzzlesSolved} />
                <StatCard label="Games" value={`${gamesWon}/${gamesPlayed}`} sub={gamesPlayed > 0 ? `${winRate}% win` : null} />
              </div>

              {/* Streak row */}
              <div className="flex items-center gap-4 mt-3 text-xs text-forest-400">
                <span>Streak: <span className="text-forest-200 font-medium">{currentStreak}</span></span>
                <span>Best: <span className="text-forest-200 font-medium">{bestStreak}</span></span>
              </div>
            </div>

            {/* Right: mountain visualizer */}
            <div className="sm:w-72 shrink-0">
              <MountainProgress elo={elo} peakElo={peakElo} eloHistory={eloHistory} />
            </div>
          </div>
        </div>

        {/* Game Modes */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Play</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GAME_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => router.push(mode.href)}
                className="group text-left rounded-xl bg-forest-900/60 border border-forest-700/40 hover:border-candy-500/40 p-4 transition-all hover:bg-forest-900/80"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    {mode.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-forest-100 group-hover:text-candy-400 transition-colors">
                      {mode.title}
                    </div>
                    <div className="text-xs text-forest-500 mt-0.5 leading-relaxed">
                      {mode.desc}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Puzzles */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Puzzles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PUZZLE_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => router.push(mode.href)}
                className="group text-left rounded-xl bg-forest-900/60 border border-forest-700/40 hover:border-candy-500/40 p-4 transition-all hover:bg-forest-900/80"
              >
                <div className="text-sm font-semibold text-forest-100 group-hover:text-candy-400 transition-colors">
                  {mode.title}
                </div>
                <div className="text-xs text-forest-500 mt-1 leading-relaxed">
                  {mode.desc}
                </div>
                {mode.key === 'catalog' && puzzlesSolved > 0 && (
                  <div className="mt-2 text-[10px] text-forest-400">
                    {puzzlesSolved} solved
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ELO History (recent activity) */}
        {eloHistory.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
            <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-4">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {eloHistory.slice(-10).reverse().map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-forest-800/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        entry.event === 'solve' ? 'bg-green-500' :
                        entry.event === 'wrong' ? 'bg-red-500' :
                        entry.event === 'game_win' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`} />
                      <span className="text-forest-300">
                        {entry.event === 'solve' && 'Puzzle solved'}
                        {entry.event === 'wrong' && 'Wrong attempt'}
                        {entry.event === 'game_win' && 'Game won'}
                        {entry.event === 'game_loss' && 'Game lost'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-medium ${entry.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.delta >= 0 ? '+' : ''}{entry.delta}
                      </span>
                      <span className="text-forest-500 font-mono w-10 text-right">{entry.elo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg bg-forest-800/50 border border-forest-700/30 px-3 py-2">
      <span className="text-[10px] text-forest-500 uppercase tracking-wider">{label}</span>
      <div className={`text-lg font-bold ${accent ? 'text-candy-400' : 'text-white'}`}>{value}</div>
      {sub && <span className="text-[10px] text-forest-500">{sub}</span>}
    </div>
  )
}
