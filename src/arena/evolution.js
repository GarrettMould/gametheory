import { playMatch } from './match.js'
import { createRng, deriveSeed } from './rng.js'
import { ADAPTATIONS, ARCHETYPES, mergeRules } from './rules.js'

export function runEvolution(creatures, options = {}) {
  const { seed = 1, ...settingOverrides } = options
  const rules = mergeRules(settingOverrides)
  const species = validateCreatures(creatures).map(summarize)
  const matchRng = createRng(deriveSeed(seed, 'matchups'))
  const noiseRng = createRng(deriveSeed(seed, 'season-noise'))
  const matchups = buildMatchupTable(species, matchRng, rules)

  const capacity = species.length * rules.startingCount
  const counts = Object.fromEntries(
    species.map((item) => [item.id, rules.startingCount]),
  )
  const seasons = [
    {
      season: 0,
      counts: { ...counts },
      food: {},
      extinct: [],
    },
  ]

  let living = species.map((item) => item.id)
  let stableStreak = 0
  let reason = 'max-seasons'
  let seasonsPlayed = 0

  for (let season = 1; season <= rules.maxSeasons; season += 1) {
    const previous = { ...counts }
    const food = expectedFood(living, counts, matchups)
    const average = weightedAverage(living, counts, food)

    for (const id of living) {
      const advantage = food[id] - average
      let growth = 1 + rules.selectionStrength * advantage
      if (growth < rules.minGrowthFactor) growth = rules.minGrowthFactor
      growth *= noiseFactor(noiseRng, rules.seasonNoise)
      counts[id] *= growth
    }

    rescale(counts, living, capacity)

    const newlyExtinct = []
    for (const id of living) {
      if (counts[id] < rules.extinctionThreshold) {
        counts[id] = 0
        newlyExtinct.push(id)
      }
    }

    living = living.filter((id) => counts[id] > 0)
    if (living.length > 0) rescale(counts, living, capacity)

    seasonsPlayed = season
    seasons.push({
      season,
      counts: { ...counts },
      food,
      extinct: newlyExtinct,
    })

    if (living.length <= 1) {
      reason = 'one-left'
      break
    }

    if (isStable(previous, counts, species, rules.stableTolerance)) {
      stableStreak += 1
      if (stableStreak >= rules.stableSeasons) {
        reason = 'stable'
        break
      }
    } else {
      stableStreak = 0
    }
  }

  const survivors = [...living].sort((a, b) => counts[b] - counts[a])

  return {
    seed,
    rules,
    species,
    matchups,
    seasons,
    result: {
      reason,
      seasonsPlayed,
      survivors,
      winner: reason === 'one-left' ? survivors[0] ?? null : null,
    },
  }
}

export function validateCreatures(creatures) {
  if (!Array.isArray(creatures) || creatures.length === 0) {
    throw new Error('runEvolution needs at least one creature.')
  }

  const seen = new Set()
  for (const creature of creatures) {
    if (!creature?.id) throw new Error('Each creature needs an id.')
    if (seen.has(creature.id)) {
      throw new Error(`Duplicate creature id: ${creature.id}`)
    }
    seen.add(creature.id)

    if (!ARCHETYPES.includes(creature.archetype)) {
      throw new Error(`Unknown archetype: ${creature.archetype}`)
    }
    if (!ADAPTATIONS.includes(creature.adaptation)) {
      throw new Error(`Unknown adaptation: ${creature.adaptation}`)
    }

    for (const stat of ['size', 'efficiency', 'agility']) {
      const value = creature[stat]
      if (!Number.isInteger(value) || value < 1 || value > 6) {
        throw new Error(`${creature.id} ${stat} must be an integer 1–6.`)
      }
    }
  }

  return creatures
}

function summarize(creature) {
  return {
    id: creature.id,
    speciesName: creature.speciesName,
    archetype: creature.archetype,
    size: creature.size,
    efficiency: creature.efficiency,
    agility: creature.agility,
    adaptation: creature.adaptation,
    period: creature.period,
  }
}

function emptyFood(arenas) {
  const avg = { total: 0 }
  for (const arena of arenas) avg[arena] = 0
  return avg
}

function addFood(target, points, arenas, weight = 1) {
  target.total += points.total * weight
  for (const arena of arenas) {
    target[arena] += (points[arena] ?? 0) * weight
  }
}

function scaleFood(avg, divisor) {
  const next = { ...avg }
  for (const key of Object.keys(next)) next[key] /= divisor
  return next
}

function sideFood(match, side, arenas) {
  const points = { total: match.totals[side] }
  for (const arena of arenas) {
    points[arena] = match.byArena[arena]?.[side] ?? 0
  }
  return points
}

function swapLog(log) {
  return log.map((entry) => ({
    ...entry,
    moves: [entry.moves[1], entry.moves[0]],
    points: [entry.points[1], entry.points[0]],
    rolls: swapRolls(entry.rolls),
  }))
}

function swapRolls(rolls) {
  const next = {}
  for (const [key, value] of Object.entries(rolls)) {
    if (key.startsWith('a')) next[`b${key.slice(1)}`] = value
    else if (key.startsWith('b')) next[`a${key.slice(1)}`] = value
    else next[key] = value
  }
  return next
}

function buildMatchupTable(species, rng, rules) {
  const ordered = [...species].sort((a, b) => a.id.localeCompare(b.id))
  const matchups = Object.fromEntries(ordered.map((item) => [item.id, {}]))
  const n = rules.matchesPerPair
  const arenas = rules.arenas

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i; j < ordered.length; j += 1) {
      const a = ordered[i]
      const b = ordered[j]
      const sumA = emptyFood(arenas)
      const sumB = emptyFood(arenas)
      let sampleLog = null

      for (let m = 0; m < n; m += 1) {
        const match = playMatch(a, b, rng, rules)
        if (m === 0) sampleLog = match.log
        addFood(sumA, sideFood(match, 0, arenas), arenas)
        addFood(sumB, sideFood(match, 1, arenas), arenas)
      }

      if (a.id === b.id) {
        const combined = emptyFood(arenas)
        addFood(combined, sumA, arenas)
        addFood(combined, sumB, arenas)
        matchups[a.id][a.id] = {
          avgFood: scaleFood(combined, n * 2),
          sampleLog,
        }
      } else {
        matchups[a.id][b.id] = {
          avgFood: scaleFood(sumA, n),
          sampleLog,
        }
        matchups[b.id][a.id] = {
          avgFood: scaleFood(sumB, n),
          sampleLog: swapLog(sampleLog),
        }
      }
    }
  }

  return matchups
}

function expectedFood(living, counts, matchups) {
  const total = living.reduce((sum, id) => sum + counts[id], 0)
  const food = {}
  for (const id of living) {
    let value = 0
    for (const other of living) {
      value += (counts[other] / total) * matchups[id][other].avgFood.total
    }
    food[id] = value
  }
  return food
}

function weightedAverage(living, counts, food) {
  const total = living.reduce((sum, id) => sum + counts[id], 0)
  return living.reduce((sum, id) => sum + food[id] * (counts[id] / total), 0)
}

function noiseFactor(rng, noise) {
  if (!noise) return 1
  return 1 - noise + rng() * 2 * noise
}

function rescale(counts, living, capacity) {
  const total = living.reduce((sum, id) => sum + counts[id], 0)
  if (total <= 0) return
  const factor = capacity / total
  for (const id of living) counts[id] *= factor
}

function isStable(previous, current, species, tolerance) {
  return species.every((item) => {
    const before = previous[item.id] ?? 0
    const after = current[item.id] ?? 0
    if (before === 0 && after === 0) return true
    if (before === 0) return false
    return Math.abs(after - before) <= tolerance * before
  })
}
