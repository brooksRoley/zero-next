// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import Reveal from 'src/components/Reveal'
import { prefersReducedMotion } from 'src/lib/motion'

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

class FakeObserver {
  static last = null
  constructor(callback) { this.callback = callback; FakeObserver.last = this }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function placeBelowFold() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight + 500 })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete window.IntersectionObserver
})

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    setReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    setReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('Reveal', () => {
  it('leaves content visible when IntersectionObserver is unavailable (no-JS-like clients)', () => {
    setReducedMotion(false)
    placeBelowFold()
    render(<Reveal><p>hello</p></Reveal>)
    expect(screen.getByText('hello').parentElement.style.opacity).toBe('')
  })

  it('leaves content visible for reduced-motion visitors', () => {
    setReducedMotion(true)
    window.IntersectionObserver = FakeObserver
    placeBelowFold()
    render(<Reveal><p>hello</p></Reveal>)
    expect(screen.getByText('hello').parentElement.style.opacity).toBe('')
  })

  it('does not hide content that is already on screen', () => {
    setReducedMotion(false)
    window.IntersectionObserver = FakeObserver
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0 })
    render(<Reveal><p>hello</p></Reveal>)
    expect(screen.getByText('hello').parentElement.style.opacity).toBe('')
  })

  it('hides below-the-fold content, then reveals it on scroll', () => {
    setReducedMotion(false)
    window.IntersectionObserver = FakeObserver
    placeBelowFold()
    render(<Reveal><p>hello</p></Reveal>)
    const wrapper = screen.getByText('hello').parentElement
    expect(wrapper.style.opacity).toBe('0')
    act(() => FakeObserver.last.callback([{ isIntersecting: true }]))
    expect(wrapper.style.opacity).toBe('1')
  })
})

describe('motion components honor reduced motion', () => {
  it.each(['src/components/TiltCard.tsx', 'src/components/PhysicsField.tsx', 'src/components/Reveal.jsx'])(
    '%s checks prefersReducedMotion()',
    (file) => {
      expect(read(file)).toContain('prefersReducedMotion()')
    },
  )
})

describe('404 page', () => {
  it('exists, names the site in its title, and is not indexed', () => {
    const src = read('src/pages/404.tsx')
    expect(src).toContain('Page not found | Brooks Roley')
    expect(src).toContain('noindex')
  })
})
