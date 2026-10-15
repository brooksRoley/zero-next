import type { KelpPlay } from './kelp'
import type { SpriteId } from './watershed'

/**
 * The Journal: one field guide in three chapters.
 *
 *   Cultivated: crops people shaped, by keeping the plants they liked.
 *   Adapted:    wild species, tier by tier down the watershed.
 *   Ripples:    chain reactions the player has set off themselves.
 *
 * Every entry is open to read. Collecting one is the game: a tier your garden
 * reaches collects its Adapted entries, the farm collects Cultivated ones, and
 * playing a tier collects its Ripples.
 *
 * DRAFT COPY, pending Brooks's review (Learning Mode). Each body says only
 * what the linked source says; the sources were opened on 2026-10-15. Wording
 * follows the UC Museum of Paleontology misconceptions guide: populations
 * change, individuals don't evolve, and "fit" means offspring left behind.
 */

export type Chapter = 'cultivated' | 'adapted' | 'ripples'

export const CHAPTERS: { id: Chapter; title: string; blurb: string }[] = [
  { id: 'cultivated', title: 'Cultivated', blurb: 'Crops people shaped, by choosing which plants to keep growing.' },
  { id: 'adapted', title: 'Adapted', blurb: 'Wild species and the traits that suit them to their place, from the peaks to the deep.' },
  { id: 'ripples', title: 'Ripples', blurb: 'Chain reactions you set off yourself in the Watershed.' },
]

/** How an entry is collected. */
export type Collect =
  | { by: 'tier'; tier: string }
  | { by: 'kelp'; event: keyof KelpPlay['seen'] }
  | { by: 'farm'; event: FarmEvent }
  | { by: 'alpine'; event: AlpineEvent }

export type FarmEvent = 'saved' | 'blight' | 'diverse'
export type AlpineEvent = 'spread' | 'lost' | 'declined'

export type Entry = {
  id: string
  chapter: Chapter
  title: string
  /** What kind of change it is: "Mutation, then human selection", "Adaptation", "Chain reaction". */
  kind: string
  body: string
  source: { label: string; url: string }
  collect: Collect
  sprite?: SpriteId
}

export const ENTRIES: Entry[] = [
  // ── Cultivated ──
  {
    id: 'almond',
    chapter: 'cultivated',
    title: 'Sweet almond',
    kind: 'Mutation, then human selection',
    body: 'Bitter almonds contain amygdalin, which makes them bitter and poisonous. In sweet almonds, one gene lost its function through a natural mutation, so the amygdalin is never made. People kept growing the trees with the mutation.',
    source: { label: 'University of Copenhagen', url: 'https://synbio.ku.dk/news/danish-researchers-unravel-how-toxic-almonds-became-edible/' },
    collect: { by: 'farm', event: 'saved' },
  },
  {
    id: 'tomato',
    chapter: 'cultivated',
    title: 'Tomato size',
    kind: 'Artificial selection',
    body: 'Most wild tomatoes have 2 to 4 seed chambers; domesticated varieties can have 8 or more. Domesticated tomatoes can be up to 1,000 times larger than their wild relatives.',
    source: { label: 'ScienceDaily (ASPB)', url: 'https://www.sciencedaily.com/releases/2008/06/080628065632.htm' },
    collect: { by: 'farm', event: 'saved' },
    sprite: 'crops',
  },
  {
    id: 'grape',
    chapter: 'cultivated',
    title: 'The grapevine’s flowers',
    kind: 'Rare change, selected',
    body: 'Every wild grape species has male and female flowers on separate plants. The cultivated grapevine reverted to flowers with both male and female parts, a trait that made domestication possible.',
    source: { label: 'UC Davis', url: 'https://ucdavis.edu/blog/uncovering-genetic-basis-hermaphroditism-grapes-trait-allowed-domestication' },
    collect: { by: 'farm', event: 'diverse' },
  },
  {
    id: 'carrot',
    chapter: 'cultivated',
    title: 'Orange carrot',
    kind: 'Artificial selection',
    body: 'Wild carrots are white. The first cultivated carrots, documented in Central Asia about 1,100 years ago, were purple and yellow. The orange carrot appeared in Europe in the 1500s.',
    source: { label: 'UC Davis', url: 'https://www.ucdavis.edu/index%2Ephp/news/carrot-genome-paints-picture-domestication-could-help-improve-crops' },
    collect: { by: 'farm', event: 'diverse' },
  },
  {
    id: 'cabbage',
    chapter: 'cultivated',
    title: 'One wild plant, six vegetables',
    kind: 'Artificial selection',
    body: 'Wild cabbage (Brassica oleracea) became six vegetables. Plants with a large end bud were bred into cabbage, leafy ones into kale, large side buds into Brussels sprouts, thick stems into kohlrabi, and the flowers into broccoli and cauliflower.',
    source: { label: 'Cornell Cooperative Extension', url: 'https://blogs.cornell.edu/master-gardeners-cce-oc/tag/plant-breeding' },
    collect: { by: 'farm', event: 'saved' },
  },
  {
    id: 'corn',
    chapter: 'cultivated',
    title: 'Corn kernels',
    kind: 'One small mutation, large effect',
    body: 'In teosinte, corn’s wild ancestor, each kernel sits in a hard casing. A single gene, tga1, controls that casing, and a change to just one amino acid in it may have been enough to expose the kernels. Once the mutation appeared, people kept planting it, and soon almost every plant they grew had exposed kernels.',
    source: { label: 'UW–Madison', url: 'https://news.wisc.edu/a-single-gene-controls-a-key-difference-between-maize-and-its-wild-ancestor' },
    collect: { by: 'farm', event: 'saved' },
  },

  // ── Adapted ──
  {
    id: 'pika',
    chapter: 'adapted',
    title: 'Pika coat',
    kind: 'Adaptation with a trade-off',
    body: 'A thick coat and a high metabolism hold a pika’s body at 104°F through the alpine winter. The same coat makes it hard to cool down: at a body temperature of 109°F, a pika reaches potentially fatal heat stress.',
    source: { label: 'NPS: pikas resource brief', url: 'https://www.nps.gov/articles/pikas-brief.htm' },
    collect: { by: 'tier', tier: 'alpine' },
    sprite: 'pika',
  },
  {
    id: 'woodpecker',
    chapter: 'adapted',
    title: 'Acorn woodpecker',
    kind: 'Adaptation (behaviour)',
    body: 'Acorn woodpeckers live in family groups of a dozen or more birds. They drill a hole for each acorn in a storage tree called a granary, and a single granary can hold up to 50,000 acorns.',
    source: { label: 'NPS Yosemite', url: 'https://www.nps.gov/yose/blogs/Acorn-Woodpecker.htm' },
    collect: { by: 'tier', tier: 'woodland' },
    sprite: 'oak',
  },
  {
    id: 'mussel',
    chapter: 'adapted',
    title: 'California mussel',
    kind: 'Adaptation',
    body: 'A mussel anchors itself with byssal threads. A gland makes them as a liquid, and the liquid hardens into thread the moment it meets seawater.',
    source: { label: 'Monterey Bay Aquarium', url: 'https://www.montereybayaquarium.org/animals/animals-a-to-z/california-mussel' },
    collect: { by: 'tier', tier: 'coast' },
    sprite: 'mussel',
  },
  {
    id: 'kelp-floats',
    chapter: 'adapted',
    title: 'Kelp gas bladders',
    kind: 'Adaptation',
    body: 'Many kelps have gas-filled bladders that keep their blades floating up toward the sunlight, which is how they build canopies at the surface.',
    source: { label: 'NOAA Sanctuaries', url: 'https://sanctuaries.noaa.gov/visit/ecosystems/kelpdesc.html' },
    collect: { by: 'tier', tier: 'kelp' },
    sprite: 'kelp',
  },
  {
    id: 'otter-fur',
    chapter: 'adapted',
    title: 'Sea otter fur',
    kind: 'Adaptation',
    body: 'Unlike other marine mammals, a sea otter has no thick layer of blubber. Its two-layer fur keeps it warm instead: more than a million hairs per square inch at its thickest.',
    source: { label: 'Monterey Bay Aquarium', url: 'https://www.montereybayaquarium.org/animals/animals-a-to-z/sea-otter' },
    collect: { by: 'tier', tier: 'kelp' },
    sprite: 'otter',
  },
  {
    id: 'glow',
    chapter: 'adapted',
    title: 'Glowing bellies',
    kind: 'Adaptation',
    body: 'Many twilight-zone animals have lights on their bellies that match the faint sunlight from above, so a predator looking up can’t pick out their silhouettes. This is called counterillumination.',
    source: { label: 'WHOI', url: 'https://www.whoi.edu/oceanus/feature/edie-widder-a-light-in-the-darkness' },
    collect: { by: 'tier', tier: 'twilight' },
    sprite: 'lanternfish',
  },

  // ── Ripples ──
  {
    id: 'barren',
    chapter: 'ripples',
    title: 'Urchin barren: a stable state',
    kind: 'Chain reaction',
    body: 'Without otters, urchin populations can boom and eat kelp until only bare rock remains. A barren and a kelp forest are two alternative stable states, and the tipping point depends on the direction: to bring the kelp back, urchins must be cut far below the level that caused the barren, roughly a tenth of it.',
    source: { label: 'Proceedings of the Royal Society B (2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11538989/' },
    collect: { by: 'kelp', event: 'barren' },
    sprite: 'urchin',
  },
  {
    id: 'recovered',
    chapter: 'ripples',
    title: 'Back from the barren',
    kind: 'Chain reaction',
    body: 'Sea otters are a keystone species: by eating urchins they keep their numbers in check, and where otters are abundant, kelp forests flourish.',
    source: { label: 'Monterey Bay Aquarium: kelp forests', url: 'https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest' },
    collect: { by: 'kelp', event: 'recovered' },
    sprite: 'otter',
  },
  {
    id: 'leverage',
    chapter: 'ripples',
    title: 'Small change, big effect',
    kind: 'Chain reaction',
    body: 'Change one animal and the effect runs down the chain. After the 2014 marine heatwave and a surge of purple urchins, roughly 95% of Northern California’s kelp forests disappeared.',
    source: { label: 'Monterey Bay Aquarium: kelp forests', url: 'https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest' },
    collect: { by: 'kelp', event: 'bigLeverage' },
    sprite: 'kelp',
  },
  {
    id: 'selection',
    chapter: 'ripples',
    title: 'Selection, not wishing',
    kind: 'Natural selection',
    body: 'Mutation, which makes new variants, is random; selection is not. Variants that let some individuals survive or reproduce better leave more offspring, and over generations they become more common in the population.',
    source: { label: 'UC Museum of Paleontology: misconceptions about evolution', url: 'https://evolution.berkeley.edu/wp-content/uploads/2021/10/misconceptions_about_evolution_2020.pdf' },
    collect: { by: 'alpine', event: 'spread' },
    sprite: 'pika',
  },
  {
    id: 'drift',
    chapter: 'ripples',
    title: 'Lost by luck',
    kind: 'Genetic drift',
    body: 'By chance, the individuals that reproduce may not represent the whole population, so gene versions drift from generation to generation. Drift happens in every population, but in small ones the shifts can be much larger.',
    source: { label: 'UC Museum of Paleontology: misconceptions about evolution', url: 'https://evolution.berkeley.edu/wp-content/uploads/2021/10/misconceptions_about_evolution_2020.pdf' },
    collect: { by: 'alpine', event: 'lost' },
    sprite: 'pika',
  },
  {
    id: 'no-rescue',
    chapter: 'ripples',
    title: 'No variant, no rescue',
    kind: 'Natural selection',
    body: 'Natural selection can’t sense what a species needs. It acts on the variation a population already has; if no variant helps, the population may survive anyway, or it may die out.',
    source: { label: 'UC Museum of Paleontology: misconceptions about evolution', url: 'https://evolution.berkeley.edu/wp-content/uploads/2021/10/misconceptions_about_evolution_2020.pdf' },
    collect: { by: 'alpine', event: 'declined' },
    sprite: 'pika',
  },
  {
    id: 'monoculture',
    chapter: 'ripples',
    title: 'One blight, every bed',
    kind: 'Chain reaction',
    body: 'Edible bananas reproduce asexually, through rhizomes, and the export trade was once built entirely on one variety, Gros Michel. Panama disease epidemics in the 1900s were among the worst in agricultural history, and by the 1960s Gros Michel production had collapsed. The resistant Cavendish replaced it.',
    source: { label: 'PLoS Pathogens (2015)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4652896/' },
    collect: { by: 'farm', event: 'blight' },
    sprite: 'crops',
  },
]

/** What the player has done, as the Journal needs it. Missing parts mean "not yet". */
export type JournalProgress = {
  tiers: Set<string>
  kelp?: KelpPlay['seen']
  farm?: Partial<Record<FarmEvent, boolean>>
  alpine?: Partial<Record<AlpineEvent, boolean>>
}

export function isCollected(entry: Entry, p: JournalProgress): boolean {
  const c = entry.collect
  switch (c.by) {
    case 'tier':
      return p.tiers.has(c.tier)
    case 'kelp':
      return !!p.kelp?.[c.event]
    case 'farm':
      return !!p.farm?.[c.event]
    case 'alpine':
      return !!p.alpine?.[c.event]
  }
}

/** A line telling the player how to collect an entry they haven't yet. */
export function howToCollect(entry: Entry): string {
  const c = entry.collect
  switch (c.by) {
    case 'tier':
      return 'Collected when your garden reaches this tier of the Watershed.'
    case 'kelp':
      return {
        barren: 'Collected the first time a kelp forest you play collapses.',
        recovered: 'Collected the first time you bring a kelp forest back.',
        bigLeverage: 'Collected the first time the forest moves three times as much as you moved the otters.',
      }[c.event]
    case 'farm':
      return {
        saved: 'Collected the first time you save seed on the farm.',
        blight: 'Collected the first time a blight hits the farm.',
        diverse: 'Collected when you keep a farm with several varieties through a season.',
      }[c.event]
    case 'alpine':
      return {
        spread: 'Collected the first time a variant spreads through the pikas.',
        lost: 'Collected the first time a helpful variant is lost by chance.',
        declined: 'Collected the first time the pikas decline with no helpful variant.',
      }[c.event]
  }
}
