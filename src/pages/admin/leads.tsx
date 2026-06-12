import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { LeadsSummary } from 'src/pages/api/admin/leads'

function pctDelta(curr: number, prev: number): { label: string; tone: 'up' | 'down' | 'flat' } {
  if (prev === 0 && curr === 0) return { label: 'no change', tone: 'flat' }
  if (prev === 0) return { label: `+${curr} from 0`, tone: 'up' }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { label: 'flat', tone: 'flat' }
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : 'down' }
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-forest-800/60 bg-forest-900/40 p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-forest-500 mb-2">
        {label}
      </div>
      <div className="text-3xl font-semibold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-forest-400">{sub}</div>}
    </div>
  )
}

export default function AdminLeads() {
  const [data, setData] = useState<LeadsSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/leads')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<LeadsSummary>
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setLoading(false)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message || 'Failed to load')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const delta = data ? pctDelta(data.last_7d, data.prior_7d) : null
  const maxSourceCount = data?.by_source.reduce((m, r) => Math.max(m, r.count), 0) ?? 0
  const budgetTotal = data ? data.budget_set + data.budget_unset : 0
  const budgetPct = budgetTotal > 0 ? Math.round((data!.budget_set / budgetTotal) * 100) : 0

  return (
    <>
      <Head>
        <title>Leads | Admin</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-forest-950 text-forest-100">
        <header className="border-b border-forest-800/50 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-forest-400 hover:text-candy-400 transition-colors text-sm"
              >
                &larr; Home
              </Link>
              <span className="text-forest-700">/</span>
              <span className="text-forest-300 text-sm font-mono">admin/leads</span>
            </div>
            <span className="text-xs text-forest-600">private</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12">
          <section className="mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Leads summary</h1>
            <p className="text-forest-400 text-sm">
              Is consulting attribution producing signal? Check the source mix and the 7-day trend.
            </p>
          </section>

          {loading && (
            <div className="rounded-xl border border-forest-800/60 bg-forest-900/30 p-8 text-center text-forest-500 text-sm">
              Loading…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-5 text-red-300 text-sm">
              Couldn&apos;t load summary: {error}
            </div>
          )}

          {data && !loading && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard label="Total leads" value={data.total} sub="all-time" />
                <StatCard
                  label="Last 7 days"
                  value={data.last_7d}
                  sub={
                    delta && (
                      <span
                        className={
                          delta.tone === 'up'
                            ? 'text-green-400'
                            : delta.tone === 'down'
                              ? 'text-red-400'
                              : 'text-forest-500'
                        }
                      >
                        {delta.label} vs. prior 7d ({data.prior_7d})
                      </span>
                    )
                  }
                />
                <StatCard
                  label="Budget set"
                  value={`${data.budget_set}/${budgetTotal}`}
                  sub={`${budgetPct}% of leads include a budget`}
                />
              </section>

              <section className="rounded-xl border border-forest-800/60 bg-forest-900/40 p-5 mb-8">
                <div className="text-xs font-mono uppercase tracking-widest text-forest-500 mb-4">
                  Top sources
                </div>
                {data.by_source.length === 0 ? (
                  <p className="text-forest-500 text-sm">No leads yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.by_source.map((row) => {
                      const width = maxSourceCount > 0 ? (row.count / maxSourceCount) * 100 : 0
                      const label = row.source || '(none)'
                      const share = data.total > 0 ? Math.round((row.count / data.total) * 100) : 0
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-forest-200 font-mono">{label}</span>
                            <span className="text-forest-500 tabular-nums">
                              {row.count} <span className="text-forest-700">·</span> {share}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-forest-950/60 overflow-hidden">
                            <div
                              className="h-full bg-candy-600/70 rounded-full"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="text-xs text-forest-600 leading-relaxed">
                <p>
                  <span className="font-mono">source</span> is the column the lead form writes (UTM
                  or referrer). New leads default to <span className="font-mono">consulting_page</span>.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  )
}
