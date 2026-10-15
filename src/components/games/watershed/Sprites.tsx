import type { ReactElement } from 'react'
import type { SpriteId } from 'src/lib/games/tend/watershed'
import styles from './Watershed.module.css'

/**
 * The Watershed's residents, drawn in a 40×40 box in the same soft, outlined
 * style as Nalu, Pika and Nanu. Only living things get a face, so the sun and
 * the snowmelt drop have none. Everything idles gently, and the CSS turns the
 * motion off under prefers-reduced-motion.
 */

const O = '#1d2a24'
const BLUSH = '#f4a3a8'

const Eyes = ({ x1, x2, y, r = 1.5, fill = O }: { x1: number; x2: number; y: number; r?: number; fill?: string }) => (
  <g>
    <circle cx={x1} cy={y} r={r} fill={fill} />
    <circle cx={x2} cy={y} r={r} fill={fill} />
  </g>
)

const Blush = ({ x1, x2, y }: { x1: number; x2: number; y: number }) => (
  <g opacity={0.55}>
    <circle cx={x1} cy={y} r={1.6} fill={BLUSH} />
    <circle cx={x2} cy={y} r={1.6} fill={BLUSH} />
  </g>
)

const Smile = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 1.8} ${y}q1.8 1.6 3.6 0`} fill="none" stroke={O} strokeWidth={0.9} strokeLinecap="round" />
)

const SPRITES: Record<SpriteId, () => ReactElement> = {
  sun: () => (
    <g>
      <g className={styles.spin}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect key={deg} x={19} y={2} width={2.4} height={6} rx={1.2} fill="#ffb347" transform={`rotate(${deg} 20.2 20)`} />
        ))}
      </g>
      <circle cx={20} cy={20} r={10} fill="#ffd166" stroke={O} strokeWidth={1.1} />
      <circle cx={20} cy={20} r={6} fill="#ffe7a3" />
    </g>
  ),
  flower: () => (
    <g className={styles.sway}>
      <path d="M20 38V22" stroke="#4f8a4a" strokeWidth={2} />
      <ellipse cx={15} cy={30} rx={4} ry={2} fill="#6ea85e" transform="rotate(-30 15 30)" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <circle key={deg} cx={20} cy={11} r={4.2} fill="#f4a3c3" stroke={O} strokeWidth={0.9} transform={`rotate(${deg} 20 17)`} />
      ))}
      <circle cx={20} cy={17} r={3.4} fill="#ffd166" stroke={O} strokeWidth={0.9} />
    </g>
  ),
  pika: () => (
    <g className={styles.bob}>
      <circle cx={12.5} cy={13} r={4.5} fill="#b9a68d" stroke={O} strokeWidth={1.1} />
      <circle cx={27.5} cy={13} r={4.5} fill="#b9a68d" stroke={O} strokeWidth={1.1} />
      <circle cx={12.5} cy={13} r={2.2} fill="#e8c4b8" />
      <circle cx={27.5} cy={13} r={2.2} fill="#e8c4b8" />
      <ellipse cx={20} cy={25} rx={12} ry={11} fill="#b9a68d" stroke={O} strokeWidth={1.1} />
      <ellipse cx={20} cy={29} rx={6.5} ry={5} fill="#e4d7c3" />
      <Eyes x1={15.5} x2={24.5} y={22} r={1.7} />
      <Blush x1={13} x2={27} y={26} />
      <ellipse cx={20} cy={25} rx={1.3} ry={0.9} fill="#7a5a52" />
    </g>
  ),
  pine: () => (
    <g className={styles.sway}>
      <rect x={18.2} y={30} width={3.6} height={8} rx={1} fill="#7a5a3c" />
      <path d="M20 4 30 18H25L33 30H7L15 18H10Z" fill="#3f6b50" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
    </g>
  ),
  nutcracker: () => (
    <g className={styles.bob}>
      <path d="M8 28 2 33l8-1Z" fill="#2b2b2b" />
      <ellipse cx={18} cy={25} rx={11} ry={8} fill="#a3abb0" stroke={O} strokeWidth={1.1} />
      <path d="M12 23q6 8 14 2-5 7-14-2Z" fill="#2b2b2b" />
      <circle cx={26} cy={16} r={7} fill="#a3abb0" stroke={O} strokeWidth={1.1} />
      <path d="M32 15 39 17l-7 2Z" fill="#2b2b2b" />
      <circle cx={27.5} cy={15} r={1.5} fill={O} />
      <circle cx={25} cy={19} r={1.4} fill={BLUSH} opacity={0.55} />
    </g>
  ),
  oak: () => (
    <g className={styles.sway}>
      <rect x={17.5} y={26} width={5} height={12} rx={1.5} fill="#7a5a3c" />
      <circle cx={13} cy={19} r={8} fill="#5f8f5a" stroke={O} strokeWidth={1.1} />
      <circle cx={27} cy={19} r={8} fill="#5f8f5a" stroke={O} strokeWidth={1.1} />
      <circle cx={20} cy={12} r={9} fill="#6a9a63" stroke={O} strokeWidth={1.1} />
      <ellipse cx={24} cy={16} rx={1.6} ry={2.2} fill="#8a6a3a" />
    </g>
  ),
  caterpillar: () => (
    <g className={styles.bob}>
      {[10, 16, 22].map((x) => (
        <circle key={x} cx={x} cy={26} r={4.6} fill="#8fc96b" stroke={O} strokeWidth={1} />
      ))}
      <circle cx={29} cy={22} r={6} fill="#a6d77f" stroke={O} strokeWidth={1.1} />
      <path d="M27 16.5 25.5 12 M31 16.5 32.5 12" stroke={O} strokeWidth={1} strokeLinecap="round" />
      <Eyes x1={27.3} x2={31.3} y={21.5} r={1.2} />
      <circle cx={29.3} cy={24.5} r={1} fill={BLUSH} opacity={0.7} />
    </g>
  ),
  moth: () => (
    <g className={styles.bob}>
      <path d="M20 18 4 10q-2 10 8 12-6 6 2 10Z" fill="#c9b38f" stroke={O} strokeWidth={1} strokeLinejoin="round" />
      <path d="M20 18 36 10q2 10-8 12 6 6-2 10Z" fill="#c9b38f" stroke={O} strokeWidth={1} strokeLinejoin="round" />
      <path d="M12 24q4 2 7 0 M28 24q-4 2-7 0" stroke="#ef8fa6" strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <ellipse cx={20} cy={22} rx={3} ry={9} fill="#8a7358" stroke={O} strokeWidth={1} />
      <Eyes x1={18.6} x2={21.4} y={15.5} r={0.9} />
    </g>
  ),
  datura: () => (
    <g className={styles.sway}>
      <ellipse cx={9} cy={31} rx={8} ry={4} fill="#6f8f5a" stroke={O} strokeWidth={0.8} transform="rotate(-18 9 31)" />
      <ellipse cx={31} cy={31} rx={8} ry={4} fill="#6f8f5a" stroke={O} strokeWidth={0.8} transform="rotate(18 31 31)" />
      {/* A trumpet flower seen face-on: five pointed lobes around a pale throat. */}
      <path
        d="M20 3 24 12.5 34 13.5 26.5 20.5 29 30.5 20 25.5 11 30.5 13.5 20.5 6 13.5 16 12.5Z"
        fill="#f6f2ff"
        stroke={O}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <circle cx={20} cy={17.5} r={5} fill="#e4d9ff" />
      <circle cx={20} cy={17.5} r={2} fill="#b9a8e6" />
    </g>
  ),
  snowmelt: () => (
    <g className={styles.bob}>
      <path d="M20 6q11 14 11 21a11 11 0 0 1-22 0q0-7 11-21Z" fill="#7cc4f2" stroke={O} strokeWidth={1.1} />
      <ellipse cx={15.5} cy={22} rx={1.6} ry={3} fill="#d6f0ff" />
      <ellipse cx={23.5} cy={31} rx={3.2} ry={1.4} fill="#5aa9dc" opacity={0.6} />
    </g>
  ),
  crops: () => (
    <g className={styles.bob}>
      <path d="M20 12q-10 0-10 10 0 10 10 16 10-6 10-16 0-10-10-10Z" fill="#e8505b" stroke={O} strokeWidth={1.1} />
      <path d="M13 11 20 14l7-3-4 5h-6Z" fill="#5fa85a" stroke={O} strokeWidth={0.9} strokeLinejoin="round" />
      {[[15, 20], [24, 20], [19, 25], [16, 30], [24, 29]].map(([x, y]) => (
        <ellipse key={`${x},${y}`} cx={x} cy={y} rx={0.8} ry={1.2} fill="#ffe29a" />
      ))}
    </g>
  ),
  plate: () => (
    <g className={styles.bob}>
      <ellipse cx={20} cy={26} rx={16} ry={8} fill="#f7f4ec" stroke={O} strokeWidth={1.1} />
      <ellipse cx={20} cy={25.5} rx={10} ry={4.6} fill="#ece6d8" />
      <circle cx={16} cy={23} r={3.4} fill="#7fbf63" />
      <circle cx={21} cy={22} r={3.6} fill="#94cf72" />
      <circle cx={24.5} cy={24.5} r={2.4} fill="#e8505b" />
      <circle cx={17.5} cy={25.5} r={1.8} fill="#f0a04b" />
    </g>
  ),
  phyto: () => (
    <g className={styles.bob}>
      <circle cx={13} cy={16} r={5} fill="#8fd694" stroke={O} strokeWidth={0.9} />
      <circle cx={26} cy={14} r={4} fill="#b7e4a0" stroke={O} strokeWidth={0.9} />
      <circle cx={20} cy={26} r={6} fill="#6fcf9a" stroke={O} strokeWidth={0.9} />
      <path d="M17 26h6 M20 23v6" stroke="#3e9a6a" strokeWidth={1} />
      <circle cx={30} cy={27} r={3} fill="#9fe0c0" stroke={O} strokeWidth={0.9} />
    </g>
  ),
  mussel: () => (
    <g className={styles.bob}>
      <path d="M7 28q2-16 18-20 9 2 8 10-3 14-26 10Z" fill="#33405f" stroke={O} strokeWidth={1.1} />
      <path d="M11 27q4-10 15-15" fill="none" stroke="#6c7ca3" strokeWidth={1.2} />
      <Eyes x1={18} x2={24} y={22} r={1.4} fill="#f7f4ec" />
      <circle cx={18} cy={22} r={0.7} fill={O} />
      <circle cx={24} cy={22} r={0.7} fill={O} />
    </g>
  ),
  kelp: () => (
    <g className={styles.sway}>
      <path d="M20 39q-6-9 0-17t0-18" fill="none" stroke="#8a6d2a" strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx={13} cy={24} rx={6} ry={2.6} fill="#b08d3a" stroke={O} strokeWidth={0.8} transform="rotate(-25 13 24)" />
      <ellipse cx={27} cy={15} rx={6} ry={2.6} fill="#b08d3a" stroke={O} strokeWidth={0.8} transform="rotate(25 27 15)" />
      <ellipse cx={13} cy={9} rx={5} ry={2.2} fill="#c39d45" stroke={O} strokeWidth={0.8} transform="rotate(-25 13 9)" />
      <circle cx={19} cy={22} r={1.8} fill="#d9b35a" />
      <circle cx={21} cy={13} r={1.6} fill="#d9b35a" />
    </g>
  ),
  urchin: () => (
    <g className={styles.bob}>
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((deg) => (
        <line key={deg} x1={20} y1={22} x2={20} y2={7} stroke="#5b3a86" strokeWidth={1.4} strokeLinecap="round" transform={`rotate(${deg} 20 22)`} />
      ))}
      <circle cx={20} cy={22} r={9} fill="#7b4fa8" stroke={O} strokeWidth={1.1} />
      <Eyes x1={16.8} x2={23.2} y={21.5} r={1.4} fill="#f7f4ec" />
      <circle cx={16.8} cy={21.5} r={0.7} fill={O} />
      <circle cx={23.2} cy={21.5} r={0.7} fill={O} />
    </g>
  ),
  otter: () => (
    <g className={styles.bob}>
      <ellipse cx={20} cy={28} rx={15} ry={6.5} fill="#8a5a3c" stroke={O} strokeWidth={1.1} />
      <ellipse cx={20} cy={27} rx={9} ry={4} fill="#c79a72" />
      <circle cx={26} cy={25.5} r={2.8} fill="#7b4fa8" stroke={O} strokeWidth={0.8} />
      <circle cx={10} cy={18} r={7.5} fill="#9b6a4a" stroke={O} strokeWidth={1.1} />
      <ellipse cx={10} cy={20} rx={5} ry={3.6} fill="#e3c4a2" />
      <circle cx={4.5} cy={13} r={2} fill="#9b6a4a" stroke={O} strokeWidth={0.8} />
      <circle cx={15.5} cy={13} r={2} fill="#9b6a4a" stroke={O} strokeWidth={0.8} />
      <Eyes x1={7.6} x2={12.4} y={17} r={1.2} />
      <ellipse cx={10} cy={19.5} rx={1.2} ry={0.8} fill={O} />
      <path d="M4 20h3 M13 20h3" stroke={O} strokeWidth={0.6} />
    </g>
  ),
  krill: () => (
    <g className={styles.bob}>
      <path d="M6 20q8-12 22-6 6 4 4 10" fill="none" stroke="#f28c7a" strokeWidth={7} strokeLinecap="round" />
      <path d="M12 15v4 M17 12.5v4 M22 12.5v4 M27 14v4" stroke="#d96c5a" strokeWidth={1} />
      <path d="M32 24 36 30 M30 25l2 6 M14 22l-2 7 M19 21l-1 7" stroke="#d96c5a" strokeWidth={1} strokeLinecap="round" />
      <circle cx={8.5} cy={18} r={1.6} fill={O} />
      <path d="M5 17q-4-6-2-11" fill="none" stroke="#d96c5a" strokeWidth={0.8} />
    </g>
  ),
  whale: () => (
    <g className={styles.bob}>
      <path d="M33 18 39 12v14Z" fill="#4a78a8" stroke={O} strokeWidth={1} strokeLinejoin="round" />
      <ellipse cx={18} cy={21} rx={16} ry={9} fill="#4a78a8" stroke={O} strokeWidth={1.1} />
      <path d="M5 25q13 6 26 0" fill="#9fc1de" />
      <path d="M8 26.5h20 M10 28h15" stroke="#7aa3c6" strokeWidth={0.8} />
      <circle cx={9} cy={19} r={1.5} fill={O} />
      <circle cx={10} cy={22.5} r={1.5} fill={BLUSH} opacity={0.6} />
      <path d="M16 11q-1-4 1-6 M16 11q2-4 4-4" fill="none" stroke="#9fd3f5" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  ),
  zooplankton: () => (
    <g className={styles.bob}>
      <path d="M20 10q7 6 0 22-7-16 0-22Z" fill="#cfe6f2" stroke={O} strokeWidth={1} />
      <path d="M17 13Q6 8 3 12 M23 13q11-5 14-1" fill="none" stroke="#cfe6f2" strokeWidth={1} />
      <circle cx={20} cy={15} r={1.3} fill="#e8505b" />
      <path d="M18 32l-3 5 M22 32l3 5" stroke="#cfe6f2" strokeWidth={0.8} />
    </g>
  ),
  lanternfish: () => (
    <g className={styles.bob}>
      <path d="M31 20 38 14v12Z" fill="#2c3e66" stroke="#0e1a30" strokeWidth={1} strokeLinejoin="round" />
      <ellipse cx={18} cy={20} rx={14} ry={7} fill="#2c3e66" stroke="#0e1a30" strokeWidth={1.1} />
      <circle cx={9} cy={18.5} r={3} fill="#f7f4ec" />
      <circle cx={9.5} cy={18.5} r={1.6} fill={O} />
      <g className={styles.glow}>
        {[13, 17, 21, 25].map((x) => (
          <circle key={x} cx={x} cy={24} r={1.2} fill="#9ff3ff" />
        ))}
        <circle cx={6} cy={22} r={1.4} fill="#9ff3ff" />
      </g>
    </g>
  ),
  snow: () => (
    <g className={styles.bob}>
      {[[10, 10, 2.2], [24, 8, 1.6], [17, 18, 2.6], [30, 20, 1.8], [9, 26, 1.6], [22, 30, 2.2], [32, 33, 1.4]].map(([x, y, r]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={r} fill="#e9f1f7" opacity={0.85} />
      ))}
    </g>
  ),
  seacucumber: () => (
    <g className={styles.bob}>
      <path d="M5 28q2-10 15-10t15 9q-2 6-15 6T5 28Z" fill="#e08a6b" stroke={O} strokeWidth={1.1} />
      {[11, 17, 23, 29].map((x) => (
        <circle key={x} cx={x} cy={21.5} r={1.5} fill="#f2b39a" />
      ))}
      <path d="M33 26q4-1 4-4 M33 26q4 1 5 0" stroke="#e08a6b" strokeWidth={1} fill="none" />
      <Eyes x1={9} x2={13} y={26} r={1.1} />
      <circle cx={11} cy={29} r={1.1} fill={BLUSH} opacity={0.7} />
    </g>
  ),
  seep: () => (
    <g>
      <path d="M2 38q6-8 12-6l6 3 6-4q8-2 12 7Z" fill="#4b5563" stroke={O} strokeWidth={1} />
      <path d="M20 35v-3" stroke="#22303c" strokeWidth={1.5} />
      {[[19, 0], [23, 1.4], [16, 2.6]].map(([x, delay]) => (
        <circle key={x} className={styles.rise} style={{ animationDelay: `${delay}s` }} cx={x} cy={32} r={2} fill="none" stroke="#bfe7ff" strokeWidth={1.1} />
      ))}
    </g>
  ),
  tubeworm: () => (
    <g className={styles.sway}>
      {[[12, 14], [20, 8], [28, 16]].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 2.5} y={y} width={5} height={38 - y} rx={2} fill="#f2efe6" stroke={O} strokeWidth={0.9} />
          <ellipse cx={x} cy={y - 1} rx={4} ry={4.5} fill="#e0484f" stroke={O} strokeWidth={0.9} />
        </g>
      ))}
    </g>
  ),
}

/** One resident, drawn in a 40×40 box. */
/**
 * One resident. `delay` offsets its idle motion (through the inherited
 * --delay custom property), so creatures in a tier never move in perfect step.
 */
export function Sprite({ id, delay }: { id: SpriteId; delay?: number }) {
  const Draw = SPRITES[id]
  return delay === undefined ? <Draw /> : <g style={{ ['--delay' as string]: `${-delay}s` }}><Draw /></g>
}
