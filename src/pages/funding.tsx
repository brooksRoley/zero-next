import Head from 'next/head'

const QUICK_TIPS: { amount: number; note: string; label: string }[] = [
  { amount: 5, note: 'Coffee for Brooks', label: 'Buy a coffee' },
  { amount: 10, note: 'Snack support', label: 'Send a snack' },
  { amount: 25, note: 'Hosting + tools', label: 'Cover a server bill' },
]

const venmoLink = (amount: number, note: string) =>
  `https://venmo.com/Brooks-Roley?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`

export default function Funding() {
  return (
    <main className="min-h-screen bg-forest-950 flex items-center justify-center px-4 py-16 font-sans">
      <Head>
        <title>Support Brooks Roley</title>
        <meta name="description" content="Support Brooks Roley — tip via Venmo if you enjoyed the games or tools." />
      </Head>

      <div className="max-w-md w-full text-center space-y-7">
        <h1 className="text-2xl font-semibold text-white">Thanks for playing.</h1>

        <p className="text-forest-300 text-sm leading-relaxed">
          Tips keep the hosting bills paid, the AI tokens flowing, and the next
          game in the oven. No pressure — but it means a lot.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {QUICK_TIPS.map(({ amount, note, label }) => (
            <a
              key={amount}
              href={venmoLink(amount, note)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1 rounded-xl border border-forest-700/40 bg-forest-900/60 px-3 py-4 transition-colors hover:border-[#008CFF]/60 hover:bg-forest-900"
            >
              <span className="text-lg font-semibold text-white">${amount}</span>
              <span className="text-[10px] uppercase tracking-widest text-forest-400 group-hover:text-[#008CFF]">
                {label}
              </span>
            </a>
          ))}
        </div>

        <a
          href="https://venmo.com/Brooks-Roley"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 rounded-xl bg-[#008CFF] hover:bg-[#0070CC] text-white font-medium text-sm transition-colors duration-200"
        >
          Tip a custom amount
        </a>

        <p className="text-forest-600 text-xs">@Brooks-Roley</p>
      </div>
    </main>
  )
}
