import React, { useEffect, useState } from 'react'

/**
 * Heavy stamped ELO gain marker — the "press down" moment after a solve.
 * Bundles a scale+rotate overshoot landing with the low-frequency thud
 * provided by the caller via onMount.
 *
 * Props:
 *   delta      — ELO change (positive or negative)
 *   zoneColor  — hex color for the seal's ring + wax tint
 *   onMount    — called once when the component actually renders; use it to
 *                fire audio/haptic in sync with the visual press
 *   lifespanMs — auto-dismiss after this many ms (default 900)
 *   onDismiss  — called when the seal fades out
 */
export default function WaxSeal({
  delta,
  zoneColor = '#b45309',
  onMount,
  lifespanMs = 900,
  onDismiss,
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (onMount) onMount()
    const t1 = setTimeout(() => setVisible(false), lifespanMs)
    const t2 = setTimeout(() => { if (onDismiss) onDismiss() }, lifespanMs + 250)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sign = delta >= 0 ? '+' : ''
  const tintStrong = zoneColor
  const tintDark = shade(zoneColor, -30)
  const tintLight = shade(zoneColor, 28)

  return (
    <div
      className="wax-seal-wrap"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 250ms ease-out',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <div
        className="wax-seal"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${tintLight} 0%, ${tintStrong} 45%, ${tintDark} 100%)`,
          boxShadow: `
            inset 0 2px 4px rgba(255,255,255,0.35),
            inset 0 -2px 4px rgba(0,0,0,0.45),
            0 6px 18px rgba(0,0,0,0.55),
            0 0 0 3px ${tintDark},
            0 0 28px ${tintStrong}55
          `,
        }}
      >
        <div className="wax-seal-inner" style={{ color: tintDark }}>
          <span className="wax-seal-label">ELO</span>
          <span className="wax-seal-delta">{sign}{delta}</span>
        </div>
      </div>
    </div>
  )
}

// Lightweight hex shader — no external deps.
function shade(hex, percent) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const f = (v) => {
    const next = percent < 0
      ? Math.round(v * (1 + percent / 100))
      : Math.round(v + (255 - v) * (percent / 100))
    return Math.max(0, Math.min(255, next))
  }
  return `#${[f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}
