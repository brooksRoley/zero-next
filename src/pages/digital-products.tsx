import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { getAnonId, getSessionId, track } from 'src/lib/analytics'

/* ── Digital products shelf ──
   Capture-first shell for products that aren't live yet. The "Notify me"
   email capture reuses the Model Arena pattern: POST /api/events with an
   event type that api/events.ts promotes into the email_signups mailing list
   (deduped) and pings the owner via Resend. No live buy button until the
   Gumroad listing exists. */

const PRIMER_CONTENTS = [
  'How to read (and distrust) box-score stats — pace, usage, and why raw points mislead',
  'Building a possession-based model from free, public data sources',
  'Spread prediction vs the Vegas line: what MAE and cover rate actually tell you',
  'The exact pipeline behind the live accuracy scoreboard on this site',
  'Worked examples in Python + SQL you can run on a laptop',
]

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function NotifyCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const valid = EMAIL_RE.test(email.trim())

  const handleSubmit = async () => {
    if (!valid || status === 'submitting') return
    setStatus('submitting')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: getSessionId(),
          anon_id: getAnonId(),
          page: '/digital-products',
          event_type: 'digital_product_notify',
          metadata: { email: email.trim(), product: 'nba_analytics_primer' },
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
        You&apos;re on the list — you&apos;ll get one email when the primer goes
        live, and nothing else.
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 rounded-lg border border-forest-600 bg-forest-900/60 px-4 py-2.5 text-sm text-white placeholder-forest-500 focus:border-candy-500/70 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!valid || status === 'submitting'}
          className="px-5 py-2.5 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-400/90">
          Something went wrong — please try again in a moment.
        </p>
      )}
      <p className="mt-2 text-xs text-forest-500">
        One launch email. No newsletter, no spam.
      </p>
    </div>
  )
}

export default function DigitalProducts() {
  return (
    <>
      <Head>
        <title>Digital Products | Brooks Roley</title>
        <meta
          name="description"
          content="NBA Analytics Primer — a practical guide to building basketball prediction models from public data. $19 on Gumroad, launching soon."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="NBA Analytics Primer — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="A practical guide to building basketball prediction models from public data. Launching soon."
          key="og:description"
        />
        <meta property="og:url" content="https://brooksroley.com/digital-products" key="og:url" />
      </Head>

      <div className="min-h-screen bg-forest-950 text-forest-100">
        <header className="border-b border-forest-800/50 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-forest-400 hover:text-candy-400 transition-colors text-sm">
              &larr; Home
            </Link>
            <Link
              href="/tools/nba-accuracy"
              className="text-sm text-forest-400 hover:text-candy-400 transition-colors"
              onClick={() => track('cta_click', { page: '/digital-products', metadata: { location: 'digital_products_header', target: 'nba_accuracy' } })}
            >
              See the live model scoreboard &rarr;
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-16">
          <section className="mb-12">
            <span className="inline-block rounded-full border border-candy-500/30 bg-candy-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-candy-300">
              Coming soon
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-white">
              NBA Analytics Primer
            </h1>
            <p className="mt-2 text-lg text-forest-300">
              <span className="text-2xl font-bold text-white">$19</span>{' '}
              <span className="text-sm text-forest-400">one-time · PDF · sold via Gumroad</span>
            </p>
            <p className="mt-4 text-forest-300 leading-relaxed">
              A practical, no-fluff guide to building basketball prediction
              models from free public data — written by the engineer behind the
              spread model whose results are published, wins and losses alike,
              on this site&apos;s live accuracy scoreboard.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-4">
              What&apos;s inside
            </h2>
            <ul className="space-y-3">
              {PRIMER_CONTENTS.map(item => (
                <li key={item} className="flex gap-3 text-sm text-forest-200 leading-relaxed">
                  <span className="text-candy-400 mt-0.5">&#9656;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12 rounded-2xl border border-forest-700/50 bg-forest-900/60 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">
              Get one email when it launches
            </h2>
            <p className="text-sm text-forest-300 mb-5 leading-relaxed">
              The primer is being written now. Leave your email and you&apos;ll
              hear about it the day it ships — early subscribers get the launch
              price.
            </p>
            <NotifyCapture />
          </section>

          <section className="text-sm text-forest-400 leading-relaxed">
            <p>
              Want the methodology before the book? The model&apos;s
              against-the-spread record updates as games settle at{' '}
              <Link href="/tools/nba-accuracy" className="text-candy-300 hover:text-candy-200 transition-colors">
                /tools/nba-accuracy
              </Link>
              , and the tooling lives in the{' '}
              <Link href="/basketball-platform" className="text-candy-300 hover:text-candy-200 transition-colors">
                Basketball Data Platform
              </Link>{' '}
              case study.
            </p>
          </section>
        </main>
      </div>
    </>
  )
}
