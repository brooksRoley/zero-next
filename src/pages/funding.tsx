import Head from 'next/head'

export default function Funding() {
  return (
    <main className="min-h-screen bg-forest-950 flex items-center justify-center px-4 font-sans">
      <Head>
        <title>Support Brooks Roley</title>
        <meta name="description" content="Support Brooks Roley — tip via Venmo if you enjoyed the games or tools." />
      </Head>

      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="text-2xl font-semibold text-white">Thanks for playing.</h1>
        <p className="text-forest-300 text-sm leading-relaxed">
          If you enjoyed the games or tools, a tip is always appreciated — no pressure.
        </p>
        <a
          href="https://venmo.com/Brooks-Roley"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 rounded-xl bg-[#008CFF] hover:bg-[#0070CC] text-white font-medium text-sm transition-colors duration-200"
        >
          Tip on Venmo
        </a>
        <p className="text-forest-600 text-xs">@Brooks-Roley</p>
      </div>
    </main>
  )
}
