/** The five habit lanes, each of which grows one kind of plant. */
export const LANES = ['body', 'craft', 'rest', 'joy', 'green'] as const
export type Lane = (typeof LANES)[number]

export const PLANT_KINDS = ['oak', 'vine', 'moonflower', 'sunflower', 'fern'] as const
export type PlantKind = (typeof PLANT_KINDS)[number]

/** [x, y] on the grid; y grows downward, so "above" is y - 1. */
export type Cell = readonly [number, number]

export type FieldNote = {
  /** Two or three sentences, every claim from `source`. */
  body: string
  /** A safety line, shown separately when the plant is harmful to people or pets. */
  caution?: string
  source: string
}

export type PlantDef = {
  kind: PlantKind
  lane: Lane
  name: string
  latin: string
  /** What counts as keeping this habit, shown at check-in. */
  habit: string
  /** The plant's game trait, in one line. */
  trait: string
  /** Base bed shape, normalized so its minimum x and y are 0. */
  shape: readonly Cell[]
  /** A muted rim colour. Gold is reserved for the poppy, the garden's one bright accent. */
  color: string
  /** Unlocked the first time one of these beds blooms. */
  note: FieldNote
}

/**
 * Real California natives. The traits are game rules; the field notes are
 * facts, each taken from the Calscape (California Native Plant Society) page
 * linked as its source. Player-facing teaching copy is a Learning Mode
 * surface: Brooks reviews it before it ships.
 */
export const PLANTS: Record<PlantKind, PlantDef> = {
  oak: {
    kind: 'oak',
    lane: 'body',
    name: 'Coast live oak',
    latin: 'Quercus agrifolia',
    habit: 'Body: trained, jumped, lifted or moved hard',
    trait: 'Tall. Shades whatever grows directly below it.',
    shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
    color: '#5f7f4f',
    note: {
      body:
        'An evergreen oak that can live more than 250 years. It is a caterpillar host for 265 native butterfly and moth species, and more than 270 species rely on it for food and shelter. Full sun or part shade; once established it wants summer water no more than once a month.',
      source: 'https://calscape.org/Quercus-agrifolia-(Coast-Live-Oak)',
    },
  },
  vine: {
    kind: 'vine',
    lane: 'craft',
    name: 'California wild grape',
    latin: 'Vitis californica',
    habit: 'Craft: deep work, or shipped something',
    trait: 'Climbs. Grows faster for every oak it touches.',
    shape: [[0, 0], [1, 0], [2, 0]],
    color: '#5f8a80',
    note: {
      body:
        'A fast-growing native grape of streamsides and springs. Its purple fruit ripens in late summer and feeds birds; its big leaves turn orange and yellow in fall. It hosts 59 native butterfly and moth species.',
      caution: 'Grapes are toxic to dogs. Nalu keeps away from these beds.',
      source: 'https://calscape.org/Vitis-californica-(California-Wild-Grape)',
    },
  },
  moonflower: {
    kind: 'moonflower',
    lane: 'rest',
    name: 'Sacred datura',
    latin: 'Datura wrightii',
    habit: 'Rest: slept seven hours or more',
    trait: 'Night bloomer. Touching beds recover from a season a day sooner.',
    shape: [[0, 0], [1, 0], [2, 0], [1, 1]],
    color: '#8f8aa8',
    note: {
      body:
        'California’s own moonflower. Its white, sweet-smelling flowers open near full dark and wither a few hours after sunrise, and hawk moths such as the white-lined sphinx visit them at night. It needs little water once established.',
      caution: 'Every part is poisonous, the seeds most of all. Keep it away from children and pets.',
      source: 'https://calscape.org/Datura-wrightii-(Jimsonweed)',
    },
  },
  sunflower: {
    kind: 'sunflower',
    lane: 'joy',
    name: 'California poppy',
    latin: 'Eschscholzia californica',
    habit: 'Joy: did something purely for fun',
    trait: 'Sun lover. Only blooms with no oak directly above it.',
    shape: [[0, 0]],
    color: '#c9a24a',
    note: {
      body:
        'The state flower. It loves full sun and poor, well-drained soil, and its petals may stay shut on cloudy days. It reseeds itself freely, and 101 native bee species visit it.',
      source: 'https://calscape.org/Eschscholzia-californica-(California-Poppy)',
    },
  },
  fern: {
    kind: 'fern',
    lane: 'green',
    name: 'Western sword fern',
    latin: 'Polystichum munitum',
    habit: 'Green thumb: tended a real plant',
    trait: 'Holds moisture. Touching beds are safe from drought.',
    shape: [[1, 0], [2, 0], [0, 1], [1, 1]],
    color: '#7a9a5f',
    note: {
      body:
        'An evergreen fern of shady hillsides and redwood forest. It wants part to deep shade and more water than most natives, and each frond lives a year and a half to two and a half years. Deer and rabbits leave it alone.',
      source: 'https://calscape.org/Polystichum-munitum-(Western-Sword-Fern)',
    },
  },
}

export const KIND_FOR_LANE: Record<Lane, PlantKind> = {
  body: 'oak',
  craft: 'vine',
  rest: 'moonflower',
  joy: 'sunflower',
  green: 'fern',
}

/** Shift cells so the smallest x and y are 0, sorted for stable comparison. */
export function normalize(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  return cells
    .map(([x, y]) => [x - minX, y - minY] as Cell)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

/** Quarter turn clockwise. */
export function rotate(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map(([x, y]) => [-y, x] as Cell))
}

const keyOf = (cells: readonly Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';')

/** Every distinct orientation of a plant's bed, starting with its base shape. */
export function orientations(kind: PlantKind): Cell[][] {
  const out: Cell[][] = []
  let current = normalize(PLANTS[kind].shape)
  for (let i = 0; i < 4; i++) {
    if (!out.some((o) => keyOf(o) === keyOf(current))) out.push(current)
    current = rotate(current)
  }
  return out
}
