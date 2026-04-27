import { ReactNode, useEffect, useRef } from 'react'

export default function PhysicsField({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    active: false,
    burst: 0,
  })
  const statesRef = useRef<Array<{ x: number; y: number; rx: number; ry: number; scale: number }>>([])

  useEffect(() => {
    const container = ref.current
    if (!container) return

    let frame = 0

    const collectItems = () => {
      const items = Array.from(container.querySelectorAll<HTMLElement>('[data-physics-item]'))
      statesRef.current = items.map((_, index) => statesRef.current[index] || {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        scale: 1,
      })
      return items
    }

    let items = collectItems()

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      const nextX = clientX - rect.left
      const nextY = clientY - rect.top
      const pointer = pointerRef.current
      pointer.vx = nextX - pointer.x
      pointer.vy = nextY - pointer.y
      pointer.x = nextX
      pointer.y = nextY
      pointer.active = true
    }

    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY)
    }

    const onPointerLeave = () => {
      pointerRef.current.active = false
    }

    const onPointerDown = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY)
      pointerRef.current.burst = Math.min(1.4, pointerRef.current.burst + 1)
    }

    const loop = (now: number) => {
      const rect = container.getBoundingClientRect()
      const pointer = pointerRef.current
      const pointerSpeed = Math.min(18, Math.hypot(pointer.vx, pointer.vy))
      const scrollEnergy = Math.min(1, window.scrollY / Math.max(window.innerHeight * 1.25, 1))
      const ambient = 0.02 + scrollEnergy * 0.04

      if (items.length !== container.querySelectorAll('[data-physics-item]').length) {
        items = collectItems()
      }

      for (let index = 0; index < items.length; index++) {
        const el = items[index]
        const state = statesRef.current[index]
        const itemRect = el.getBoundingClientRect()
        const cx = itemRect.left - rect.left + itemRect.width / 2
        const cy = itemRect.top - rect.top + itemRect.height / 2
        const dx = pointer.x - cx
        const dy = pointer.y - cy
        const dist = Math.hypot(dx, dy)
        const influence = pointer.active ? Math.max(0, 1 - dist / 420) : 0
        const driftX = Math.sin(now * 0.00055 + index * 1.1) * (3 + scrollEnergy * 2)
        const driftY = Math.cos(now * 0.00065 + index * 1.3) * (2 + scrollEnergy * 2)

        const targetX = driftX - dx * influence * 0.04
        const targetY = driftY - dy * influence * 0.028
        const targetRx = clamp((dy / 180) * influence * 7, -6, 6)
        const targetRy = clamp((-dx / 180) * influence * 7, -6, 6)
        const targetScale = 1 + influence * 0.028 + ambient + pointer.burst * 0.01 + pointerSpeed * 0.0015

        state.x += (targetX - state.x) * 0.14
        state.y += (targetY - state.y) * 0.14
        state.rx += (targetRx - state.rx) * 0.14
        state.ry += (targetRy - state.ry) * 0.14
        state.scale += (targetScale - state.scale) * 0.14

        el.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotateX(${state.rx}deg) rotateY(${state.ry}deg) scale(${state.scale})`
      }

      pointer.vx *= 0.82
      pointer.vy *= 0.82
      pointer.burst *= 0.9

      frame = requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(() => {
      items = collectItems()
    })
    resizeObserver.observe(container)

    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerleave', onPointerLeave)
    container.addEventListener('pointerdown', onPointerDown)
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div ref={ref} className={`physics-field-grid ${className}`}>
      {children}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
