import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import { HUB_SECTIONS, hubLink } from 'src/lib/basketballHub'
import { glintStyle } from 'src/lib/ember/weather'
import { absoluteUrl, route } from 'src/lib/routes'

// All of the basketball work in one place, so the nav can carry a single
// Basketball link instead of scattering it across Projects and Games.
// The items and their lines live in src/lib/basketballHub.ts.

export default function Basketball() {
  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <Head>
        <title>Basketball | Brooks Roley</title>
        <meta
          name="description"
          content="Basketball games, NBA tools and the systems behind them, built by Brooks Roley."
        />
        <meta property="og:title" content="Basketball | Brooks Roley" key="og:title" />
        <meta property="og:url" content={absoluteUrl('basketball')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        <Link
          href={route('home').href}
          className="text-sm text-ink-400 transition-colors hover:text-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
        >
          &larr; Home
        </Link>

        <header className="mt-10 max-w-3xl">
          <Reveal>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Basketball</h1>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-lg leading-relaxed text-ink-200">
              Basketball is the sport I play and watch most. These are the games, tools and systems
              I&apos;ve built around it.
            </p>
          </Reveal>
        </header>

        {HUB_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`hub-${section.id}`} className="mt-14 sm:mt-16">
            <h2
              id={`hub-${section.id}`}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-400"
            >
              {section.heading}
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => {
                const { href, title } = hubLink(item)
                return (
                  <li key={item.key}>
                    <Link
                      href={href}
                      className="group block h-full rounded-xl border border-ink-700 bg-charcoal p-5 transition-colors hover:border-brass-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-white">
                          <span className="ember-glint" style={glintStyle(title)}>
                            {title}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-ink-400 transition-colors group-hover:text-brass-300"
                        >
                          &rarr;
                        </span>
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-ink-200">{item.line}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <footer className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link
            href={route('resume').href}
            className="font-medium text-brass-300 transition-colors hover:text-brass-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
          >
            Resume &rarr;
          </Link>
          <Link
            href={route('theater').href}
            className="text-ink-300 transition-colors hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
          >
            Every game on the site
          </Link>
        </footer>
      </div>
    </main>
  )
}
