import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'

const WHAT_I_DO = [
  {
    title: 'Full-Stack Web Apps',
    desc: 'React, Next.js, TypeScript, Node.js, PostgreSQL. From greenfield builds to untangling legacy code.',
  },
  {
    title: 'Sports Tech & Data',
    desc: 'NBA analytics, data pipelines, interactive visualizations. I built a full basketball data platform from API to iOS.',
  },
  {
    title: 'Games & Interactive Experiences',
    desc: 'Browser games, physics simulations, canvas work. If it moves on screen and people interact with it, I\'m into it.',
  },
  {
    title: 'Mobile (SwiftUI)',
    desc: 'Native iOS apps with clean architecture. MVVM, async/await, the whole deal.',
  },
]

const PROJECTS_PROOF = [
  {
    title: 'Basketball Data Platform',
    desc: 'Python API, C++ WASM engine, Vue 3 frontend, SwiftUI iOS app.',
    href: '/basketball-platform',
  },
  {
    title: 'Pente Online',
    desc: 'Multiplayer strategy game with AI opponent and real-time play.',
    href: '/posts/pente',
  },
  {
    title: 'Nanu & Pika TD',
    desc: 'Tower defense game — pathfinding, wave logic, upgrade systems.',
    href: '/posts/nanu-pika-td',
  },
]

export default function Consulting() {
  return (
    <main className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Work With Me &mdash; Brooks Roley</title>
        <meta name="description" content="Full-stack engineering, sports tech, and game development. Let's build something together." />
      </Head>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-forest-950 to-forest-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,105,180,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(45,106,79,0.35),transparent_55%)]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Let&apos;s build something together
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-lg text-forest-200 max-w-2xl mx-auto mb-8 leading-relaxed">
              I&apos;m a full-stack engineer who loves sports tech, games, and making things that work well.
              If you&apos;ve got a project that needs another set of hands &mdash; or just want to talk shop &mdash; I&apos;d love to hear about it.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <a
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-candy-500 hover:bg-candy-600 text-white font-semibold transition-colors shadow-lg shadow-candy-500/20"
            >
              Grab a Time to Chat
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* ── What I Work On ── */}
        <section className="py-16 sm:py-20">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              What I Do
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              The stuff I&apos;m good at
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WHAT_I_DO.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-5">
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-forest-300 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-16 sm:py-20 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              How It Works
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              No pitch deck required
            </p>
          </Reveal>

          <div className="space-y-6">
            {[
              { step: '01', title: 'We talk', desc: 'Book a free call. Tell me what you\'re working on, where you\'re stuck, or what you want to build. No commitment.' },
              { step: '02', title: 'I scope it out', desc: 'I\'ll put together a straightforward proposal — what I\'d do, how long it\'d take, and what it\'d cost. Hourly or project-based, whatever makes sense.' },
              { step: '03', title: 'We build', desc: 'I write code, ship features, and keep you in the loop. Clean PRs, clear communication, no surprises.' },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 100}>
                <div className="flex gap-4 items-start">
                  <span className="text-sm font-mono text-candy-400/60 mt-1 shrink-0">{item.step}</span>
                  <div>
                    <h3 className="text-base font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-forest-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Selected Work ── */}
        <section className="py-16 sm:py-20 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Things I&apos;ve Built
            </h2>
            <p className="text-2xl sm:text-3xl font-bold mb-10">
              See for yourself
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

        {/* ── CTA ── */}
        <section className="py-16 sm:py-24 border-t border-forest-800/60 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Sound like a fit?
            </h2>
            <p className="text-lg text-forest-300 max-w-lg mx-auto mb-8">
              Pick a time that works for you. 15 minutes, no strings attached.
            </p>
            <a
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-candy-500 hover:bg-candy-600 text-white font-semibold transition-colors shadow-lg shadow-candy-500/20"
            >
              Grab a Time
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </Reveal>
        </section>
      </div>
    </main>
  )
}
