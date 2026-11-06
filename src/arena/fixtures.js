import { createRng } from './rng.js'
import { ADAPTATIONS, ARCHETYPES } from './rules.js'

function creature(id, speciesName, archetype, size, efficiency, agility, adaptation) {
  return {
    id,
    speciesName,
    period: 'E',
    archetype,
    size,
    efficiency,
    agility,
    adaptation,
  }
}

export const FIXTURES = [
  creature('nightveil-bat', 'Nightveil Bat', 'Copycat', 2, 5, 3, 'reserves'),
  creature('plain-dodo', 'Plain Dodo', 'All Cooperate', 2, 6, 2, 'reserves'),
  creature('brood-cuckoo', 'Brood Cuckoo', 'All Cheat', 6, 1, 3, 'armor'),
  creature('iron-crow', 'Iron Crow', 'Grudger', 5, 1, 4, 'pack'),
  creature('brush-fox', 'Brush Fox', 'Detective', 1, 4, 5, 'camouflage'),
  creature('painted-dog', 'Painted Dog', 'Copycat', 4, 3, 3, 'pack'),
]

const SAMPLE_NAMES = [
  'Ash Fox',
  'River Otter',
  'Storm Crow',
  'Sand Cat',
  'Pine Marten',
  'Reef Shark',
  'Moss Elk',
  'Ember Hawk',
  'Kelp Seal',
  'Dune Wolf',
  'Ivory Crane',
  'Thorn Boar',
  'Mist Lynx',
  'Copper Toad',
  'Gale Tern',
  'Bramble Bear',
  'Quartz Crab',
  'Cinder Moth',
  'Pebble Goat',
  'Tide Heron',
  'Lichen Owl',
  'Sable Hare',
  'Forge Ant',
  'Willow Deer',
]

export function makeRandomClass(seed = Date.now()) {
  const rng = createRng(Number(seed) || Date.now())
  const names = shuffle(SAMPLE_NAMES, rng).slice(0, 6)
  const archetypes = pickSix(ARCHETYPES, rng, true)
  const adaptations = pickSix(ADAPTATIONS, rng, false)

  return names.map((speciesName, index) => {
    const stats = randomStats(rng)
    return {
      id: `sample-${slug(speciesName)}`,
      speciesName,
      period: 'sample',
      archetype: archetypes[index],
      adaptation: adaptations[index],
      ...stats,
    }
  })
}

function pickSix(options, rng, coverAll) {
  const bag = shuffle(options, rng)
  const picked = coverAll ? [...bag] : []
  while (picked.length < 6) {
    picked.push(options[Math.floor(rng() * options.length)])
  }
  return shuffle(picked, rng).slice(0, 6)
}

function randomStats(rng) {
  const stats = [1, 1, 1]
  let left = 7
  let guard = 0
  while (left > 0 && guard < 40) {
    const index = Math.floor(rng() * 3)
    if (stats[index] < 6) {
      stats[index] += 1
      left -= 1
    }
    guard += 1
  }
  return { size: stats[0], efficiency: stats[1], agility: stats[2] }
}

function shuffle(list, rng) {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  return next
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
