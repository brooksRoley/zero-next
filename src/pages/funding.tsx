import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// Private payments demo (gated by src/proxy.ts). This used to be a public tip
// jar whose buttons never went live, so visitors saw "Card tips aren't live
// yet". It is now a working example of Stripe Checkout in test mode: config
// status, a real Checkout Session per item, and the latest sessions with the
// webhook's record beside them. Backed by /api/admin/payments.

type Config = {
  mode: 'test' | 'live' | 'missing'
  webhook_secret: boolean
  saved_prices: Record<string, boolean>
}

type Session = {
  id: string
  created: number
  amount_total: number | null
  currency: string | null
  item: string | null
  status: string | null
  payment_status: string
  recorded_status: string | null
}

const ITEMS: { id: string; amount: number; label: string }[] = [
  { id: 'tip_5', amount: 5, label: 'Tip · coffee' },
  { id: 'tip_10', amount: 10, label: 'Tip · snack' },
  { id: 'tip_25', amount: 25, label: 'Tip · server bill' },
  { id: 'strategy_session', amount: 150, label: 'Strategy session' },
]

const MODE_TEXT: Record<Config['mode'], string> = {
  test: 'Test keys — no real card is charged',
  live: 'Live keys — the demo is disabled',
  missing: 'STRIPE_SECRET_KEY is not set',
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={ok ? 'text-emerald-400' : 'text-forest-500'}>
        {ok ? '●' : '○'}
      </span>
      <span className={ok ? 'text-forest-100' : 'text-forest-400'}>{label}</span>
      <span className="sr-only">{ok ? '(set)' : '(not set)'}</span>
    </li>
  )
}

const money = (cents: number | null, currency: string | null) =>
  cents == null ? '—' : `$${(cents / 100).toFixed(2)}${currency && currency !== 'usd' ? ` ${currency.toUpperCase()}` : ''}`

export default function Funding() {
  const router = useRouter()
  const [config, setConfig] = useState<Config | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/payments')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setConfig(data.config)
      setSessions(data.sessions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const checkout = async (item: string) => {
    setPending(item)
    setError('')
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'No checkout URL returned')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setPending(null)
    }
  }

  const returned = router.query.session
  const canCharge = config?.mode === 'test'

  return (
    <main className="min-h-screen bg-forest-950 text-white px-4 sm:px-8 py-10 font-sans">
      <Head>
        <title>Payments demo | Brooks Roley</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold">Payments demo</h1>
          <p className="mt-1 text-sm text-forest-300">
            Stripe Checkout end to end: pick an item, pay with test card{' '}
            <span className="font-mono text-forest-100">4242 4242 4242 4242</span> (any future
            date, any CVC), and watch the session land below.
          </p>
        </header>

        {returned === 'success' && (
          <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Payment completed. The row below reads <em>paid</em> once the webhook arrives — refresh in a few seconds.
          </p>
        )}
        {returned === 'cancelled' && (
          <p role="status" className="rounded-xl border border-forest-700 bg-forest-900/60 px-4 py-3 text-sm text-forest-300">
            Checkout cancelled. Nothing was charged.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <section aria-labelledby="config-heading" className="rounded-2xl border border-forest-800 bg-forest-900/40 p-5">
          <h2 id="config-heading" className="text-sm font-semibold uppercase tracking-widest text-forest-400">
            Configuration
          </h2>
          {config ? (
            <ul className="mt-3 space-y-1.5">
              <Check ok={config.mode === 'test'} label={MODE_TEXT[config.mode]} />
              <Check ok={config.webhook_secret} label="Webhook secret (marks sessions paid)" />
              {Object.entries(config.saved_prices).map(([name, ok]) => (
                <Check key={name} ok={ok} label={`Saved Price ID · ${name.replace(/_/g, ' ')}`} />
              ))}
            </ul>
          ) : (
            !error && <p className="mt-3 text-sm text-forest-400">Loading…</p>
          )}
        </section>

        <section aria-labelledby="charge-heading">
          <h2 id="charge-heading" className="text-sm font-semibold uppercase tracking-widest text-forest-400">
            Start a checkout
          </h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ITEMS.map(({ id, amount, label }) => (
              <button
                key={id}
                onClick={() => checkout(id)}
                disabled={!canCharge || pending !== null}
                className="flex flex-col items-center gap-1 rounded-xl border border-forest-700/60 bg-forest-900/60 px-3 py-4 transition-colors hover:border-[#635BFF]/60 hover:bg-forest-900 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950"
              >
                <span className="text-lg font-semibold">${amount}</span>
                <span className="text-[10px] uppercase tracking-widest text-forest-400">
                  {pending === id ? 'Opening…' : label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-forest-500">
            Payment methods shown at checkout are the ones enabled in the Stripe Dashboard.
          </p>
        </section>

        <section aria-labelledby="sessions-heading">
          <div className="flex items-center justify-between">
            <h2 id="sessions-heading" className="text-sm font-semibold uppercase tracking-widest text-forest-400">
              Latest sessions
            </h2>
            <button
              onClick={load}
              className="text-xs text-forest-300 hover:text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] rounded"
            >
              Refresh
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-forest-400">No sessions yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-forest-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Stripe</th>
                    <th className="py-2 font-medium">Our record</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-forest-800">
                      <td className="py-2 pr-3 text-forest-300 whitespace-nowrap">
                        {new Date(s.created * 1000).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">{s.item ?? '—'}</td>
                      <td className="py-2 pr-3 font-mono">{money(s.amount_total, s.currency)}</td>
                      <td className="py-2 pr-3">{s.payment_status}</td>
                      <td className="py-2 text-forest-300">{s.recorded_status ?? 'not recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
