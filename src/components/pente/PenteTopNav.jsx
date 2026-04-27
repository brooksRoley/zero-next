import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

/**
 * Persistent top-nav for the Pente surfaces — Hub / Game / Puzzles — so every
 * destination is one click away from any other. `active` forces a tab to read
 * as current when the route alone can't tell (e.g. puzzle Endless vs Catalog).
 */
const TABS = [
  { key: 'hub', label: 'Hub', href: '/pente' },
  { key: 'game', label: 'Play', href: '/posts/pente' },
  { key: 'catalog', label: 'Puzzles', href: '/posts/pente-puzzles' },
]

export default function PenteTopNav({ active }) {
  const router = useRouter()
  const path = router.pathname
  const queryMode = router.query?.mode

  const resolved = active || (
    path === '/pente' ? 'hub' :
    path === '/posts/pente' ? 'game' :
    path === '/posts/pente-puzzles' ? 'catalog' :
    null
  )

  return (
    <nav
      aria-label="Pente sections"
      className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-1">
        <Link
          href="/"
          className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 mr-1 border-r border-forest-800/60"
          aria-label="Back to home"
        >
          &larr;
        </Link>
        <span className="text-xs font-semibold text-white tracking-wide mr-3">Pente</span>
        <div
          className="flex gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {TABS.map(tab => {
            const isActive = resolved === tab.key
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-candy-500/15 text-candy-300 ring-1 ring-candy-400/30'
                    : 'text-forest-400 hover:text-candy-300 hover:bg-forest-800/40'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
