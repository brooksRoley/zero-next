import { useRef, useCallback, ReactNode } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
}

export default function TiltCard({ children, className = '' }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    // Parallax tilt + scale
    const rotX = (0.5 - y) * 12
    const rotY = (x - 0.5) * 12
    el.style.transition = 'transform 0.1s ease-out'
    el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.03)`

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
  }, [])

  const handleMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    el.style.transform = ''
    el.style.setProperty('--hl-opacity', '0')
  }, [])

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
