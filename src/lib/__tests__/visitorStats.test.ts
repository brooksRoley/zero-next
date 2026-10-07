import { describe, it, expect } from 'vitest'
import { readVisitorStats } from 'src/lib/visitorStats'

// A stand-in for the tagged-template `sql`: answers each query by a phrase
// that only that query contains.
function fakeSql(answers: Array<[needle: string, rows: unknown[]]>, failOn: string[] = []) {
  return async (strings: TemplateStringsArray) => {
    const text = strings.join('')
    if (failOn.some((needle) => text.includes(needle))) throw new Error('relation does not exist')
    const hit = answers.find(([needle]) => text.includes(needle))
    return hit ? hit[1] : []
  }
}

describe('readVisitorStats', () => {
  it('returns an all-zero report, not an error, when every query fails', async () => {
    const stats = await readVisitorStats(async () => {
      throw new Error('database unreachable')
    })
    expect(stats.summary).toEqual({ visitors: 0, sessions: 0, page_views: 0, new_visitors: 0 })
    expect(stats.hiring.pdf_downloads).toBe(0)
    expect(stats.recentSessions).toEqual([])
    expect(stats.scorecard.map((row) => row.label)).toEqual([
      'Visitors', 'Sessions', 'Resume views', 'Game sessions', 'Leads', 'Email signups',
    ])
    expect(stats.scorecard.every((row) => row.thisWeek === 0 && row.lastWeek === 0)).toBe(true)
  })

  it('keeps the event-based blocks when the leads table is missing', async () => {
    const stats = await readVisitorStats(
      fakeSql([['WITH firsts', [{ visitors: 7, sessions: 9, page_views: 20, new_visitors: 5 }]]], ['FROM leads']),
    )
    expect(stats.summary.visitors).toBe(7)
    expect(stats.scorecard.find((row) => row.label === 'Leads')).toEqual({ label: 'Leads', thisWeek: 0, lastWeek: 0 })
  })

  it('names a visit by the lead email that shares its anon_id', async () => {
    const session = { session_id: 's1', anon_id: 'anon-1', email: null }
    const stats = await readVisitorStats(
      fakeSql([
        ['WITH s AS', [session, { session_id: 's2', anon_id: 'anon-2', email: 'signup@example.com' }]],
        ['SELECT anon_id, MAX(email)', [{ anon_id: 'anon-1', email: 'lead@example.com' }]],
      ]),
    )
    expect(stats.recentSessions.map((row) => row.email)).toEqual(['lead@example.com', 'signup@example.com'])
  })

  it('builds the scorecard from this week and last week', async () => {
    const stats = await readVisitorStats(
      fakeSql([
        ['visitors_this', [{ visitors_this: 12, visitors_last: 8, sessions_this: 15, sessions_last: 9, resume_this: 4, resume_last: 1, games_this: 3, games_last: 0 }]],
        ['FROM email_signups', [{ this_week: 2, last_week: 1 }]],
      ]),
    )
    expect(stats.scorecard[0]).toEqual({ label: 'Visitors', thisWeek: 12, lastWeek: 8 })
    expect(stats.scorecard[2]).toEqual({ label: 'Resume views', thisWeek: 4, lastWeek: 1 })
    expect(stats.scorecard[5]).toEqual({ label: 'Email signups', thisWeek: 2, lastWeek: 1 })
  })
})
