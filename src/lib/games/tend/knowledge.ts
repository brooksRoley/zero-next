/**
 * The game's non-plant teaching copy: composting, labels, and the California
 * calendar. Every line comes from the source beside it. Like the field notes,
 * this is a Learning Mode surface that Brooks reviews before it ships.
 */

export type Source = { label: string; url: string }

export const SOURCES = {
  calrecycleLabels: { label: 'CalRecycle: truth-in-labeling laws', url: 'https://calrecycle.ca.gov/plastics/labeling/' },
  ucIpmCompost: { label: 'UC IPM: composting', url: 'https://ipm.ucanr.edu/home-and-landscape/composting/' },
  ucFallPlanting: {
    label: 'UC ANR: fall planting for California natives',
    url: 'https://ucanr.edu/blog/garden-notes/article/fall-planting-california-natives',
  },
} satisfies Record<string, Source>

/** Shown when a seed is composted: what actually turns back into soil. */
export const COMPOST_NOTES: { title: string; body: string; source: Source }[] = [
  {
    title: 'Compostable is not the same as biodegradable',
    body:
      'In California, a plastic sold as compostable has to meet a set standard (ASTM D6400, or D6868 for plastic-coated paper), and “home compostable” needs its own certification. The state restricts marketing products as “biodegradable”, a word that promises a breakdown with no deadline and no conditions.',
    source: SOURCES.calrecycleLabels,
  },
  {
    title: 'Greens and browns',
    body:
      'Mix roughly equal volumes of green material (fresh scraps, clippings) and dry material (dead leaves, straw) for a carbon-to-nitrogen ratio near 30 to 1. A working pile heats to about 160°F, and the compost is done when it stops making heat.',
    source: SOURCES.ucIpmCompost,
  },
  {
    title: 'What stays out',
    body:
      'Keep soil, fireplace ashes, meat, dairy, and manure from meat-eating animals out of the pile. That includes what Nalu, Pika and Nanu leave behind.',
    source: SOURCES.ucIpmCompost,
  },
]

/** One line for the real time of year, keyed by calendar month (0 = January). */
export function almanac(month: number): { line: string; source: Source } {
  if (month >= 9 && month <= 11) {
    return {
      line: 'Planting season. Late fall is the best time to plant natives: the soil is still warm, and fall and winter rains help roots take hold before the hot, dry summer.',
      source: SOURCES.ucFallPlanting,
    }
  }
  if (month >= 5 && month <= 8) {
    return {
      line: 'Dry season. Summer is the worst time to plant natives; new plants need watering for their first one to two years even when they are drought tolerant.',
      source: SOURCES.ucFallPlanting,
    }
  }
  return {
    line: 'Natives typically need less water than plants from elsewhere, but even drought-tolerant ones need watering for their first one to two years.',
    source: SOURCES.ucFallPlanting,
  }
}
