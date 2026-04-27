import { useRef, useCallback, useEffect, ReactNode } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
}

export default function TiltCard({ children, className = '' }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const motionRef = useRef({
    frame: 0,
    currentRotX: 0,
    currentRotY: 0,
    currentLift: 0,
    currentScale: 1,
    targetRotX: 0,
    targetRotY: 0,
    targetLift: 0,
    targetScale: 1,
  })

  const tick = useCallback(() => {
    const el = ref.current
    const motion = motionRef.current
    if (!el) return

    motion.currentRotX += (motion.targetRotX - motion.currentRotX) * 0.16
    motion.currentRotY += (motion.targetRotY - motion.currentRotY) * 0.16
    motion.currentLift += (motion.targetLift - motion.currentLift) * 0.16
    motion.currentScale += (motion.targetScale - motion.currentScale) * 0.16

    el.style.transform = `perspective(900px) rotateX(${motion.currentRotX}deg) rotateY(${motion.currentRotY}deg) translateY(${motion.currentLift}px) scale(${motion.currentScale})`

    const stillMoving =
      Math.abs(motion.currentRotX - motion.targetRotX) > 0.04 ||
      Math.abs(motion.currentRotY - motion.targetRotY) > 0.04 ||
      Math.abs(motion.currentLift - motion.targetLift) > 0.04 ||
      Math.abs(motion.currentScale - motion.targetScale) > 0.001

    if (stillMoving) {
      motion.frame = requestAnimationFrame(tick)
    } else {
      motion.frame = 0
    }
  }, [])

  const ensureFrame = useCallback(() => {
    if (!motionRef.current.frame) {
      motionRef.current.frame = requestAnimationFrame(tick)
    }
  }, [tick])

  const handleMouseMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const motion = motionRef.current
    motion.targetRotX = (0.5 - y) * 11
    motion.targetRotY = (x - 0.5) * 11
    motion.targetLift = -6
    motion.targetScale = 1.028
    ensureFrame()

    // Cursor-tracking glow (propagates to ::before and .tilt-highlight via CSS vars)
    const pxX = `${e.clientX - rect.left}px`
    const pxY = `${e.clientY - rect.top}px`
    el.style.setProperty('--hl-x', pxX)
    el.style.setProperty('--hl-y', pxY)
    el.style.setProperty('--hl-opacity', '1')

    // Also set on the card-hover-border child so ::before picks it up
    const border = el.querySelector('.card-hover-border') as HTMLElement | null
    if (border) {
      border.style.setProperty('--hl-x', pxX)
      border.style.setProperty('--hl-y', pxY)
    }
  }, [ensureFrame])

  const handleMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    const motion = motionRef.current
    motion.targetRotX = 0
    motion.targetRotY = 0
    motion.targetLift = 0
    motion.targetScale = 1
    ensureFrame()
    el.style.setProperty('--hl-opacity', '0')
  }, [ensureFrame])

  useEffect(() => {
    const motion = motionRef.current
    return () => {
      const frame = motion.frame
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onPointerMove={handleMouseMove}
      onPointerLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
