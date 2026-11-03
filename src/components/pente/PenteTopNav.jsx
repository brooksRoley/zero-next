import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

/**
 * Persistent top-nav for the Pente surfaces — Hub / Game / Puzzles — so every
 * destination is one click away from any other. `active` forces a tab to read
 * as current when the route alone can't tell (e.g. puzzle Endless vs Catalog).
 * `heading` makes the Pente label the page's <h1>, for pages with no other
 * heading; `tagline` adds a one-line goal beside the tabs on wider screens.
 */
const TABS = [
  { key: 'hub', label: 'Hub', href: '/pente' },
  { key: 'game', label: 'Play', href: '/posts/pente' },
  { key: 'catalog', label: 'Puzzles', href: '/posts/pente-puzzles' },
]

export default function PenteTopNav({ active, heading = false, tagline = null }) {
  const Label = heading ? 'h1' : 'span'
  const router = useRouter()
  const path = router.pathname
  const queryMode = router.query?.mode

  const resolved = active || (
    path === '/pente' ? 'hub' :
    path === '/posts/pente' ? 'game' :
    path === '/posts/pente-puzzles' ? 'catalog' :
    null
  )

  // Quiet (2026-11-03): no bar, no borders. The section name is a mono
  // eyebrow as on the home page; the current tab is a mist pill. Still sticky
  // (the puzzles page scrolls), blurred rather than painted.
  return (
    <nav
      aria-label="Pente sections"
      className="sticky top-0 z-30 backdrop-blur-md"
    >
      <div className="max-w-5xl mx-auto px-3 h-12 flex items-center gap-1">
        <Link
          href="/"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:text-[#E9E3D6] transition-colors"
          aria-label="Back to home"
        >
          <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 10H4m5-5-5 5 5 5" />
          </svg>
        </Link>
        <Label className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/90 mr-3">Pente</Label>
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
                aria-current={isActive ? 'page' : undefined}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E9E3D6]/[0.1] text-[#E9E3D6]'
                    : 'text-ink-300 hover:text-[#E9E3D6]'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
        {tagline && (
          <p className="ml-auto pl-3 hidden md:block text-xs text-ink-300 truncate">{tagline}</p>
        )}
      </div>
    </nav>
  )
}
