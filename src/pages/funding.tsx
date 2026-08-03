import { useState } from 'react'
import Head from 'next/head'
import { getAnonId, getSessionId, track } from 'src/lib/analytics'

// Stripe Payment Links — create these in the Stripe Dashboard
// (Payments → Payment Links → + New) and paste the live URLs below.
// Each link is a hosted, card-accepting checkout: no server code required.
// Until then these placeholders point at a Stripe 404 so the flow is obvious in dev.
const PAYMENT_LINK_PLACEHOLDER = 'https://buy.stripe.com/test_REPLACE_ME'

const QUICK_TIPS: { amount: number; label: string; href: string }[] = [
  { amount: 5, label: 'Buy a coffee', href: PAYMENT_LINK_PLACEHOLDER },
  { amount: 10, label: 'Send a snack', href: PAYMENT_LINK_PLACEHOLDER },
  { amount: 25, label: 'Cover a server bill', href: PAYMENT_LINK_PLACEHOLDER },
]

// A Payment Link with "Let customers choose what they pay" enabled.
const CUSTOM_TIP_LINK = PAYMENT_LINK_PLACEHOLDER

// Placeholder links 404 on Stripe. Render those buttons disabled ("Coming
// soon") instead of dead — they re-enable automatically once real Payment
// Link URLs replace the placeholders above.
const isPlaceholder = (href: string) => href.includes('REPLACE_ME')

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// While card tips are disabled, don't strand someone who wanted to help. Reuse
// the /api/events email-capture pattern (see digital-products.tsx) so the visit
// becomes a retargetable signup instead of a dead end. Posts a funding_notify
// event, which api/events.ts promotes into the email_signups mailing list.
function TipWhenLiveCapture() {
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
          page: '/funding',
          event_type: 'funding_notify',
          metadata: { email: email.trim(), product: 'funding_tip' },
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      track('cta_click', { metadata: { location: 'funding_notify' } })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
        Thank you — I&apos;ll email you once card tips are live, and nothing else.
      </div>
    )
  }

  return (
    <div className="text-left">
      <p className="mb-2 text-xs text-forest-400">
        Card tips aren&apos;t live yet. Leave your email and I&apos;ll ping you the
        moment they are — no newsletter, no spam.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 rounded-lg border border-forest-600 bg-forest-900/60 px-4 py-2.5 text-sm text-white placeholder-forest-500 focus:border-[#635BFF]/70 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!valid || status === 'submitting'}
          className="px-5 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#4F46E5] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-400/90">
          Something went wrong — please try again in a moment.
        </p>
      )}
    </div>
  )
}

export default function Funding() {
  const tipsLive = !isPlaceholder(CUSTOM_TIP_LINK)
  return (
    <main className="min-h-screen bg-forest-950 flex items-center justify-center px-4 py-16 font-sans">
      <Head>
        <title>Support Brooks Roley</title>
        <meta name="description" content="Support Brooks Roley — tip by card if you enjoyed the games or tools." />
      </Head>

      <div className="max-w-md w-full text-center space-y-7">
        <h1 className="text-2xl font-semibold text-white">Thanks for playing.</h1>

        <p className="text-forest-300 text-sm leading-relaxed">
          Tips keep the hosting bills paid, the AI tokens flowing, and the next
          game in the oven. No pressure — but it means a lot.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {QUICK_TIPS.map(({ amount, label, href }) =>
            isPlaceholder(href) ? (
              <div
                key={amount}
                aria-disabled="true"
                title="Card tips are coming soon"
                className="flex flex-col items-center gap-1 rounded-xl border border-forest-800/40 bg-forest-900/30 px-3 py-4 cursor-not-allowed opacity-60"
              >
                <span className="text-lg font-semibold text-forest-400">${amount}</span>
                <span className="text-[10px] uppercase tracking-widest text-forest-500">
                  Coming soon
                </span>
              </div>
            ) : (
              <a
                key={amount}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('cta_click', { metadata: { location: 'funding_tip', amount } })}
                className="group flex flex-col items-center gap-1 rounded-xl border border-forest-700/40 bg-forest-900/60 px-3 py-4 transition-colors hover:border-[#635BFF]/60 hover:bg-forest-900"
              >
                <span className="text-lg font-semibold text-white">${amount}</span>
                <span className="text-[10px] uppercase tracking-widest text-forest-400 group-hover:text-[#635BFF]">
                  {label}
                </span>
              </a>
            )
          )}
        </div>

        {isPlaceholder(CUSTOM_TIP_LINK) ? (
          <span
            aria-disabled="true"
            title="Card tips are coming soon"
            className="inline-block px-6 py-3 rounded-xl bg-forest-800/60 text-forest-400 font-medium text-sm cursor-not-allowed"
          >
            Custom tips coming soon
          </span>
        ) : (
          <a
            href={CUSTOM_TIP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('cta_click', { metadata: { location: 'funding_tip', amount: 'custom' } })}
            className="inline-block px-6 py-3 rounded-xl bg-[#635BFF] hover:bg-[#4F46E5] text-white font-medium text-sm transition-colors duration-200"
          >
            Tip a custom amount
          </a>
        )}

        <p className="text-forest-600 text-xs">
          {tipsLive
            ? 'Secure card payment via Stripe'
            : 'Card payments via Stripe are being set up.'}
        </p>

        {!tipsLive && (
          <div className="pt-2 border-t border-forest-800/40">
            <TipWhenLiveCapture />
          </div>
        )}
      </div>
    </main>
  )
}
