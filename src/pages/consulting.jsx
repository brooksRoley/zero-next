import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'

const SERVICES = [
  {
    name: 'Strategy Session',
    price: '$150',
    unit: '/ hour',
    description: 'One-on-one technical consultation for architecture decisions, code reviews, or career strategy.',
    features: [
      'Video call via Calendly',
      'Architecture or code review',
      'Written follow-up notes',
      'Ad-hoc scheduling',
    ],
    cta: 'Book a Session',
    href: 'https://calendly.com/brooksroley/',
    accent: false,
  },
  {
    name: 'Project Sprint',
    price: '$6,000',
    unit: '/ week',
    description: 'Embedded full-stack engineering for a focused sprint. Ideal for MVPs, feature builds, or data pipelines.',
    features: [
      'Dedicated 40-hr week',
      'Daily standups & async updates',
      'Full-stack React + Node.js + TypeScript',
      'Production-ready deliverables',
    ],
    cta: 'Start a Sprint',
    href: 'https://calendly.com/brooksroley/',
    accent: true,
  },
  {
    name: 'Fractional Engineer',
    price: '$3,000',
    unit: '/ month',
    description: 'Ongoing part-time engineering support. 10 hours per week, flexible scheduling.',
    features: [
      '~10 hrs / week',
      'Slack or async communication',
      'Sprint planning & code reviews',
      'Month-to-month, cancel anytime',
    ],
    cta: 'Let\u2019s Talk',
    href: 'https://calendly.com/brooksroley/',
    accent: false,
  },
]

const SKILLS = [
  { category: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Vue 3'] },
  { category: 'Mobile', items: ['SwiftUI', 'MVVM', 'iOS APIs'] },
  { category: 'Backend', items: ['Node.js', 'Python', 'PostgreSQL', 'REST APIs'] },
  { category: 'Data & Analytics', items: ['NBA APIs', 'Chart.js', 'Data pipelines', 'C++ WASM'] },
  { category: 'Infrastructure', items: ['Vercel', 'AWS', 'Supabase', 'CI/CD'] },
  { category: 'Domain', items: ['Sports tech', 'Game development', 'Nonprofit tech'] },
]

const PROJECTS_PROOF = [
  {
    title: 'Basketball Data Platform',
    desc: 'Full-stack analytics: Python API, C++ WASM engine, Vue 3 frontend, SwiftUI iOS app.',
    href: '/basketball-platform',
  },
  {
    title: 'Pente Online',
    desc: 'Browser-based multiplayer strategy game with AI opponent and real-time play.',
    href: '/posts/pente',
  },
  {
    title: 'Nanu & Pika TD',
    desc: 'Tower defense game built from scratch — pathfinding, wave logic, upgrade systems.',
    href: '/posts/nanu-pika-td',
  },
]

export default function Consulting() {
  return (
    <main className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Consulting &mdash; Brooks Roley</title>
        <meta name="description" content="Hire Brooks Roley for full-stack engineering, sports tech, React, TypeScript, and Node.js consulting." />
      </Head>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-forest-950 to-forest-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,105,180,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(45,106,79,0.35),transparent_55%)]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-candy-400 mb-4">
              Engineering Services
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Ship faster with a<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-candy-400 to-candy-300">
                senior full-stack engineer
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg sm:text-xl text-forest-200 max-w-2xl mx-auto mb-8">
              React, TypeScript, Node.js, SwiftUI, and sports&nbsp;tech.
              From strategy sessions to embedded sprints &mdash; I help teams build production-ready software.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://calendly.com/brooksroley/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-candy-500 hover:bg-candy-600 text-white font-semibold transition-colors shadow-lg shadow-candy-500/20"
              >
                Schedule a Call
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#services"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-forest-600 hover:border-forest-500 text-forest-200 hover:text-white font-medium transition-colors"
              >
                View Packages
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ── Service Packages ── */}
        <section id="services" className="py-16 sm:py-20">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Services
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              Flexible engagement models
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICES.map((svc, i) => (
              <Reveal key={svc.name} delay={i * 100}>
                <div
                  className={`relative flex flex-col h-full rounded-xl border p-6 transition-colors ${
                    svc.accent
                      ? 'border-candy-500/60 bg-candy-500/5 shadow-lg shadow-candy-500/10'
                      : 'border-forest-700/40 bg-forest-900/60 hover:border-forest-600/60'
                  }`}
                >
                  {svc.accent && (
                    <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-candy-500 text-xs font-semibold text-white tracking-wide">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold mb-1">{svc.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold">{svc.price}</span>
                    <span className="text-sm text-forest-400">{svc.unit}</span>
                  </div>
                  <p className="text-sm text-forest-300 mb-5 flex-grow">{svc.description}</p>
                  <ul className="space-y-2 mb-6">
                    {svc.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-forest-200">
                        <svg className="w-4 h-4 mt-0.5 text-forest-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={svc.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                      svc.accent
                        ? 'bg-candy-500 hover:bg-candy-600 text-white shadow-md shadow-candy-500/20'
                        : 'bg-forest-800 hover:bg-forest-700 text-forest-100 border border-forest-700/60'
                    }`}
                  >
                    {svc.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Tech Stack ── */}
        <section className="py-16 sm:py-20 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Expertise
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              What I bring to your team
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {SKILLS.map((group, i) => (
              <Reveal key={group.category} delay={i * 80}>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-candy-400/80 mb-2">
                    {group.category}
                  </h3>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-forest-200">{item}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Proof / Selected Work ── */}
        <section className="py-16 sm:py-20 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Selected Work
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              Built, shipped, and running
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PROJECTS_PROOF.map((proj, i) => (
              <Reveal key={proj.title} delay={i * 100}>
                <Link
                  href={proj.href}
                  className="group block rounded-xl border border-forest-700/40 bg-forest-900/60 p-5 transition-colors hover:border-forest-600/60"
                >
                  <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                    {proj.title}
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </h3>
                  <p className="text-sm text-forest-300">{proj.desc}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-16 sm:py-24 border-t border-forest-800/60 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to build something?
            </h2>
            <p className="text-lg text-forest-300 max-w-xl mx-auto mb-8">
              Book a free 15-minute intro call. No pitch, no pressure &mdash; just a conversation about what you need.
            </p>
            <a
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-candy-500 hover:bg-candy-600 text-white font-semibold transition-colors shadow-lg shadow-candy-500/20 text-lg"
            >
              Schedule a Call
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </Reveal>
        </section>
      </div>
    </main>
  )
}
