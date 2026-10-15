import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import TendNav, { SampleBanner } from 'src/components/games/TendNav'
import { Sprite } from 'src/components/games/watershed/Sprites'
import { trackGame } from 'src/lib/analytics'
import { CHAPTERS, ENTRIES, howToCollect, isCollected, type Chapter, type Entry, type JournalProgress } from 'src/lib/games/tend/journal'
import { readJournalProgress } from 'src/lib/games/tend/progress'
import { absoluteUrl, route } from 'src/lib/routes'

const GAME = 'tend-journal'

function EntryCard({ entry, collected }: { entry: Entry; collected: boolean }) {
  return (
    <li className={`rounded-xl border p-4 text-sm ${collected ? 'border-forest-600 bg-forest-900/50' : 'border-forest-800'}`}>
      <div className="flex gap-3">
        {entry.sprite && (
          <svg viewBox="0 0 40 40" width={40} height={40} className="shrink-0" aria-hidden overflow="visible">
            <Sprite id={entry.sprite} />
          </svg>
        )}
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-forest-400">
            {entry.kind} · {collected ? 'Collected' : 'Not yet collected'}
          </p>
          <h3 className="mt-1 font-semibold text-forest-100">{entry.title}</h3>
        </div>
      </div>
      <p className="mt-2 leading-relaxed text-forest-200">{entry.body}</p>
      {!collected && <p className="mt-2 text-xs text-forest-400">{howToCollect(entry)}</p>}
      <a href={entry.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-forest-400 underline underline-offset-2 hover:text-forest-200">
        {entry.source.label}
      </a>
    </li>
  )
}

export default function JournalPage() {
  const router = useRouter()
  const sample = router.isReady && router.query.sample === '1'
  const [progress, setProgress] = useState<JournalProgress | null>(null)
  const [chapter, setChapter] = useState<Chapter>('cultivated')
  const opened = useRef(new Set<Chapter>())

  useEffect(() => {
    if (!router.isReady) return
    setProgress(readJournalProgress(sample))
  }, [router.isReady, sample])

  // A chapter counts once, the first time the reader opens it themselves.
  const open = (id: Chapter) => {
    setChapter(id)
    if (opened.current.has(id)) return
    opened.current.add(id)
    trackGame('tutorial_stage_complete', GAME, { chapter: id })
  }

  const entries = ENTRIES.filter((e) => e.chapter === chapter)
  const count = (id: Chapter) => {
    const all = ENTRIES.filter((e) => e.chapter === id)
    return { have: progress ? all.filter((e) => isCollected(e, progress)).length : 0, of: all.length }
  }
  const current = CHAPTERS.find((c) => c.id === chapter)!

  return (
    <main className="min-h-screen bg-forest-950 font-sans text-forest-100">
      <Head>
        <title>The Journal — Tend | Brooks Roley</title>
        <meta
          name="description"
          content="Tend's field guide: crops people shaped by selection, wild species adapted to their place, and the chain reactions you set off in the Watershed."
        />
        <meta property="og:title" content="The Journal — Tend | Brooks Roley" key="og:title" />
        <meta property="og:url" content={absoluteUrl('tendJournal')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
        <TendNav current="journal" sample={sample} />
        {sample && <SampleBanner page="journal" />}
        <header className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">The Journal</h1>
          <p className="mt-3 text-sm leading-relaxed text-forest-300 sm:text-base">
            A field guide in three chapters. Every entry is open to read; playing collects them. Your garden&apos;s own
            plants have their notes on the{' '}
            <Link href={route('tend').href} className="text-forest-200 underline underline-offset-2 hover:text-white">
              Garden
            </Link>{' '}
            page.
          </p>
        </header>

        <div role="tablist" aria-label="Chapters" className="flex flex-wrap gap-2">
          {CHAPTERS.map((c) => {
            const { have, of } = count(c.id)
            const on = c.id === chapter
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                id={`tab-${c.id}`}
                aria-selected={on}
                aria-controls="chapter"
                onClick={() => open(c.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                  on ? 'border-forest-300 bg-forest-800 font-medium' : 'border-forest-800 text-forest-300 hover:border-forest-600'
                }`}
              >
                {c.title}{' '}
                <span className="font-mono text-xs text-forest-400">
                  {have}/{of}
                </span>
              </button>
            )
          })}
        </div>

        <section id="chapter" role="tabpanel" aria-labelledby={`tab-${chapter}`} className="mt-6">
          <p className="max-w-2xl text-sm text-forest-300">{current.blurb}</p>
          {!progress ? (
            <p className="mt-4 text-forest-400">Opening the journal…</p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} collected={isCollected(e, progress)} />
              ))}
            </ul>
          )}
        </section>

        <p className="mt-10 max-w-2xl text-xs text-forest-500">
          Each entry says only what its linked source says. Populations change across generations; individual animals and
          plants don&apos;t evolve. Wording follows the{' '}
          <a
            href="https://evolution.berkeley.edu/wp-content/uploads/2021/10/misconceptions_about_evolution_2020.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-forest-300"
          >
            UC Museum of Paleontology misconceptions guide
          </a>
          .
        </p>
      </div>
    </main>
  )
}
