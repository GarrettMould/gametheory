export const STRATEGY_LOOK = {
  Copycat: {
    animal: 'Vampire Bat',
    temperament: 'watchful',
    coat: '#4a3f55',
    accent: '#8b6b9a',
    eye: '#c9f0ff',
    blurb: 'reads the other animal first, then mirrors what it just saw',
  },
  'All Cooperate': {
    animal: 'Dodo',
    temperament: 'open',
    coat: '#c4a574',
    accent: '#e8d5b0',
    eye: '#5a3d1a',
    blurb: 'keeps offering trust even when that trust has already been burned',
  },
  'All Cheat': {
    animal: 'Common Cuckoo',
    temperament: 'sharp',
    coat: '#3d4a3a',
    accent: '#7a8f55',
    eye: '#f0d45a',
    blurb: 'takes the opening whenever one appears and never apologizes for it',
  },
  Grudger: {
    animal: 'American Crow',
    temperament: 'guarded',
    coat: '#1f1f24',
    accent: '#5a5a68',
    eye: '#f4f1ea',
    blurb: 'cooperates once, then never forgets a slight',
  },
  Detective: {
    animal: 'Red Fox',
    temperament: 'testing',
    coat: '#b85a28',
    accent: '#e8a86a',
    eye: '#2a1a0a',
    blurb: 'probes for weakness, then settles into copycat or cheat for keeps',
  },
}

export const ADAPTATION_LOOK = {
  armor: {
    label: 'Thick Armor',
    animal: 'Pangolin',
    detail: 'overlapping plates that harden every territory fight',
  },
  reserves: {
    label: 'Fat Reserves',
    animal: 'Camel',
    detail: 'stored energy that softens the cost of being cheated while sharing',
  },
  pack: {
    label: 'Pack Calls',
    animal: 'African Wild Dog',
    detail: 'coordination marks that help a stag hunt land',
  },
  camouflage: {
    label: 'Camouflage',
    animal: 'Stonefish',
    detail: 'skin that can vanish into the ground for one second chance',
  },
}

export const TRAIT_ANIMALS = {
  'african-elephant': { animal: 'African Elephant', kind: 'bulk' },
  'saltwater-crocodile': { animal: 'Saltwater Crocodile', kind: 'reptile' },
  'red-deer': { animal: 'Red Deer', kind: 'antler' },
  gorilla: { animal: 'Gorilla', kind: 'ape' },
  'american-bison': { animal: 'American Bison', kind: 'bulk' },
  'komodo-dragon': { animal: 'Komodo Dragon', kind: 'reptile' },
  'fiddler-crab': { animal: 'Fiddler Crab', kind: 'claw' },
  'mantis-shrimp': { animal: 'Mantis Shrimp', kind: 'claw' },
  'honey-badger': { animal: 'Honey Badger', kind: 'stocky' },
  'bighorn-sheep': { animal: 'Bighorn Sheep', kind: 'horn' },
  'coconut-crab': { animal: 'Coconut Crab', kind: 'claw' },
  'emperor-penguin': { animal: 'Emperor Penguin', kind: 'insulated' },
  anglerfish: { animal: 'Anglerfish', kind: 'lure' },
  'galapagos-tortoise': { animal: 'Galápagos Tortoise', kind: 'shell' },
  'burmese-python': { animal: 'Burmese Python', kind: 'serpent' },
  'bar-tailed-godwit': { animal: 'Bar-tailed Godwit', kind: 'wing' },
  olm: { animal: 'Olm', kind: 'pale' },
  'three-toed-sloth': { animal: 'Three-toed Sloth', kind: 'slow' },
  koala: { animal: 'Koala', kind: 'round' },
  'black-bear': { animal: 'Black Bear', kind: 'bulk' },
  'arctic-fox': { animal: 'Arctic Fox', kind: 'fur' },
  'edible-dormouse': { animal: 'Edible Dormouse', kind: 'round' },
  cheetah: { animal: 'Cheetah', kind: 'sprint' },
  'peregrine-falcon': { animal: 'Peregrine Falcon', kind: 'wing' },
  'thomsons-gazelle': { animal: "Thomson's Gazelle", kind: 'sprint' },
  dragonfly: { animal: 'Dragonfly', kind: 'wing' },
  'brown-hare': { animal: 'Brown Hare', kind: 'sprint' },
  impala: { animal: 'Impala', kind: 'sprint' },
  meerkat: { animal: 'Meerkat', kind: 'alert' },
  'kangaroo-rat': { animal: 'Kangaroo Rat', kind: 'spring' },
  gecko: { animal: 'Gecko', kind: 'climb' },
  octopus: { animal: 'Octopus', kind: 'fluid' },
  hummingbird: { animal: 'Hummingbird', kind: 'wing' },
}

export function traitAnimals(traitCards = []) {
  return traitCards
    .map((id) => TRAIT_ANIMALS[id]?.animal)
    .filter(Boolean)
}

export function buildLook(creature) {
  const strategy = STRATEGY_LOOK[creature.archetype] || STRATEGY_LOOK.Copycat
  const adaptation =
    ADAPTATION_LOOK[creature.adaptation] || ADAPTATION_LOOK.armor
  const traits = (creature.traitCards || [])
    .map((id) => TRAIT_ANIMALS[id])
    .filter(Boolean)
  const size = Math.min(6, Math.max(1, Number(creature.size) || 3))
  const efficiency = Math.min(6, Math.max(1, Number(creature.efficiency) || 3))
  const agility = Math.min(6, Math.max(1, Number(creature.agility) || 3))

  return {
    strategy,
    adaptation,
    traits,
    size,
    efficiency,
    agility,
    scale: 0.95 + size * 0.16,
    legLength: 0.55 + agility * 0.12,
    torsoDepth: 0.55 + efficiency * 0.1,
    coat: strategy.coat,
    accent: strategy.accent,
    eye: strategy.eye,
  }
}
