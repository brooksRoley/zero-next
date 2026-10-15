import Link from 'next/link'
import SoundToggle from 'src/components/SoundToggle'
import { route } from 'src/lib/routes'

type Page = 'garden' | 'watershed' | 'journal'

const PAGES: { id: Page; label: string; href: string }[] = [
  { id: 'garden', label: 'Garden', href: route('tend').href },
  { id: 'watershed', label: 'Watershed', href: route('tendWatershed').href },
  { id: 'journal', label: 'Journal', href: route('tendJournal').href },
]

/** One bar across Tend's pages, so the garden and the watershed read as one game. Carries sample mode along. */
export default function TendNav({ current, sample }: { current: Page; sample: boolean }) {
  return (
    <nav aria-label="Tend" className="mb-6 flex items-center gap-1 rounded-full border border-forest-800 bg-forest-900/40 p-1 text-sm">
      <span className="px-2 font-semibold tracking-tight text-forest-100 sm:px-3">Tend</span>
      {PAGES.map((page) => {
        const here = page.id === current
        return (
          <Link
            key={page.id}
            href={sample ? { pathname: page.href, query: { sample: '1' } } : page.href}
            aria-current={here ? 'page' : undefined}
            className={`rounded-full px-2.5 py-1.5 transition-colors sm:px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
              here ? 'bg-forest-200 font-medium text-forest-950' : 'text-forest-300 hover:bg-forest-800 hover:text-forest-100'
            }`}
          >
            {page.label}
          </Link>
        )
      })}
      <span className="ml-auto flex items-center gap-1">
        {sample && <span className="hidden px-2 font-mono text-xs uppercase tracking-widest text-amber-200/90 sm:inline">Sample</span>}
        <SoundToggle className="rounded-full p-1.5 text-forest-300 hover:bg-forest-800 hover:text-forest-100" />
      </span>
    </nav>
  )
}

/** The read-only banner shown on every Tend page while a visitor is looking at the sample garden. */
export function SampleBanner({ page }: { page: Page }) {
  return (
    <section role="status" className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="text-amber-100">
        You&apos;re looking at a sample garden on day 40. It&apos;s read-only, and nothing here is saved to your browser.
      </p>
      <Link
        href={PAGES.find((p) => p.id === page)!.href}
        className="mt-2 inline-block font-medium text-amber-200 underline underline-offset-2 hover:text-white"
      >
        {page === 'garden' ? 'Start your own garden' : `Back to your own ${page}`}
      </Link>
    </section>
  )
}
