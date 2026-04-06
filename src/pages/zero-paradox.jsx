import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import PreText from 'src/components/PreText'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100]

const MISSIONS = [
  {
    icon: '🎮',
    title: 'Game Development',
    desc: 'Pente, Nanu & Pika TD, Basketball Tactics — building games grounded in Theory of Fun.',
  },
  {
    icon: '🏥',
    title: 'CenterPointe for Children',
    desc: 'Nonprofit web infrastructure, donor tooling, and tech support for children\'s programming.',
  },
  {
    icon: '🛠',
    title: 'Open Source Tools',
    desc: 'pdf-to-audio, NBA analytics utilities, developer tools — free and open.',
  },
  {
    icon: '📐',
    title: 'Research & Education',
    desc: 'Game Design Theory of Fun, AWS GenAI curriculum, NBA data strategy.',
  },
]

// ── Payment method config ─────────────────────────────────────────────────────
function buildPaymentUrl(method, amount) {
  const stripe = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK
  const paypal = process.env.NEXT_PUBLIC_PAYPAL_ME
  const venmo  = process.env.NEXT_PUBLIC_VENMO_HANDLE

  switch (method) {
    case 'stripe':
      return stripe && !stripe.includes('REPLACE') ? stripe : null
    case 'paypal':
      return paypal && !paypal.includes('REPLACE')
        ? `https://paypal.me/${paypal}/${amount}`
        : null
    case 'venmo':
      return venmo && !venmo.includes('REPLACE')
        ? `https://venmo.com/${venmo}?txn=pay&note=Zero+Paradox+LLC&amount=${amount}`
        : null
    default:
      return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function AmountSelector({ amount, setAmount, customAmount, setCustomAmount }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_AMOUNTS.map((preset) => (
        <button
          key={preset}
          onClick={() => { setAmount(preset); setCustomAmount('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
            amount === preset && !customAmount
              ? 'bg-void-600 border-void-400 text-white shadow-lg shadow-void-900/40'
              : 'bg-white/5 border-white/10 text-white/70 hover:border-void-500/50 hover:text-white'
          }`}
        >
          ${preset}
        </button>
      ))}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
        <input
          type="number"
          min="1"
          placeholder="Other"
          value={customAmount}
          onChange={(e) => {
            setCustomAmount(e.target.value)
            if (e.target.value) setAmount(Number(e.target.value))
          }}
          className="w-24 pl-7 pr-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-void-500/60 focus:bg-white/8 transition-colors"
        />
      </div>
    </div>
  )
}

function PaymentButton({ method, label, icon, description, url, accent }) {
  const configured = !!url

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 ${
      configured
        ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
        : 'bg-white/[0.02] border-white/5 opacity-60'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-white font-semibold text-sm">{label}</p>
          <p className="text-white/40 text-xs">{description}</p>
        </div>
      </div>

      {configured ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{ background: accent, color: '#fff' }}
        >
          Pay with {label}
          <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ) : (
        <div className="flex items-center justify-center w-full py-2.5 rounded-lg text-sm text-white/30 bg-white/5 border border-white/5">
          Configure in .env.local
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ZeroParadox() {
  const [amount, setAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState('')

  const activeAmount = customAmount ? Number(customAmount) : amount

  const paymentMethods = [
    {
      method: 'stripe',
      label: 'Stripe',
      icon: '⚡',
      description: 'Card · Apple Pay · Google Pay',
      accent: '#635BFF',
      url: buildPaymentUrl('stripe', activeAmount),
    },
    {
      method: 'paypal',
      label: 'PayPal',
      icon: '🅿',
      description: 'PayPal balance or card',
      accent: '#0070E0',
      url: buildPaymentUrl('paypal', activeAmount),
    },
    {
      method: 'venmo',
      label: 'Venmo',
      icon: '💙',
      description: 'Venmo balance · US only',
      accent: '#3D95CE',
      url: buildPaymentUrl('venmo', activeAmount),
    },
  ]

  return (
    <>
      <Head>
        <title>Zero Paradox LLC</title>
        <meta name="description" content="Support games, tools, and technology built at the edge of what's possible." />
        <meta property="og:title" content="Zero Paradox LLC" />
        <meta property="og:description" content="Support games, tools, and technology built at the edge of what's possible." />
        <meta property="og:image" content="/cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-[#0a0814]">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Background glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(124,58,237,0.18),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(99,91,255,0.12),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(167,139,250,0.04),transparent_70%)]" />
          </div>

          <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
            {/* ZP Monogram */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-void-900/60 border border-void-700/40 shadow-lg shadow-void-900/40 mb-8">
              <span className="text-2xl font-black text-void-300 tracking-tighter select-none">ZP</span>
            </div>

            {/* Headline */}
            <div className="flex justify-center mb-4">
              <PreText
                text="Zero Paradox LLC"
                mode="flow"
                color="#a78bfa"
                accentColor="#c4b5fd"
                tag="h1"
                fontSize="clamp(2rem, 6vw, 3.5rem)"
                fontWeight="800"
              />
            </div>

            <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-8">
              Building games, tools, and systems at the intersection of technology and human experience.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="#support"
                className="px-6 py-2.5 rounded-xl bg-void-700 hover:bg-void-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-void-900/50"
              >
                Support the Work ↓
              </a>
              <a
                href="https://calendly.com/brooksroley/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-semibold transition-colors"
              >
                Book Consulting →
              </a>
            </div>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-6 pb-20 space-y-16">

          {/* ── Support / Payment ──────────────────────────────────────────── */}
          <section id="support" className="scroll-mt-8">
            <div className="rounded-2xl border border-void-800/60 bg-void-950/60 p-6 sm:p-8 shadow-xl">
              <div className="mb-6">
                <PreText
                  text="Support the Work"
                  mode="pulse"
                  color="#a78bfa"
                  fontSize="1.25rem"
                  fontWeight="700"
                  tag="h2"
                />
                <p className="text-white/40 text-sm mt-2">
                  Choose an amount and your preferred payment method. Every contribution goes directly to the projects below.
                </p>
              </div>

              {/* Amount selector */}
              <div className="mb-6">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Amount</p>
                <AmountSelector
                  amount={amount}
                  setAmount={setAmount}
                  customAmount={customAmount}
                  setCustomAmount={setCustomAmount}
                />
              </div>

              {/* Divider with selected amount */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-void-400 text-sm font-mono">
                  ${activeAmount > 0 ? activeAmount : '—'}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Payment method cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {paymentMethods.map((pm) => (
                  <PaymentButton key={pm.method} {...pm} />
                ))}
              </div>

              <p className="text-white/20 text-xs text-center mt-4">
                Payments processed securely by each provider. Zero Paradox LLC does not store card data.
              </p>
            </div>
          </section>

          {/* ── Consulting CTA ────────────────────────────────────────────── */}
          <section>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <PreText
                    text="Consulting"
                    mode="flow"
                    color="#c4b5fd"
                    fontSize="1.125rem"
                    fontWeight="700"
                    tag="h2"
                  />
                  <p className="text-white/50 text-sm mt-2 leading-relaxed">
                    Senior full-stack engineering · Sports tech & NBA data strategy · React, TypeScript, Node.js, SwiftUI · Available for contract and fractional engagements.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end shrink-0">
                  <div className="text-right">
                    <p className="text-void-300 text-xl font-bold">$150 <span className="text-white/30 text-sm font-normal">/ hr</span></p>
                    <p className="text-white/30 text-xs">Project rates available</p>
                  </div>
                  <a
                    href="https://calendly.com/brooksroley/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-void-700 hover:bg-void-600 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    Schedule a Call →
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ── Mission ───────────────────────────────────────────────────── */}
          <section>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-void-500 mb-1">What you&apos;re funding</p>
              <PreText
                text="The Mission"
                mode="flow"
                color="#8b5cf6"
                fontSize="1.5rem"
                fontWeight="700"
                tag="h2"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MISSIONS.map((m) => (
                <div
                  key={m.title}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-5 hover:border-void-700/40 hover:bg-white/[0.05] transition-all duration-200"
                >
                  <span className="text-2xl block mb-2">{m.icon}</span>
                  <h3 className="text-white font-semibold text-sm mb-1">{m.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-8">
          <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/20 text-xs">
            <span>Zero Paradox LLC · {new Date().getFullYear()}</span>
            <Link href="/" className="hover:text-white/50 transition-colors">← Back to brooksroley.com</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
