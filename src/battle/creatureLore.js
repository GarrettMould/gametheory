import {
  ADAPTATION_LOOK,
  STRATEGY_LOOK,
  traitAnimals,
} from './creatureCatalog.js'

function cleanStory(story) {
  const text = String(story || '').trim()
  if (text.length < 8) return ''
  if (/^(sngdfjgd|asdf+|test+|n\/?a|none|\.+)$/i.test(text)) return ''
  return text
}

function joinAnimals(animals) {
  if (animals.length === 0) return 'unknown ancestors'
  if (animals.length === 1) return animals[0]
  if (animals.length === 2) return `${animals[0]} and ${animals[1]}`
  return `${animals.slice(0, -1).join(', ')}, and ${animals[animals.length - 1]}`
}

function buildGeneratedStory(creature) {
  const strategy = STRATEGY_LOOK[creature.archetype] || STRATEGY_LOOK.Copycat
  const adaptation =
    ADAPTATION_LOOK[creature.adaptation] || ADAPTATION_LOOK.armor
  const animals = traitAnimals(creature.traitCards)
  const size = Number(creature.size) || 3
  const efficiency = Number(creature.efficiency) || 3
  const agility = Number(creature.agility) || 3

  const buildLine =
    size >= 5
      ? 'Its frame is heavy enough to own a clearing.'
      : size <= 2
        ? 'Its frame is compact, built to slip through gaps.'
        : 'Its frame sits in the middle of the pack — strong without wasting motion.'

  const fuelLine =
    efficiency >= 5
      ? 'It burns almost nothing while it waits.'
      : efficiency <= 2
        ? 'It burns energy fast and has to eat well to stay in the fight.'
        : 'It can share a meal without collapsing, but it still feels the cost.'

  const speedLine =
    agility >= 5
      ? 'When trouble starts, it is usually already moving.'
      : agility <= 2
        ? 'It does not win by speed — it wins by standing its ground.'
        : 'It can turn, flee, or close a gap when the bout demands it.'

  return [
    `${creature.speciesName || 'This creature'} was fused from ${joinAnimals(animals)}.`,
    `Its mind follows a ${creature.archetype || 'Copycat'} strategy: it ${strategy.blurb}.`,
    `Along the spine runs ${adaptation.label.toLowerCase()} borrowed from the ${adaptation.animal} — ${adaptation.detail}.`,
    buildLine,
    fuelLine,
    speedLine,
  ].join(' ')
}

export function creatureStory(creature) {
  return cleanStory(creature.story) || buildGeneratedStory(creature)
}

export function creatureTagline(creature) {
  const strategy = STRATEGY_LOOK[creature.archetype]
  const adaptation = ADAPTATION_LOOK[creature.adaptation]
  const animals = (
    Array.isArray(creature.animals) && creature.animals.length
      ? creature.animals
      : traitAnimals(creature.traitCards)
  ).slice(0, 2)
  const parts = [
    creature.archetype,
    adaptation?.label,
    animals.length ? animals.join(' · ') : null,
  ].filter(Boolean)
  return parts.join(' · ') || strategy?.animal || 'Classroom creature'
}
