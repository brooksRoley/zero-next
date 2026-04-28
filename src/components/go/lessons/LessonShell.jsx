import React from 'react'
import Link from 'next/link'

/**
 * Layout shell for a single lesson stage. Renders the breadcrumb, title,
 * progress dots, the stage content, and prev/next nav. Stages own their own
 * interactive state — this is purely chrome.
 */
const STAGE_PRACTICE_MAP = {
  1: 'capture',
  2: 'eyes',
  3: 'territory',
}

export default function LessonShell({
  stageNumber,
  totalStages,
  title,
  subtitle,
  prev,
  next,
  isComplete,
  children,
}) {
  const practiceStage = STAGE_PRACTICE_MAP[stageNumber]
  return (
    <div className="min-h-screen bg-forest-950 text-white">
      <nav className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go/learn"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 border-r border-forest-800/60"
          >
            &larr; Lessons
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide">
            Stage {stageNumber}: {title}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: totalStages }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === stageNumber ? 'bg-candy-400' : i < stageNumber ? 'bg-forest-500' : 'bg-forest-800'
                }`}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-forest-400 mt-1">{subtitle}</p>}
        </header>

        <div>{children}</div>

        {isComplete && practiceStage && (
          <div className="mt-4 rounded-xl border border-candy-400/30 bg-candy-500/10 px-4 py-3 text-sm">
            <p className="text-candy-200 mb-2">
              Ready to put <strong>{title}</strong> into practice?
            </p>
            <Link
              href={`/posts/go?practice=${practiceStage}`}
              className="inline-block px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-candy-100 hover:bg-candy-500/30 transition text-xs"
            >
              Play a practice game &rarr;
            </Link>
          </div>
        )}

        <footer className="mt-6 pt-4 border-t border-forest-800/60 flex items-center justify-between text-sm">
          {prev ? (
            <Link
              href={prev.href}
              className="text-forest-400 hover:text-candy-300 transition-colors"
            >
              &larr; {prev.label}
            </Link>
          ) : <span />}
          {next ? (
            <Link
              href={next.href}
              className="px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-candy-200 hover:bg-candy-500/30 transition"
            >
              {next.label} &rarr;
            </Link>
          ) : <span />}
        </footer>
      </div>
    </div>
  )
}

/**
 * Compact step card used by stages to show the current instruction + advance
 * button. Steps drive the lesson narrative; the interactive board sits next to
 * or above this card depending on layout.
 */
export function StepCard({ title, body, progress, action, secondary }) {
  return (
    <div className="rounded-xl border border-forest-700/50 bg-forest-900/70 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {progress && (
          <span className="text-xs text-forest-400 font-mono shrink-0">{progress}</span>
        )}
      </div>
      <p className="text-sm text-forest-200 leading-relaxed">{body}</p>
      {(action || secondary) && (
        <div className="mt-3 flex items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.disabled}
              className="px-3.5 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-sm text-candy-100 hover:bg-candy-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {action.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="px-3.5 py-1.5 rounded-md bg-forest-800/60 border border-forest-600/50 text-sm text-forest-200 hover:bg-forest-700/70 transition"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
