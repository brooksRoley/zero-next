// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import TendPerennials, { rungSummary } from 'src/components/games/TendPerennials'
import type { Perennial } from 'src/lib/games/tend/perennials'

afterEach(cleanup)

const TREE: Perennial[] = [
  { id: 'nextjs', name: 'Next.js', branch: 'Frontend', dates: ['', '2026-10-01', null, null] },
  { id: 'vue', name: 'Vue', branch: 'Frontend', dates: ['', '', '2026-10-02', '2026-10-03'] },
  { id: 'search-relevance', name: 'Search relevance', branch: 'Search + AI', dates: [null, null, null, null] },
]

describe('TendPerennials', () => {
  it('draws a tree per skill under its branch, with counts and the permanent ones named', () => {
    const { container, getByText } = render(<TendPerennials perennials={TREE} />)
    expect(container.querySelectorAll('li svg')).toHaveLength(3)
    expect(getByText('Frontend').textContent).toContain('6 of 8 rungs')
    expect(getByText('Search + AI').textContent).toContain('0 of 4 rungs')
    expect(getByText('2 of 4')).toBeTruthy()
    expect(getByText('Permanent tree')).toBeTruthy()
    // Nothing on it links anywhere: the file carries no evidence to link to.
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('says what each rung is and when it opened, plainly', () => {
    expect(rungSummary(TREE[0])).toBe(
      'Used it: on record. Shipped it: Oct 1, 2026. Measured it: Not yet. Wrote the design note: Not yet',
    )
  })

  it('renders nothing for a garden with no perennials', () => {
    const { container } = render(<TendPerennials perennials={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
