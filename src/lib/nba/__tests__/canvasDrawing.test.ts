// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawExplorerGraph, drawExplorerChart } from 'src/lib/nba/canvasDrawing'
import { NODE_POSITIONS } from 'src/lib/nba/explorerConfig'

/**
 * jsdom doesn't implement the canvas 2D rendering API, so both functions
 * under test would no-op (ctx is always null) without a stand-in. This mock
 * records every call so we can assert the functions actually drove drawing,
 * not just that they didn't throw.
 */
function makeMockCtx() {
  const calls: string[] = []
  const gradient = { addColorStop: vi.fn() }
  const ctx: Record<string, unknown> = {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    translate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(() => calls.push('clearRect')),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(() => calls.push('stroke')),
    fill: vi.fn(() => calls.push('fill')),
    fillRect: vi.fn(),
    fillText: vi.fn(() => calls.push('fillText')),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    __calls: calls,
  }
  return ctx
}

function mockCanvas(ctx: Record<string, unknown> | null, rect?: Partial<DOMRect>) {
  const canvas = document.createElement('canvas')
  const parent = document.createElement('div')
  parent.appendChild(canvas)
  parent.getBoundingClientRect = vi.fn(
    () => ({ width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON() {}, ...rect })
  ) as unknown as typeof parent.getBoundingClientRect
  canvas.getContext = vi.fn(() => ctx) as unknown as typeof canvas.getContext
  return canvas
}

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
})

describe('drawExplorerGraph', () => {
  const baseOpts = {
    cam: { x: 0, y: 0, zoom: 1 },
    apiMap: {},
    physPos: (key: string) => NODE_POSITIONS[key] ?? { x: 0, y: 0 },
    hoveredNode: null,
    focusedNode: null,
    activeKey: null,
  }

  it('does nothing when the canvas has no parent element', () => {
    const ctx = makeMockCtx()
    const canvas = document.createElement('canvas')
    canvas.getContext = vi.fn(() => ctx) as unknown as typeof canvas.getContext
    expect(() => drawExplorerGraph({ canvas, ...baseOpts })).not.toThrow()
    expect(ctx.save).not.toHaveBeenCalled()
  })

  it('does nothing when canvas is null', () => {
    expect(() => drawExplorerGraph({ canvas: null, ...baseOpts })).not.toThrow()
  })

  it('does nothing when getContext returns null (unsupported canvas)', () => {
    const canvas = mockCanvas(null)
    expect(() => drawExplorerGraph({ canvas, ...baseOpts })).not.toThrow()
  })

  it('sizes the canvas for the device pixel ratio and draws the court + every node', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx, { width: 400, height: 300 })
    drawExplorerGraph({ canvas, ...baseOpts })

    expect(canvas.width).toBe(800) // 400 * dpr(2)
    expect(canvas.height).toBe(600)
    expect(ctx.clearRect).toHaveBeenCalled()
    // One node per NODE_POSITIONS entry, each drawn as a circle + label.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(
      Object.keys(NODE_POSITIONS).length
    )
    expect(ctx.fillText).toHaveBeenCalled()
    // save()/restore() must balance (outer graph save + court's inner save+restore ×2 for the arcs).
    expect((ctx.save as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      (ctx.restore as ReturnType<typeof vi.fn>).mock.calls.length
    )
  })

  it('draws edges between a node and its children, highlighting the active one', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    drawExplorerGraph({
      canvas,
      ...baseOpts,
      apiMap: { root: { label: 'Root', description: '', children: ['teams'] } },
      activeKey: 'teams',
    })
    expect(ctx.quadraticCurveTo).toHaveBeenCalled()
  })

  it('draws a focus ring only for the focused node', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    drawExplorerGraph({ canvas, ...baseOpts, focusedNode: 'root' })
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3])
    expect(ctx.setLineDash).toHaveBeenCalledWith([])
  })
})

describe('drawExplorerChart', () => {
  it('does nothing when canvas is null', () => {
    expect(() => drawExplorerChart(null, [{ pts: 10 }], 'pts', null)).not.toThrow()
  })

  it('does nothing when there is no data', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    drawExplorerChart(canvas, [], 'pts', null)
    expect(ctx.clearRect).not.toHaveBeenCalled()
  })

  it('does nothing when no metric is given', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    drawExplorerChart(canvas, [{ pts: 10 }], '', null)
    expect(ctx.clearRect).not.toHaveBeenCalled()
  })

  it('does nothing when getContext returns null', () => {
    const canvas = mockCanvas(null)
    expect(() => drawExplorerChart(canvas, [{ pts: 10 }], 'pts', null)).not.toThrow()
  })

  it('sizes a fixed 360x180 canvas (scaled by dpr) and renders bars for <=15 points', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    const data = [{ pts: 10, name: 'G1' }, { pts: 20, name: 'G2' }, { pts: 5, name: 'G3' }]
    drawExplorerChart(canvas, data, 'pts', 'players')

    expect(canvas.width).toBe(720) // 360 * dpr(2)
    expect(canvas.height).toBe(360) // 180 * dpr(2)
    expect(canvas.style.width).toBe('360px')
    expect(ctx.clearRect).toHaveBeenCalled()
    // One roundRect bar per data point, plus grid + labels via fillText.
    expect((ctx.roundRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(data.length)
    expect(ctx.fillText).toHaveBeenCalled()
  })

  it('renders a line series once there are more than 15 points', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    const data = Array.from({ length: 20 }, (_, i) => ({ pts: i, date: `d${i}` }))
    drawExplorerChart(canvas, data, 'pts', null)

    // Line mode draws exactly one point-marker arc per value, unlike bar
    // mode which draws none via `arc`.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(data.length)
    expect((ctx.roundRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })

  it('ignores non-numeric values for the metric and still renders when at least one numeric value exists', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    const data = [{ pts: 'DNP' }, { pts: 12 }]
    drawExplorerChart(canvas, data, 'pts', null)
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  it('renders a percentage-formatted y-axis for _pct metrics', () => {
    const ctx = makeMockCtx()
    const canvas = mockCanvas(ctx)
    drawExplorerChart(canvas, [{ ts_pct: 0.55 }, { ts_pct: 0.6 }], 'ts_pct', null)
    const labels = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(labels.some((l) => typeof l === 'string' && l.endsWith('%'))).toBe(true)
  })
})
