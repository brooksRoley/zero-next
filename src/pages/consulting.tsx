import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

/* ── Service tiers ── */
const SERVICES = [
  {
    id: 'strategy',
    name: 'Strategy Session',
    price: '$150',
    unit: '/ hour',
    deposit: 15000, // cents
    description: 'One-on-one technical strategy call. Architecture reviews, tech stack decisions, data pipeline design.',
    includes: ['60-min video call', 'Follow-up summary doc', 'Action items & recommendations'],
    best_for: 'Teams needing a second opinion on architecture or hiring decisions',
  },
  {
    id: 'sprint',
    name: 'Dev Sprint',
    price: '$2,400',
    unit: '/ week',
    deposit: 120000,
    description: 'Embedded full-stack engineering for a focused sprint. Ship features, fix bottlenecks, unblock your team.',
    includes: ['40 hrs / week dedicated', 'Daily async standups', 'PR reviews & pair programming', 'Knowledge transfer'],
    best_for: 'Startups that need senior velocity without a full-time hire',
  },
  {
    id: 'fractional',
    name: 'Fractional CTO',
    price: '$4,000',
    unit: '/ month',
    deposit: 200000,
    description: 'Ongoing technical leadership. Roadmap planning, team mentoring, vendor evaluation, and hands-on coding.',
    includes: ['10 hrs / week', 'Architecture & roadmap ownership', 'Hiring & team coaching', 'Stakeholder communication'],
    best_for: 'Early-stage companies that need a technical co-founder mindset',
  },
]

const PROJECT_TYPES = [
  'Strategy Session',
  'Dev Sprint',
  'Fractional CTO',
  'Custom Project',
  'Other',
]

const BUDGET_RANGES = [
  'Under $1,000',
  '$1,000 – $5,000',
  '$5,000 – $15,000',
  '$15,000 – $50,000',
  '$50,000+',
]

const SKILLS = [
  'React & Next.js', 'TypeScript', 'Node.js', 'PostgreSQL',
  'SwiftUI / iOS', 'Sports & NBA Analytics', 'Data Pipelines',
  'AWS & Serverless', 'Vue 3', 'FastAPI / Python', 'System Design',
]

export default function Consulting() {
  const router = useRouter()
  const [activeService, setActiveService] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    project_type: '',
    budget_range: '',
    timeline: '',
    message: '',
  })

  useEffect(() => {
    if (router.query.session === 'success') setSessionStatus('success')
    if (router.query.session === 'cancelled') setSessionStatus('cancelled')
  }, [router.query])

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
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  const handleCheckout = async (service: typeof SERVICES[0]) => {
    setError('')
    const res = await fetch('/api/consulting/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_type: service.id,
        amount_cents: service.deposit,
        customer_email: form.email || undefined,
      }),
    })

    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.error || 'Could not create checkout session')
    }
  }

  return (
    <>
      <Head>
        <title>Consulting | Brooks Roley</title>
        <meta name="description" content="Senior full-stack engineering consulting — React, TypeScript, Node.js, sports tech, NBA analytics. Book a strategy session or hire for a dev sprint." />
        <meta property="og:title" content="Consulting — Brooks Roley" />
        <meta property="og:description" content="Full-stack engineering, sports tech, and data strategy consulting." />
      </Head>

      <div className="min-h-screen bg-forest-950 text-forest-100">
        {/* ── Nav ── */}
        <header className="border-b border-forest-800/50 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-forest-400 hover:text-candy-400 transition-colors text-sm">
              &larr; Home
            </Link>
            <a
              href="https://calendly.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
            >
              Book a Call
            </a>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-12">

          {/* Stripe session feedback */}
          {sessionStatus === 'success' && (
            <div className="mb-8 bg-green-900/30 border border-green-700/50 text-green-300 px-5 py-4 rounded-xl text-sm">
              Payment received — thank you! I&apos;ll be in touch within 24 hours to get things rolling.
            </div>
          )}
          {sessionStatus === 'cancelled' && (
            <div className="mb-8 bg-yellow-900/20 border border-yellow-700/40 text-yellow-300 px-5 py-4 rounded-xl text-sm">
              Checkout was cancelled. No worries — you can start a conversation below or book a free intro call.
            </div>
          )}

          {/* ── Hero ── */}
          <section className="mb-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Let&apos;s Build Something Together
            </h1>
            <p className="text-forest-300 text-lg max-w-2xl mx-auto leading-relaxed">
              Senior full-stack engineer specializing in React, TypeScript, sports tech, and data-driven applications.
              Available for strategy calls, dev sprints, and fractional CTO engagements.
            </p>
          </section>

          {/* ── Skills ── */}
          <section className="mb-16">
            <div className="flex flex-wrap justify-center gap-2">
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

          {/* ── Service Tiers ── */}
          <section className="mb-16">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-6 text-center">
              Services
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {SERVICES.map(service => {
                const isActive = activeService === service.id
                return (
                  <div
                    key={service.id}
                    className={`rounded-xl border p-6 transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'border-candy-500/60 bg-candy-500/5 shadow-lg shadow-candy-900/20'
                        : 'border-forest-800/50 bg-forest-900/30 hover:border-forest-700/60'
                    }`}
                    onClick={() => setActiveService(isActive ? null : service.id)}
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white">{service.name}</h3>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-candy-400">{service.price}</span>
                        <span className="text-forest-500 text-sm">{service.unit}</span>
                      </div>
                    </div>

                    <p className="text-sm text-forest-300 mb-4 leading-relaxed">{service.description}</p>

                    <ul className="space-y-2 mb-4">
                      {service.includes.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-forest-400">
                          <span className="text-candy-500 mt-0.5">&#10003;</span>
                          {item}
                        </li>
                      ))}
                    </ul>

                    <p className="text-[10px] uppercase tracking-widest text-forest-600 mb-3">
                      Best for: {service.best_for}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCheckout(service)
                        }}
                        className="flex-1 py-2.5 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
                      >
                        Pay Deposit
                      </button>
                      <a
                        href="https://calendly.com/brooksroley/"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 py-2.5 rounded-lg bg-forest-800/60 hover:bg-forest-700/60 text-forest-200 text-sm font-medium transition-colors text-center border border-forest-700/40"
                      >
                        Free Intro Call
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Contact Form ── */}
          <section className="mb-16" id="contact">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-6 text-center">
                Start a Conversation
              </h2>

              {submitted ? (
                <div className="text-center py-12 px-6 rounded-xl border border-forest-800/50 bg-forest-900/30">
                  <div className="text-3xl mb-3">&#9993;</div>
                  <h3 className="text-lg font-bold text-white mb-2">Message Received</h3>
                  <p className="text-forest-400 text-sm mb-4">
                    Thanks for reaching out, {form.name.split(' ')[0]}. I&apos;ll respond within 24 hours.
                  </p>
                  <a
                    href="https://calendly.com/brooksroley/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-5 py-2.5 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
                  >
                    Or skip ahead — book a call now
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
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
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Company
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={e => updateForm('company', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                      placeholder="Company or project name"
                    />
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
                        <option value="">Select...</option>
                        {PROJECT_TYPES.map(pt => (
                          <option key={pt} value={pt}>{pt}</option>
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
                        <option value="">Select...</option>
                        {BUDGET_RANGES.map(br => (
                          <option key={br} value={br}>{br}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Timeline
                    </label>
                    <input
                      type="text"
                      value={form.timeline}
                      onChange={e => updateForm('timeline', e.target.value)}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                      placeholder='e.g. "Need someone by end of April" or "Ongoing"'
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                      Tell me about the project
                    </label>
                    <textarea
                      value={form.message}
                      onChange={e => updateForm('message', e.target.value)}
                      rows={4}
                      className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors resize-none"
                      placeholder="What are you building? What problems are you facing? What does success look like?"
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
                    Or go straight to{' '}
                    <a
                      href="https://calendly.com/brooksroley/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-candy-500/70 hover:text-candy-400 underline"
                    >
                      booking a call
                    </a>
                    {' '}— no form needed.
                  </p>
                </form>
              )}
            </div>
          </section>

          {/* ── Social Proof / Credibility ── */}
          <section className="mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-forest-800/50 bg-forest-900/20 p-6">
                <p className="text-2xl font-bold text-candy-400">6+</p>
                <p className="text-xs text-forest-500 mt-1 uppercase tracking-widest">Years Professional Experience</p>
              </div>
              <div className="rounded-xl border border-forest-800/50 bg-forest-900/20 p-6">
                <p className="text-2xl font-bold text-candy-400">Full Stack</p>
                <p className="text-xs text-forest-500 mt-1 uppercase tracking-widest">Frontend-Leaning Engineer</p>
              </div>
              <div className="rounded-xl border border-forest-800/50 bg-forest-900/20 p-6">
                <p className="text-2xl font-bold text-candy-400">Sports Tech</p>
                <p className="text-xs text-forest-500 mt-1 uppercase tracking-widest">NBA Data & Analytics Focus</p>
              </div>
            </div>
          </section>

        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-forest-800/50 py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-forest-600 text-xs">
            <span>Zero Paradox LLC &middot; {new Date().getFullYear()}</span>
            <div className="flex gap-4">
              <Link href="/" className="hover:text-forest-400 transition-colors">&larr; brooksroley.com</Link>
              <Link href="/zero-paradox" className="hover:text-forest-400 transition-colors">Zero Paradox</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
