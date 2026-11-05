import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import QuietField from 'src/components/QuietField'
import { AI_NOTE, AVAILABILITY, HERO_SUMMARY } from 'src/lib/resume'
import { route, type RouteKey } from 'src/lib/routes'

// The home page, quiet on purpose (2026-11-03): a name, what Brooks does, his
// availability (AVAILABILITY), the AI note, and one row of links. Everything
// else lives one click away. Light by default, with a dark toggle that this
// browser remembers, over a faint drifting ridgeline field.

const EMAIL = 'brooksroley@gmail.com'
const THEME_KEY = 'br_home_theme'

// In reading order: the professional links first (resume, then the work page),
// then one link to every game. Brooks, 2026-11-05: single game links here read
// as less professional than the Theater, which sorts the games into its own sections.
const LINKS: { key: RouteKey; label: string }[] = [
  { key: 'resume', label: 'resume' },
  { key: 'consulting', label: 'work' },
  { key: 'theater', label: 'games' },
  { key: 'github', label: 'github' },
  { key: 'linkedin', label: 'linkedin' },
]

const linkClass =
  'rounded-sm underline decoration-[var(--q-rule)] underline-offset-4 transition-colors hover:text-[var(--q-fg)] hover:decoration-[var(--q-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--q-bg)]'

const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)

const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
)

export default function Home() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEME_KEY) === 'dark') setDark(true)
    } catch {
      // Storage blocked: stay light.
    }
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    try {
      window.localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      // Not remembered; the toggle still works for this visit.
    }
  }

  return (
    <main data-theme={dark ? 'dark' : 'light'} className="quiet-home relative min-h-[100svh] overflow-hidden">
      <Head>
        <title>Brooks Roley | Software Engineer</title>
        <meta name="theme-color" content={dark ? '#101B2B' : '#F6F3EC'} />
      </Head>
      <QuietField dark={dark} />

      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--q-fg)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-accent)] sm:right-6 sm:top-5"
      >
        {dark ? <Sun /> : <Moon />}
      </button>

      <section className="relative z-[1] mx-auto flex min-h-[100svh] max-w-[600px] flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-[clamp(2.4rem,8vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--q-fg)]">
          Brooks Roley
        </h1>
        <p className="mt-3 font-mono text-sm text-[var(--q-muted)]">Full-stack engineer · browser games and interactive tools · Orange County, CA</p>

        <p className="mt-8 text-[15px] leading-7 text-[var(--q-body)]">
          {HERO_SUMMARY}{' '}
          <span className="font-medium text-[var(--q-fg)]">{AVAILABILITY}</span>
        </p>
        <p className="mt-4 text-[15px] leading-7 text-[var(--q-body)]">{AI_NOTE}</p>

        <nav aria-label="Links" className="mt-10">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 font-mono text-sm text-[var(--q-body)]">
            {LINKS.map(({ key, label }) => {
              const r = route(key)
              return (
                <li key={key}>
                  {r.external ? (
                    <a href={r.href} target="_blank" rel="me noopener noreferrer" className={linkClass}>
                      {label}
                    </a>
                  ) : (
                    <Link href={r.href} className={linkClass}>
                      {label}
                    </Link>
                  )}
                </li>
              )
            })}
            <li>
              <a href={`mailto:${EMAIL}`} className={linkClass}>
                {EMAIL}
              </a>
            </li>
          </ul>
        </nav>
      </section>
    </main>
  )
}
