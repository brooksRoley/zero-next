import { describe, it, expect } from 'vitest'
import { CHAPTERS, ENTRIES, howToCollect, isCollected } from 'src/lib/games/tend/journal'
import { TIERS } from 'src/lib/games/tend/watershed'

describe('the Journal', () => {
  it('has unique entries in every chapter, each linking an https source', () => {
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(ENTRIES.length)
    for (const c of CHAPTERS) expect(ENTRIES.some((e) => e.chapter === c.id), c.id).toBe(true)
    for (const e of ENTRIES) expect(e.source.url, e.id).toMatch(/^https:\/\//)
  })

  it('collects tier entries only from tiers that exist', () => {
    const ids = new Set(TIERS.map((t) => t.id))
    for (const e of ENTRIES) if (e.collect.by === 'tier') expect(ids.has(e.collect.tier), e.id).toBe(true)
  })

  // The UC Museum of Paleontology misconceptions guide, as a lint: these phrasings teach the wrong idea.
  it.each(ENTRIES.map((e) => [e.id, e.body]))('%s avoids misconception wording', (_id, body) => {
    expect(body).not.toMatch(/\bmutated (to|into|so)\b/i)
    expect(body).not.toMatch(/\bevolved into\b/i)
    expect(body).not.toMatch(/\bfittest\b/i)
    expect(body).not.toMatch(/\bin order to (survive|adapt)\b/i)
    expect(body).not.toMatch(/\b(better|higher) form\b/i)
  })

  it('marks entries collected from what the player has done', () => {
    const otter = ENTRIES.find((e) => e.id === 'otter-fur')!
    const barren = ENTRIES.find((e) => e.id === 'barren')!
    const almond = ENTRIES.find((e) => e.id === 'almond')!
    const none = { tiers: new Set<string>() }
    expect(isCollected(otter, none)).toBe(false)
    expect(isCollected(otter, { tiers: new Set(['kelp']) })).toBe(true)
    expect(isCollected(barren, { ...none, kelp: { barren: true, recovered: false, bigLeverage: false } })).toBe(true)
    expect(isCollected(almond, { ...none, farm: { saved: true } })).toBe(true)
    for (const e of ENTRIES) expect(howToCollect(e).length).toBeGreaterThan(10)
  })
})
