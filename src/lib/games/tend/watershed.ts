/**
 * The Watershed: California in cross-section, from the alpine peaks to the
 * deep-sea floor. Each tier is a small food web plus one lesson and, where a
 * source supports it, one kitchen card (how something from this tier reaches a
 * plate).
 *
 * Every sentence a player reads comes from the source linked beside it, and
 * all of it is a Learning Mode surface that Brooks reviews before it ships.
 * Facts that change year to year (fishing seasons, seafood ratings) are left
 * out on purpose; the kitchen cards link to the agencies that keep them current.
 */

export type Role = 'energy' | 'producer' | 'grazer' | 'predator' | 'recycler'

/** Trophic column for the food-web diagram: energy sources left, top predators right. */
export const ROLE_LEVEL: Record<Role, number> = { energy: 0, producer: 1, grazer: 2, predator: 3, recycler: 2 }

export const ROLE_LABEL: Record<Role, string> = {
  energy: 'Energy source',
  producer: 'Producer',
  grazer: 'Grazer',
  predator: 'Predator',
  recycler: 'Recycler',
}

export type SpriteId =
  | 'sun' | 'flower' | 'pika' | 'pine' | 'nutcracker' | 'oak' | 'caterpillar' | 'moth' | 'datura'
  | 'snowmelt' | 'crops' | 'plate' | 'phyto' | 'mussel' | 'kelp' | 'urchin' | 'otter' | 'krill'
  | 'whale' | 'zooplankton' | 'lanternfish' | 'snow' | 'seacucumber' | 'seep' | 'tubeworm'

export type Resident = {
  id: string
  name: string
  role: Role
  sprite: SpriteId
  /** One sourced sentence. */
  line: string
  source: string
}

export type Card = { title: string; body: string; source: string; sourceLabel: string }

export type Light = 'full' | 'dim' | 'none'

export type Tier = {
  id: string
  name: string
  /** Where it sits: elevation above or depth below sea level. */
  span: string
  light: Light
  /** Band colours for the cross-section, top and bottom. */
  colors: [string, string]
  residents: Resident[]
  /** [eater, eaten]: energy flows from the eaten to the eater. */
  eats: [string, string][]
  lesson: Card
  kitchen?: Card
  /** Unlock order, counted outward from the garden (0 = always open). */
  unlock: number
}

const SRC = {
  pikaBrief: 'https://www.nps.gov/articles/pikas-brief.htm',
  snowpack: 'https://www.nps.gov/yose/learn/nature/ccsnowpack.htm',
  whitebark: 'https://www.nps.gov/articles/conserving-whitebark-pine-and-clarks-nutcrackers.htm',
  oak: 'https://calscape.org/Quercus-agrifolia-(Coast-Live-Oak)',
  datura: 'https://calscape.org/Datura-wrightii-(Jimsonweed)',
  acorns: 'https://www.nps.gov/yose/learn/historyculture/plant-use.htm',
  cdfa: 'https://www.cdfa.ca.gov/Statistics/',
  oxygen: 'https://oceanservice.noaa.gov/facts/ocean-oxygen.html',
  mussels: 'https://www.cdph.ca.gov/Programs/OPA/Pages/SN25-006.aspx',
  kelp: 'https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest',
  blueWhale: 'https://www.fisheries.noaa.gov/species/blue-whale',
  tenPercent: 'https://education.nationalgeographic.org/resource/energy-flow-and-10-percent-rule/',
  fdaFish: 'https://www.fda.gov/food/consumers/advice-about-eating-fish',
  zones: 'https://www.whoi.edu/ocean-elevator/index.html',
  marineSnow: 'https://oceanservice.noaa.gov/facts/marinesnow.html',
  seeps: 'https://oceanexplorer.noaa.gov/education/cold-seeps/',
  chemo: 'https://oceanexplorer.noaa.gov/exploration-extras/24-national-ocean-month/',
} as const

export const TIERS: Tier[] = [
  {
    id: 'alpine',
    name: 'Alpine peaks',
    span: 'Above the treeline',
    light: 'full',
    colors: ['#c9dcef', '#a9bcc9'],
    unlock: 4,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'meadow', name: 'Alpine meadow plants', role: 'producer', sprite: 'flower', line: 'Pikas live among rock piles beside meadows with the plants they need.', source: SRC.pikaBrief },
      { id: 'pika', name: 'American pika', role: 'grazer', sprite: 'pika', line: 'Pikas don’t hibernate. They gather plants into “haypiles” to last a nine-month alpine winter.', source: SRC.pikaBrief },
    ],
    eats: [['meadow', 'sun'], ['pika', 'meadow']],
    lesson: {
      title: 'Built for cold, not for heat',
      body: 'A pika’s body runs at about 104°F, and 109°F can kill it, so hot days push it under the rocks instead of out foraging. In Great Basin surveys, pikas had vanished from 44% of sites where they were once abundant.',
      source: SRC.pikaBrief,
      sourceLabel: 'NPS: pikas resource brief',
    },
    kitchen: {
      title: 'Snow is the start of dinner',
      body: 'About 60% of California’s fresh water comes straight from the Sierra Nevada snowpack. As the peaks warm, more winter snow falls as rain and the spring melt comes early.',
      source: SRC.snowpack,
      sourceLabel: 'NPS Yosemite: snowpack',
    },
  },
  {
    id: 'subalpine',
    name: 'Subalpine forest',
    span: 'Near the treeline',
    light: 'full',
    colors: ['#9fb9a7', '#7f9f86'],
    unlock: 2,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'whitebark', name: 'Whitebark pine', role: 'producer', sprite: 'pine', line: 'Its seedlings sprout almost exclusively from seeds that Clark’s nutcrackers buried.', source: SRC.whitebark },
      { id: 'nutcracker', name: 'Clark’s nutcracker', role: 'grazer', sprite: 'nutcracker', line: 'Buries whitebark pine seeds in caches, and those caches are where new pines sprout.', source: SRC.whitebark },
    ],
    eats: [['whitebark', 'sun'], ['nutcracker', 'whitebark']],
    lesson: {
      title: 'Partners, not just predator and prey',
      body: 'Whitebark pine depends on Clark’s nutcracker: its seedlings come almost entirely from the bird’s seed caches, a relationship biologists call an obligate mutualism. As of 2015, white pine blister rust infected 51% and 64% of the living whitebark pines in North Cascades and Mount Rainier national parks, and nutcracker numbers there appear to be falling too.',
      source: SRC.whitebark,
      sourceLabel: 'NPS: whitebark pine and nutcrackers',
    },
  },
  {
    id: 'woodland',
    name: 'Oak woodland',
    span: 'The foothills: your garden',
    light: 'full',
    colors: ['#6f8f5f', '#566f49'],
    unlock: 0,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'oak', name: 'Coast live oak', role: 'producer', sprite: 'oak', line: 'A caterpillar host for 265 native butterfly and moth species; more than 270 species rely on it.', source: SRC.oak },
      { id: 'datura', name: 'Sacred datura', role: 'producer', sprite: 'datura', line: 'Opens its flowers near full dark for night pollinators.', source: SRC.datura },
      { id: 'caterpillar', name: 'Caterpillars', role: 'grazer', sprite: 'caterpillar', line: 'The caterpillars of 265 native moth and butterfly species feed on coast live oak.', source: SRC.oak },
      { id: 'moth', name: 'Sphinx moth', role: 'grazer', sprite: 'moth', line: 'The white-lined sphinx, a hawk moth, visits datura flowers at night.', source: SRC.datura },
    ],
    eats: [['oak', 'sun'], ['datura', 'sun'], ['caterpillar', 'oak'], ['moth', 'datura']],
    lesson: {
      title: 'One tree, a whole neighbourhood',
      body: 'A single coast live oak can live more than 250 years and feeds the caterpillars of 265 native butterfly and moth species. Planting natives isn’t decoration: it is food for everything above them in the chain.',
      source: SRC.oak,
      sourceLabel: 'Calscape: coast live oak',
    },
    kitchen: {
      title: 'Acorns, the original California staple',
      body: 'In Yosemite, Native Californians preferred black oak acorns. They pounded them into flour, leached the flour with water to remove the bitter tannins, and cooked it into mush. Acorns were stored in granaries called chuckahs, and some local Native people still make acorn mush for special occasions.',
      source: SRC.acorns,
      sourceLabel: 'NPS Yosemite: plant use',
    },
  },
  {
    id: 'valley',
    name: 'Central Valley farms',
    span: 'The valley floor',
    light: 'full',
    colors: ['#c7b66e', '#a8954f'],
    unlock: 1,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'snowmelt', name: 'Snowmelt', role: 'energy', sprite: 'snowmelt', line: 'Most of the valley’s farm water starts as Sierra snow.', source: SRC.snowpack },
      { id: 'crops', name: 'Crops', role: 'producer', sprite: 'crops', line: 'Almonds, grapes, lettuce, pistachios, strawberries, carrots and tomatoes are among the state’s top ten.', source: SRC.cdfa },
      { id: 'you', name: 'You', role: 'grazer', sprite: 'plate', line: 'Every plate is the last link in a chain that started as sunlight and snow.', source: SRC.cdfa },
    ],
    eats: [['crops', 'sun'], ['crops', 'snowmelt'], ['you', 'crops']],
    lesson: {
      title: 'The nation’s produce aisle',
      body: 'Nearly half of the country’s vegetables and over three-quarters of its fruits and nuts are grown in California (2025 crop year). The top earners were dairy, almonds, cattle, grapes and lettuce.',
      source: SRC.cdfa,
      sourceLabel: 'CDFA: agricultural statistics',
    },
    kitchen: {
      title: 'From the snow to your salad',
      body: '75% of California’s farm water comes straight from the Sierra Nevada snowpack. The almonds, strawberries and lettuce grown down here started as snow on the peaks.',
      source: SRC.snowpack,
      sourceLabel: 'NPS Yosemite: snowpack',
    },
  },
  {
    id: 'coast',
    name: 'Tidepools',
    span: 'Where the land meets the sea',
    light: 'full',
    colors: ['#7fb6b9', '#5d9aa2'],
    unlock: 3,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'phyto', name: 'Phytoplankton', role: 'producer', sprite: 'phyto', line: 'Drifting algae and bacteria that make most of the ocean’s oxygen.', source: SRC.oxygen },
      { id: 'mussel', name: 'Mussels', role: 'grazer', sprite: 'mussel', line: 'Eat phytoplankton, including the kinds that make natural toxins.', source: SRC.mussels },
    ],
    eats: [['phyto', 'sun'], ['mussel', 'phyto']],
    lesson: {
      title: 'What the mussel eats, you eat',
      body: 'Some phytoplankton make natural toxins. Shellfish that eat them carry the toxins up the chain, which can cause paralytic shellfish poisoning or domoic acid poisoning in people.',
      source: SRC.mussels,
      sourceLabel: 'CDPH: annual mussel quarantine',
    },
    kitchen: {
      title: 'Check before you pick',
      body: 'Every year from May 1, California quarantines sport-harvested mussels along the whole coast, bays and estuaries included; during it they may only be used as bait. Cooking does not destroy the toxins. Shellfish sold by state-certified harvesters and dealers get frequent mandatory testing.',
      source: SRC.mussels,
      sourceLabel: 'CDPH: annual mussel quarantine',
    },
  },
  {
    id: 'kelp',
    name: 'Kelp forest',
    span: 'Shallow rocky reefs',
    light: 'full',
    colors: ['#3f8f86', '#2f7470'],
    unlock: 5,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'kelp', name: 'Giant kelp', role: 'producer', sprite: 'kelp', line: 'Can grow up to 2 feet a day and reach 175 feet tall.', source: SRC.kelp },
      { id: 'urchin', name: 'Purple urchin', role: 'grazer', sprite: 'urchin', line: 'Left unchecked, urchins can strip a forest bare into an “urchin barren”.', source: SRC.kelp },
      { id: 'otter', name: 'Sea otter', role: 'predator', sprite: 'otter', line: 'A keystone species: by eating urchins, otters keep the kelp standing.', source: SRC.kelp },
    ],
    eats: [['kelp', 'sun'], ['urchin', 'kelp'], ['otter', 'urchin']],
    lesson: {
      title: 'Take one animal out, lose the forest',
      body: 'Where otters are abundant, kelp tends to thrive; without them, urchins multiply until little kelp remains. After the 2014 marine heatwave and a surge of purple urchins, roughly 95% of Northern California’s kelp forests disappeared. Scientists call this chain reaction a trophic cascade.',
      source: SRC.kelp,
      sourceLabel: 'Monterey Bay Aquarium: kelp forests',
    },
  },
  {
    id: 'open',
    name: 'Open ocean',
    span: 'Sunlit zone, 0 to 200 m',
    light: 'full',
    colors: ['#2d6f9c', '#235a83'],
    unlock: 6,
    residents: [
      { id: 'sun', name: 'Sunlight', role: 'energy', sprite: 'sun', line: 'Sunlight powers photosynthesis, where most food chains begin.', source: SRC.zones },
      { id: 'phyto', name: 'Phytoplankton', role: 'producer', sprite: 'phyto', line: 'One tiny kind, Prochlorococcus, makes up to 20% of the oxygen in the biosphere.', source: SRC.oxygen },
      { id: 'krill', name: 'Krill', role: 'grazer', sprite: 'krill', line: 'Small crustaceans that are nearly all of a blue whale’s diet.', source: SRC.blueWhale },
      { id: 'whale', name: 'Blue whale', role: 'predator', sprite: 'whale', line: 'The biggest may eat up to 6 tons of krill a day; North Pacific blues feed off the West Coast in summer.', source: SRC.blueWhale },
    ],
    eats: [['phyto', 'sun'], ['krill', 'phyto'], ['whale', 'krill']],
    lesson: {
      title: 'The 10% rule',
      body: 'On average only about 10% of the energy at one level of a food chain reaches the next; the rest escapes as heat, waste, and things that die uneaten.',
      source: SRC.tenPercent,
      sourceLabel: 'National Geographic: the 10% rule',
    },
    kitchen: {
      title: 'Eat low on the chain',
      body: 'Sardines and anchovies are on the FDA’s “Best Choices” list. Fish brings omega-3 fats (DHA and EPA), protein, vitamin B12, vitamin D and selenium, and the Dietary Guidelines suggest at least 8 ounces of seafood a week for adults.',
      source: SRC.fdaFish,
      sourceLabel: 'FDA: advice about eating fish',
    },
  },
  {
    id: 'twilight',
    name: 'Twilight zone',
    span: '200 to 1,000 m',
    light: 'dim',
    colors: ['#1b3f66', '#142f4f'],
    unlock: 7,
    residents: [
      { id: 'snow', name: 'Food from above', role: 'energy', sprite: 'snow', line: 'Light here is too weak for photosynthesis; marine snow sinking from above is a critical food source for the deep ocean.', source: SRC.chemo },
      { id: 'zoo', name: 'Zooplankton', role: 'grazer', sprite: 'zooplankton', line: 'Rise toward the surface at night to feed and sink again at dawn.', source: SRC.zones },
      { id: 'lantern', name: 'Lanternfish', role: 'predator', sprite: 'lanternfish', line: 'A glowing fish with 246 species in its family; it rises to the surface at night.', source: SRC.zones },
    ],
    eats: [['zoo', 'snow'], ['lantern', 'zoo']],
    lesson: {
      title: 'The biggest migration on Earth',
      body: 'Every night, animals from the twilight zone rise toward the surface to feed and sink back at dawn: diel vertical migration, often called the largest migration of animal life on Earth. This zone may hold more biomass than the rest of the ocean combined, and glowing light (bioluminescence) is common.',
      source: SRC.zones,
      sourceLabel: 'WHOI: ocean zones',
    },
  },
  {
    id: 'deep',
    name: 'Deep sea floor',
    span: '1,000 m and below',
    light: 'none',
    colors: ['#0e2238', '#081525'],
    unlock: 8,
    residents: [
      { id: 'snow', name: 'Marine snow', role: 'energy', sprite: 'snow', line: 'Dead plants, animals and waste drifting down for weeks, growing as they fall.', source: SRC.marineSnow },
      { id: 'seep', name: 'Seep chemicals', role: 'energy', sprite: 'seep', line: 'Methane and hydrogen sulfide seeping up through cracks in the seafloor.', source: SRC.seeps },
      { id: 'cucumber', name: 'Sea cucumbers', role: 'recycler', sprite: 'seacucumber', line: 'Deep-sea animals filter marine snow from the water or scavenge it from the seabed.', source: SRC.marineSnow },
      { id: 'tubeworm', name: 'Tubeworms', role: 'grazer', sprite: 'tubeworm', line: 'Dense fields of tubeworms have been found at cold seeps more than 2,000 m down.', source: SRC.seeps },
    ],
    eats: [['cucumber', 'snow'], ['tubeworm', 'seep']],
    lesson: {
      title: 'Life without the sun',
      body: 'At cold seeps and hydrothermal vents, microbes make food from chemical energy instead of light (chemosynthesis), feeding whole communities in the dark.',
      source: SRC.chemo,
      sourceLabel: 'NOAA Ocean Exploration: meet the deep',
    },
  },
]

/** Index of the tier the sea surface sits above (the first ocean tier). */
export const SEA_LEVEL_INDEX = TIERS.findIndex((t) => t.id === 'coast')

export type GardenProgress = { notes: number; seasons: number }

/** Tiers open outward from the garden: one more for every field note or season weathered. */
export function unlockedTiers(progress: GardenProgress): Set<string> {
  const reach = progress.notes + progress.seasons
  return new Set(TIERS.filter((t) => t.unlock <= reach).map((t) => t.id))
}

/** How many more milestones until a tier opens. */
export function stepsToUnlock(tier: Tier, progress: GardenProgress): number {
  return Math.max(0, tier.unlock - (progress.notes + progress.seasons))
}
