// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AlpinePlay from 'src/components/games/watershed/AlpinePlay'
import FarmPlay from 'src/components/games/watershed/FarmPlay'
import { newAlpinePlay, playGenerations, restartAlpine, rewindGenerations } from 'src/lib/games/tend/alpine'
import { newFarmPlay, plantSeason, rewindSeason } from 'src/lib/games/tend/farm'

afterEach(cleanup)

function Alpine() {
  const [play, setPlay] = useState(newAlpinePlay(5))
  return (
    <AlpinePlay
      play={play}
      onRun={(h) => setPlay((p) => playGenerations(p, h))}
      onRewind={() => setPlay((p) => rewindGenerations(p))}
      onRestart={() => setPlay((p) => restartAlpine(p))}
    />
  )
}

function Farm() {
  const [play, setPlay] = useState(newFarmPlay(4))
  return <FarmPlay play={play} onPlant={(s) => setPlay((p) => plantSeason(p, s))} onRewind={() => setPlay((p) => rewindSeason(p))} />
}

describe('AlpinePlay', () => {
  it('sets the summer, runs twenty generations, and captions the change', () => {
    render(<Alpine />)
    fireEvent.click(screen.getByRole('radio', { name: 'Heatwave' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run 20 generations' }))
    expect(screen.getByText(/Pikas: 20 → \d+\./)).toBeTruthy()
    expect(screen.getByRole('img', { name: /share of the pikas/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rewind' }))
    expect(screen.queryByText(/Pikas: 20 →/)).toBeNull()
  })

  it('never lets the player pick a coat: the only controls are the summer and the run', () => {
    render(<Alpine />)
    expect(screen.queryAllByRole('button', { name: /coat/i })).toEqual([])
  })
})

describe('FarmPlay', () => {
  it('saves seed from chosen plants and grows the next season', () => {
    render(<Farm />)
    const grow = () => screen.getByRole('button', { name: /Grow next season|Pick plants|seed bank/ }) as HTMLButtonElement
    expect(grow().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Red, fruit size 3/ }))
    fireEvent.click(grow())
    expect(screen.getByText(/Average fruit size: [\d.]+ → [\d.]+ over 1 season\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rewind a season' }))
    expect(screen.queryByText(/Average fruit size/)).toBeNull()
  })
})
