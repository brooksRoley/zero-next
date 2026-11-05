import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import { track } from 'src/lib/analytics'
import { WORK_DESCRIPTION, WORK_INTRO, WORK_THESIS } from 'src/lib/narrative'
import { route } from 'src/lib/routes'

// The work, by domain (2026-10-23). This page used to be a sales funnel:
// pricing tiers, a "most popular" badge, a sticky "book a free call" bar and a
// lead form. It now highlights the work and reads plainly. The intro's
// wording lives in src/lib/narrative.ts (2026-11-05). Every line here is a
// fact from src/lib/resume.ts or from a page on this site; keep it that way.
// No prices, no urgency, no money ask.

type Domain = {
  domain: string
  org: string
  role: string
  dates: string
  line: string
  href?: string
}

const DOMAINS: Domain[] = [
  {
    domain: 'Robotics',
    org: 'Zoox',
    role: 'Software Engineer (contract)',
    dates: '2024 – 2025',
    line: 'Owned the Site Reliability team’s OnCall notification system across Vue, Python, AWS, Terraform and Grafana, and integrated the Zoox Intelligence AI into it and its Slack bot.',
  },
  {
    domain: 'Sustainability',
    org: 'Grove Collaborative',
    role: 'Software Engineer II',
    dates: '2019 – 2022',
    line: 'Full-stack on the e-commerce platform; led a 150 ms personalization service, a Vue migration and site-wide WCAG remediation.',
  },
  {
    domain: 'Healthcare',
    org: 'Zipongo (now Foodsmart)',
    role: 'Senior Associate and Software Engineer',
    dates: '2017 – 2019',
    line: 'Led front-end for role-based access control with SAML single sign-on, built to HIPAA requirements, and the provider nutrition tools.',
  },
  {
    domain: 'Finance',
    org: 'SigFig',
    role: 'Front End Software Engineer',
    dates: '2016 – 2017',
    line: 'Angular and TypeScript interfaces for banking partners including Wells Fargo, with accessibility and internationalization.',
  },
  {
    domain: 'Insurance',
    org: 'Limelight Health (now part of FINEOS)',
    role: 'Software Engineer',
    dates: '2015 – 2016',
    line: 'Early hire. Built the Node.js quoting APIs and the PDF service that charted insurance costs in D3.',
  },
]

type Build = { title: string; href: string; cs: string }
type BuildGroup = { name: string; builds: Build[] }

// The games, grouped by the computer science each one is built on
// (Brooks, 2026-11-05: the page had narrowed to Hardwood alone). Each line
// names something the code really does; narrative.test.ts checks every link.
const BUILD_GROUPS: BuildGroup[] = [
  {
    name: 'Engines and simulation',
    builds: [
      {
        title: 'Hardwood Autochess',
        href: route('hardwood').href,
        cs: 'An NBA auto-battler, built with Claude Code to learn how an engine and a UI fit together: a C++ simulation compiled to WebAssembly under a Vue 3 client, and an Electron launcher whose content-defined chunking ships a one-line change as 16 KB of a 1.07 MB build.',
      },
      {
        title: 'Pente',
        href: route('pente').href,
        cs: 'A minimax bot with alpha-beta pruning, iterative deepening and a Zobrist transposition table, running in a Web Worker so the board never stalls. Modes for one, two and four players.',
      },
      {
        title: 'Tower Defense: Nanu Pika',
        href: route('nanuPikaTd').href,
        cs: 'An eight-level campaign on a fixed-timestep engine, so a wave plays out the same at any frame rate. A bot measures each level, and a test fails if the difficulty stops rising.',
      },
    ],
  },
  {
    name: 'Algorithms as puzzles',
    builds: [
      {
        title: 'Pass & Cut',
        href: route('passAndCut').href,
        cs: 'The Shannon switching game as a basketball puzzle: secure passing lanes from the inbounder to the rim. Graph connectivity and minimum cuts.',
      },
      {
        title: 'Read & React',
        href: route('readAndReact').href,
        cs: 'Find the mixed strategy that beats an adaptive defense. An exact minimax solver sets par for every matrix.',
      },
      {
        title: 'Playoff Moments',
        href: route('moments').href,
        cs: 'Famous plays frozen one beat early, solved as geometry: where each player can reach in time.',
      },
    ],
  },
  {
    name: 'Learning and practice',
    builds: [
      {
        title: 'Pente Puzzles',
        href: route('pentePuzzles').href,
        cs: 'A curated catalog plus endless puzzles generated in a Web Worker, with difficulty that follows your rating.',
      },
      {
        title: 'Go',
        href: route('go').href,
        cs: 'A play mode, a staged tutorial and a puzzle trainer. Missed puzzles come back on a 1, 3 and 7 day spaced-review schedule.',
      },
    ],
  },
]

export default function Work() {
  const contactClick = (location: string) =>
    track('cta_click', { page: '/consulting', metadata: { location }, beacon: true })

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <Head>
        <title>Work | Brooks Roley</title>
        <meta
          name="description"
          content={WORK_DESCRIPTION}
        />
        <meta property="og:title" content="Work | Brooks Roley" key="og:title" />
        <meta property="og:url" content="https://www.brooksroley.com/consulting" key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        <Link href="/" className="text-sm text-ink-400 transition-colors hover:text-ink-200">
          &larr; Home
        </Link>

        <header className="mt-10 max-w-3xl">
          <Reveal>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Work</h1>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-xl font-medium leading-snug text-white">{WORK_THESIS}</p>
            <p className="mt-4 text-lg leading-relaxed text-ink-200">{WORK_INTRO}</p>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 text-sm text-ink-400">
              Open to full-time roles, and to select contract work.
            </p>
          </Reveal>
        </header>

        <section aria-labelledby="domains" className="mt-16">
          <h2 id="domains" className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
            Across industries
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((d) => {
              const body = (
                <>
                  <p className="text-xs font-medium uppercase tracking-wider text-brass-300">{d.domain}</p>
                  <p className="mt-3 font-semibold text-white">{d.org}</p>
                  <p className="text-sm text-ink-400">
                    {d.role} &middot; {d.dates}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-200">{d.line}</p>
                </>
              )
              const card = 'block h-full rounded-xl border border-ink-700 bg-charcoal p-5'
              return (
                <li key={d.org}>
                  {d.href ? (
                    <Link
                      href={d.href}
                      className={`${card} transition-colors hover:border-brass-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={card}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="builds" className="mt-16">
          <h2 id="builds" className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
            Computer science and game design
          </h2>
          <p className="mt-3 text-sm text-ink-400">
            Grouped by the idea each one is built on. Every game on the site is also in the{' '}
            <Link href={route('theater').href} className="text-brass-300 hover:text-brass-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400">
              Theater
            </Link>
            .
          </p>
          {BUILD_GROUPS.map((g) => (
            <div key={g.name} className="mt-8">
              <h3 className="text-sm font-semibold text-ink-200">{g.name}</h3>
              <ul className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
                {g.builds.map((b) => (
                  <li key={b.title}>
                    <Link
                      href={b.href}
                      className="group grid gap-2 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 sm:grid-cols-[14rem_1fr] sm:gap-8"
                    >
                      <span className="font-semibold text-white transition-colors group-hover:text-brass-300">
                        {b.title}
                      </span>
                      <span className="text-sm leading-relaxed text-ink-200">{b.cs}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <footer className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link
            href={route('intake').href}
            onClick={() => contactClick('work_contact')}
            className="font-medium text-brass-300 transition-colors hover:text-brass-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
          >
            Get in touch &rarr;
          </Link>
          <Link
            href={route('resume').href}
            className="text-ink-300 transition-colors hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
          >
            Resume
          </Link>
        </footer>
      </div>
    </main>
  )
}
