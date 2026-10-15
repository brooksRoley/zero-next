// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import KelpPlay from 'src/components/games/watershed/KelpPlay'
import { newKelpPlay, playYear, rewindYear, type KelpPlay as Play } from 'src/lib/games/tend/kelp'

afterEach(cleanup)

function Harness({ unlimited = false, start = newKelpPlay() }: { unlimited?: boolean; start?: Play }) {
  const [play, setPlay] = useState(start)
  return (
    <KelpPlay
      play={play}
      unlimited={unlimited}
      still
      onRun={(to) => setPlay((p) => playYear(p, to, unlimited) ?? p)}
      onRewind={() => setPlay((p) => rewindYear(p, unlimited))}
    />
  )
}

describe('KelpPlay', () => {
  it('moves the lever, runs a year, and reads out the chain reaction and the leverage score', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run a year (spends a nudge)' }))
    expect(screen.getByText(/^Otters −\d → Urchins \+\d → Kelp/)).toBeTruthy()
    expect(screen.getByText(/You moved \d+\. The forest moved \d+\./)).toBeTruthy()
    expect(screen.getByLabelText('2 of 3 nudges')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Rewind a year' }))
    expect(screen.getByLabelText('3 of 3 nudges')).toBeTruthy()
    expect(screen.queryByText(/You moved/)).toBeNull()
  })

  it('says how to earn a nudge when there are none, and still runs an unchanged year', () => {
    render(<Harness start={{ ...newKelpPlay(), nudges: 0 }} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }))
    expect(screen.getByText(/No nudges left/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Run a year/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Some' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run a year' }))
    expect(screen.getByText(/Same lever as last year/)).toBeTruthy()
  })

  it('names the barren when the forest collapses', () => {
    render(<Harness unlimited />)
    fireEvent.click(screen.getByRole('radio', { name: 'Weak' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run a year' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run a year' }))
    expect(screen.getByText(/^Urchin barren\./)).toBeTruthy()
  })
})
