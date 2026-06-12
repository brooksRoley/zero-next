import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'src/lib/db'

export type LeadsSummary = {
  total: number
  by_source: { source: string | null; count: number }[]
  budget_set: number
  budget_unset: number
  last_7d: number
  prior_7d: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const totalsRows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE budget_range IS NOT NULL AND budget_range <> '')::int AS budget_set,
      COUNT(*) FILTER (WHERE budget_range IS NULL OR budget_range = '')::int AS budget_unset,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at <  NOW() - INTERVAL '7 days'
      )::int AS prior_7d
    FROM leads
  `) as Array<{
    total: number
    budget_set: number
    budget_unset: number
    last_7d: number
    prior_7d: number
  }>

  const t = totalsRows[0]

  const bySourceRows = (await sql`
    SELECT source, COUNT(*)::int AS count
    FROM leads
    GROUP BY source
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `) as Array<{ source: string | null; count: number }>

  const payload: LeadsSummary = {
    total: t.total,
    budget_set: t.budget_set,
    budget_unset: t.budget_unset,
    last_7d: t.last_7d,
    prior_7d: t.prior_7d,
    by_source: bySourceRows,
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(payload)
}
