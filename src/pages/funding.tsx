import Head from 'next/head'
import { track } from 'src/lib/analytics'

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

export default function Funding() {
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
          {isPlaceholder(CUSTOM_TIP_LINK)
            ? 'Card payments via Stripe are being set up — check back soon.'
            : 'Secure card payment via Stripe'}
        </p>
      </div>
    </main>
  )
}
