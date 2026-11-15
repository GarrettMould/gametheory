/** Maps Firestore / arena creatures into the shape creaturesupdate expects. */
import { ROSTER } from '../creaturesupdate/roster.js'

const rosterByName = Object.fromEntries(
  ROSTER.map((row) => [row.name.toLowerCase(), row]),
)

const TRAIT_ANIMALS = {
  'african-elephant': 'African Elephant',
  'saltwater-crocodile': 'Saltwater Crocodile',
  'red-deer': 'Red Deer',
  gorilla: 'Gorilla',
  'american-bison': 'American Bison',
  'komodo-dragon': 'Komodo Dragon',
  'fiddler-crab': 'Fiddler Crab',
  'mantis-shrimp': 'Mantis Shrimp',
  'honey-badger': 'Honey Badger',
  'bighorn-sheep': 'Bighorn Sheep',
  'coconut-crab': 'Coconut Crab',
  'emperor-penguin': 'Emperor Penguin',
  anglerfish: 'Anglerfish',
  'galapagos-tortoise': 'Galápagos Tortoise',
  'burmese-python': 'Burmese Python',
  'bar-tailed-godwit': 'Bar-tailed Godwit',
  olm: 'Olm',
  'three-toed-sloth': 'Three-toed Sloth',
  koala: 'Koala',
  'black-bear': 'Black Bear',
  'arctic-fox': 'Arctic Fox',
  'edible-dormouse': 'Edible Dormouse',
  cheetah: 'Cheetah',
  'peregrine-falcon': 'Peregrine Falcon',
  'thomsons-gazelle': "Thomson's Gazelle",
  dragonfly: 'Dragonfly',
  'brown-hare': 'Brown Hare',
  impala: 'Impala',
  meerkat: 'Meerkat',
  'kangaroo-rat': 'Kangaroo Rat',
  gecko: 'Gecko',
  octopus: 'Octopus',
  hummingbird: 'Hummingbird',
}

const ADAPTATION_LABEL = {
  armor: 'Armor',
  reserves: 'Reserves',
  pack: 'Pack',
  camouflage: 'Camouflage',
  Armor: 'Armor',
  Reserves: 'Reserves',
  Pack: 'Pack',
  Camouflage: 'Camouflage',
}

export function animalsFromTraitCards(traitCards = []) {
  return traitCards
    .map((id) => TRAIT_ANIMALS[id] || null)
    .filter(Boolean)
}

export function toBattleCreature(creature) {
  if (!creature) return null
  const speciesName = creature.speciesName || creature.name || ''
  const roster = rosterByName[String(speciesName).toLowerCase()]
  const animals =
    roster?.animals ||
    (Array.isArray(creature.animals) && creature.animals.length
      ? creature.animals
      : animalsFromTraitCards(creature.traitCards))
  const adaptation =
    roster?.adaptation ||
    ADAPTATION_LABEL[creature.adaptation] ||
    creature.adaptation ||
    ''
  const strategy =
    roster?.strategy || creature.archetype || creature.strategy || ''
  const size = Number(creature.size ?? roster?.stats?.size) || 3
  const efficiency =
    Number(creature.efficiency ?? roster?.stats?.efficiency) || 3
  const agility = Number(creature.agility ?? roster?.stats?.agility) || 3

  return {
    speciesName,
    animals,
    adaptation,
    strategy,
    size,
    efficiency,
    agility,
    stats: { size, efficiency, agility },
  }
}
