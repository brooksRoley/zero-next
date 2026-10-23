import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import { track } from 'src/lib/analytics'
import { route } from 'src/lib/routes'

// The work, by domain (2026-10-23). This page used to be a sales funnel:
// pricing tiers, a "most popular" badge, a sticky "book a free call" bar and a
// lead form. Brooks asked for it to highlight the work and read less
// desperate. Every line here is a fact from src/lib/resume.ts or from a page
// on this site; keep it that way. No prices, no urgency, no money ask.

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
    line: 'Owned the Site Reliability team’s OnCall notification system across Vue, Python, AWS, Terraform and Grafana.',
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
    role: 'Senior Software Engineer',
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
    line: 'Early engineering hire on a platform generating employer insurance quotes, including a D3 quote-visualization service.',
  },
  {
    domain: 'Ecology',
    org: 'Tend: The Watershed',
    role: 'Independent',
    dates: '2026',
    line: 'California from the alpine peaks to the deep-sea floor: who eats whom, and how energy moves through it.',
    href: '/games/tend/watershed',
  },
]

type Build = { title: string; href: string; cs: string }

const BUILDS: Build[] = [
  {
    title: 'Hardwood Autochess',
    href: '/games/hardwood',
    cs: 'A C++ simulation engine compiled to WebAssembly under a Vue 3 client, and a desktop launcher in Electron, React and TypeScript whose content-defined chunking ships a one-line change as 16 KB of a 1.07 MB build.',
  },
  {
    title: 'Pass & Cut',
    href: '/games/pass-and-cut',
    cs: 'The Shannon switching game played as basketball. An exact game-tree solver runs the defense, so every level is a fair test of graph connectivity and min-cut.',
  },
  {
    title: 'Read & React',
    href: '/games/read-and-react',
    cs: 'Play-calling against an adaptive defense. A minimax solver sets par and reveals the mixed strategy that beats a perfect read.',
  },
  {
    title: 'Pente and Go',
    href: '/posts/pente',
    cs: 'Classic board games with bots that think in a Web Worker, puzzles, ELO ratings and online play.',
  },
  {
    title: 'Basketball data platform',
    href: '/basketball-platform',
    cs: 'Four codebases sharing one model of the game: a Python data pipeline, the C++ engine, the Vue game and a SwiftUI iOS app.',
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
          content="Brooks Roley, software engineer: ten years across robotics, healthcare, finance and sustainability, and games built on real computer science."
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
            <p className="mt-5 text-lg leading-relaxed text-ink-200">
              Software engineer with a front-end lean. Ten years shipping product in robotics,
              healthcare, finance and sustainability, and a long habit of building games where the
              computer science is the game.
            </p>
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
          <ul className="mt-6 divide-y divide-ink-700 border-y border-ink-700">
            {BUILDS.map((b) => (
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
