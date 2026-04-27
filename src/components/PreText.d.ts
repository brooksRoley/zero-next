import type { CSSProperties, JSX } from 'react'

type PreTextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'

export interface PreTextProps {
  text?: string
  mode?: 'flow' | 'pulse' | 'fill'
  value?: number
  color?: string
  accentColor?: string
  float?: boolean
  fontSize?: string | null
  fontWeight?: string
  interactive?: boolean
  fieldRadius?: number
  fieldStrength?: number
  settle?: number
  className?: string
  style?: CSSProperties
  tag?: PreTextTag
}

export default function PreText(props: PreTextProps): JSX.Element
