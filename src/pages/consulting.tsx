import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { track as trackEvent } from 'src/lib/analytics'

// Funnel events are tagged page:'consulting' and use sendBeacon, since most of
// them (Calendly/checkout CTAs) fire right before the page unloads on nav.
function track(event_type: string, metadata: Record<string, unknown> = {}) {
  trackEvent(event_type, { page: 'consulting', metadata, beacon: true })
}

/* ── Stripe checkout (handleCheckout → /api/consulting/checkout) intentionally
   not wired up yet — swap the pricing-grid "Book a Call" links for per-tier
   checkout buttons once live Stripe keys are set in Vercel
   (see CLAUDE.md → "Stripe — Shipping Checklist"). ── */

const PRICING_TIERS = [
  {
    name: 'Strategy Session',
    price: '$150',
    unit: 'one-time',
    desc: '90 minutes on your architecture, roadmap, or a gnarly technical decision. You leave with a written plan.',
    featured: false,
  },
  {
    name: 'Dev Sprint',
    price: '$2,400',
    unit: 'per week',
    desc: 'A focused week of hands-on building — features shipped, PRs reviewed, momentum restored.',
    featured: true,
  },
  {
    name: 'Fractional CTO',
    price: '$4,000',
    unit: 'per month',
    desc: 'Ongoing technical leadership — architecture calls, hiring help, and a senior engineer in your corner.',
    featured: false,
  },
]

const PROJECT_TYPES = [
  'New project build',
  'Existing codebase work',
  'Technical strategy/advisory',
  'Other',
]

const BUDGET_RANGES = [
  'Under $5k',
  '$5k–$25k',
  '$25k–$75k',
  '$75k+',
  'Not sure yet',
]

const SKILLS = [
  'React & Next.js', 'TypeScript', 'Node.js', 'PostgreSQL',
  'SwiftUI / iOS', 'Sports & NBA Analytics', 'Data Pipelines',
  'AWS & Serverless', 'Vue 3', 'FastAPI / Python', 'System Design',
]

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
    desc: 'Browser games, physics simulations, canvas work. If it moves on screen and people interact with it, I’m into it.',
  },
  {
    title: 'Mobile (SwiftUI)',
    desc: 'Native iOS apps with clean architecture. MVVM, async/await, the whole deal.',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'We talk', desc: 'Book a free call. Tell me what you’re working on, where you’re stuck, or what you want to build. No commitment.' },
  { step: '02', title: 'I scope it out', desc: 'I’ll put together a straightforward proposal — what I’d do, how long it’d take, and what it’d cost. Hourly or project-based, whatever makes sense.' },
  { step: '03', title: 'We build', desc: 'I write code, ship features, and keep you in the loop. Clean PRs, clear communication, no surprises.' },
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

const TIMELINES = ['ASAP', '1-3 months', '3-6 months', 'Just exploring']

export default function Consulting() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', email: '', company: '', project_type: '', budget_range: '', timeline: '', message: '', website: '' })
  // Captured once on mount so attribution survives even if the visitor edits
  // the URL or navigates within the SPA before submitting.
  const [attribution, setAttribution] = useState({ utm_source: '', utm_medium: '', utm_campaign: '' })

  // Mobile sticky CTA hides itself while the header "Book a Call" button is on
  // screen, so the two CTAs never compete for the same fold.
  const headerCtaRef = useRef<HTMLAnchorElement>(null)
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    track('consulting_view')
    const params = new URLSearchParams(window.location.search)
    setAttribution({
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
    })
  }, [])

  useEffect(() => {
    const target = headerCtaRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/consulting/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...attribution }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setSubmitting(false)
      return
    }

    track('lead_submit', {
      project_type: form.project_type || null,
      budget_range: form.budget_range || null,
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <>
      <Head>
        <title>Consulting | Brooks Roley</title>
        <meta name="description" content="Full-stack engineer for hire — React, TypeScript, Node, iOS, sports tech. Strategy sessions from $150. Let's build something." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Brooks Roley — Full-Stack Engineer for Hire" />
        <meta property="og:description" content="React, TypeScript, Node, iOS, sports tech. Strategy sessions, dev sprints, and fractional CTO engagements." />
        <meta property="og:image" content="https://brooksroley.com/BRLogoTransparent.png" />
        <meta property="og:url" content="https://brooksroley.com/consulting" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Brooks Roley — Full-Stack Engineer for Hire" />
        <meta name="twitter:description" content="React, TypeScript, Node, iOS, sports tech. Strategy sessions, dev sprints, and fractional CTO engagements." />
        <meta name="twitter:image" content="https://brooksroley.com/BRLogoTransparent.png" />
      </Head>

      <div className="min-h-screen bg-forest-950 text-forest-100">
        {/* ── Nav ── */}
        <header className="border-b border-forest-800/50 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-forest-400 hover:text-candy-400 transition-colors text-sm">
              &larr; Home
            </Link>
            <a
              ref={headerCtaRef}
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('cta_click', { location: 'header' })}
              className="px-4 py-2 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
            >
              Book a Call
            </a>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-16">

          {/* ── Hero ── */}
          <section className="mb-12">
            <div className="inline-flex items-center gap-2 mb-5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Currently taking new projects
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Let&apos;s Talk
            </h1>
            <p className="text-forest-300 text-lg leading-relaxed">
              I&apos;m a full-stack engineer with a frontend lean — React, TypeScript, Node, iOS, sports tech.
              If you&apos;ve got something interesting going on and want to think through it together, reach out.
              No pitch decks required.
            </p>
            <p className="mt-4 text-sm text-forest-400">
              Strategy sessions from $150 &middot; Dev sprints from $2,400/wk &middot; Fractional CTO from $4,000/mo.
            </p>
          </section>

          {/* ── Skills ── */}
          <section className="mb-12">
            <div className="flex flex-wrap gap-2">
              {SKILLS.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-full text-xs bg-forest-900/60 text-forest-300 border border-forest-700/40"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {/* ── What I Do ── */}
          <section className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              What I Do
            </h2>
            <p className="text-xl sm:text-2xl font-bold text-white mb-6">
              The stuff I&apos;m good at
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WHAT_I_DO.map(item => (
                <div
                  key={item.title}
                  className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-5"
                >
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-forest-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── How It Works ── */}
          <section className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              How It Works
            </h2>
            <p className="text-xl sm:text-2xl font-bold text-white mb-6">
              No pitch deck required
            </p>
            <div className="space-y-5">
              {HOW_IT_WORKS.map(item => (
                <div key={item.step} className="flex gap-4 items-start">
                  <span className="text-sm font-mono text-candy-400/60 mt-1 shrink-0">{item.step}</span>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-forest-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Selected Work ── */}
          <section className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Things I&apos;ve Built
            </h2>
            <p className="text-xl sm:text-2xl font-bold text-white mb-6">
              See for yourself
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PROJECTS_PROOF.map(proj => (
                <Link
                  key={proj.title}
                  href={proj.href}
                  className="group block rounded-xl border border-forest-700/40 bg-forest-900/60 p-5 transition-colors hover:border-forest-600/60"
                >
                  <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                    {proj.title}
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </h3>
                  <p className="text-sm text-forest-300">{proj.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Pricing ── */}
          <section className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Pricing
            </h2>
            <p className="text-xl sm:text-2xl font-bold text-white mb-6">
              Pick your speed
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PRICING_TIERS.map(tier => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-xl border p-5 ${
                    tier.featured
                      ? 'border-candy-500/40 bg-forest-900/80'
                      : 'border-forest-700/40 bg-forest-900/60'
                  }`}
                >
                  {tier.featured && (
                    <span className="self-start mb-3 rounded-full bg-candy-500/15 border border-candy-500/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-candy-300">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                  <p className="mt-2">
                    <span className="text-2xl font-bold text-white">{tier.price}</span>{' '}
                    <span className="text-xs text-forest-400">{tier.unit}</span>
                  </p>
                  <p className="mt-3 text-sm text-forest-300 leading-relaxed flex-1">
                    {tier.desc}
                  </p>
                  <a
                    href="https://calendly.com/brooksroley/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('cta_click', { location: 'pricing_grid', tier: tier.name })}
                    className="mt-5 block text-center px-4 py-2.5 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
                  >
                    Book a Call
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* ── Ways to connect ── */}
          <section className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('calendly_open', { location: 'connect_tile' })}
              className="flex flex-col items-center gap-2 rounded-xl border border-forest-800/50 bg-forest-900/30 hover:border-forest-700/60 p-6 text-center transition-all"
            >
              <span className="text-2xl">&#128222;</span>
              <span className="text-sm font-medium text-white">Schedule a Call</span>
              <span className="text-xs text-forest-500">Pick a time on Calendly</span>
            </a>

            <Link
              href="/intake"
              onClick={() => track('intake_open', { location: 'connect_tile' })}
              className="flex flex-col items-center gap-2 rounded-xl border border-forest-800/50 bg-forest-900/30 hover:border-forest-700/60 p-6 text-center transition-all"
            >
              <span className="text-2xl">&#127908;</span>
              <span className="text-sm font-medium text-white">Voice Intake</span>
              <span className="text-xs text-forest-500">Describe your project out loud &mdash; I&apos;ll receive a transcript and reply within a day.</span>
            </Link>

            <a
              href="#contact"
              className="flex flex-col items-center gap-2 rounded-xl border border-forest-800/50 bg-forest-900/30 hover:border-forest-700/60 p-6 text-center transition-all"
            >
              <span className="text-2xl">&#9993;</span>
              <span className="text-sm font-medium text-white">Send a Message</span>
              <span className="text-xs text-forest-500">I&apos;ll reply within a day</span>
            </a>

            <a
              href="https://www.linkedin.com/in/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 rounded-xl border border-forest-800/50 bg-forest-900/30 hover:border-forest-700/60 p-6 text-center transition-all"
            >
              <span className="text-2xl">&#128279;</span>
              <span className="text-sm font-medium text-white">Connect on LinkedIn</span>
              <span className="text-xs text-forest-500">in/brooksroley</span>
            </a>
          </section>

          {/* ── Contact Form ── */}
          <section id="contact">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-6">
              Send a Message
            </h2>

            {submitted ? (
              <div className="text-center py-12 px-6 rounded-xl border border-forest-800/50 bg-forest-900/30">
                <div className="text-3xl mb-3">&#9993;</div>
                <h3 className="text-lg font-bold text-white mb-2">Got it, thanks {form.name.split(' ')[0]}.</h3>
                <p className="text-forest-400 text-sm mb-4">
                  I&apos;ll get back to you within 24 hours.
                </p>
                <a
                  href="https://calendly.com/brooksroley/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('calendly_open', { location: 'success_state' })}
                  className="inline-block px-5 py-2.5 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
                >
                  Or book a call now
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot — hidden from humans, bots fill it and get silently rejected */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={e => updateForm('website', e.target.value)}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                />
                {error && (
                  <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => updateForm('name', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => updateForm('email', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Project Type
                    </label>
                    <select
                      value={form.project_type}
                      onChange={e => updateForm('project_type', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 focus:outline-none focus:border-candy-500/50 transition-colors"
                    >
                      <option value="">Select one…</option>
                      {PROJECT_TYPES.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Budget Range
                    </label>
                    <select
                      value={form.budget_range}
                      onChange={e => updateForm('budget_range', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 focus:outline-none focus:border-candy-500/50 transition-colors"
                    >
                      <option value="">Select one…</option>
                      {BUDGET_RANGES.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Company / Project
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={e => updateForm('company', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                      placeholder="Acme Inc. / side project"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Timeline
                    </label>
                    <select
                      value={form.timeline}
                      onChange={e => updateForm('timeline', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 focus:outline-none focus:border-candy-500/50 transition-colors"
                    >
                      <option value="">Select one…</option>
                      {TIMELINES.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                    What&apos;s on your mind?
                  </label>
                  <textarea
                    required
                    value={form.message}
                    onChange={e => updateForm('message', e.target.value)}
                    rows={5}
                    className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors resize-none"
                    placeholder="What are you working on? What would be helpful?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-candy-600 hover:bg-candy-500 disabled:bg-forest-700 disabled:text-forest-500 text-white font-medium transition-colors"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>

                <p className="text-center text-forest-600 text-xs">
                  Prefer a call?{' '}
                  <a
                    href="https://calendly.com/brooksroley/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('calendly_open', { location: 'form_footer' })}
                    className="text-candy-500/70 hover:text-candy-400 underline"
                  >
                    Book directly on Calendly
                  </a>
                  {' '}— no form needed.
                </p>
              </form>
            )}
          </section>

        </main>

        {/* ── Mobile sticky CTA — only while the header button is out of view ── */}
        <div
          className={`sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-candy-500/30 bg-forest-950/95 backdrop-blur px-4 py-3 transition-transform duration-300 ${
            showStickyCta ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <a
            href="https://calendly.com/brooksroley/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('cta_click', { location: 'sticky_mobile' })}
            className="block w-full text-center px-4 py-3 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-semibold transition-colors"
          >
            Book a free call &rarr;
          </a>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-forest-800/50 py-8 mt-16">
          <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-forest-600 text-xs">
            <span>Brooks Roley &middot; {new Date().getFullYear()}</span>
            <Link href="/" className="hover:text-forest-400 transition-colors">&larr; brooksroley.com</Link>
          </div>
        </footer>
      </div>
    </>
  )
}
