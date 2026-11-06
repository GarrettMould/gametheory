import { runEvolution } from './evolution.js'
import { FIXTURES } from './fixtures.js'

const SEEDS = 20

function highestStat(creature) {
  const scores = {
    Size: creature.size,
    Efficiency: creature.efficiency,
    Agility: creature.agility,
  }
  const max = Math.max(...Object.values(scores))
  const names = Object.keys(scores).filter((name) => scores[name] === max)
  return names.length === 1 ? names[0] : 'tied'
}

function pad(value, width) {
  return String(value).padEnd(width)
}

const strategyWins = {}
const statWins = {}
const rows = []

for (let seed = 1; seed <= SEEDS; seed += 1) {
  const run = runEvolution(FIXTURES, { seed })
  const { reason, seasonsPlayed, winner, survivors } = run.result
  const final = run.seasons[run.seasons.length - 1].counts
  const byId = Object.fromEntries(run.species.map((item) => [item.id, item]))

  const winnerLabel = winner
    ? `${byId[winner].speciesName} (${byId[winner].archetype})`
    : survivors.map((id) => `${byId[id].speciesName}`).join(', ')

  const counts = run.species
    .map((item) => `${item.speciesName} ${final[item.id].toFixed(1)}`)
    .join(' | ')

  rows.push({
    seed,
    seasonsPlayed,
    reason,
    winnerLabel,
    counts,
  })

  const credited = winner ? [winner] : survivors.slice(0, 1)
  for (const id of credited) {
    const creature = byId[id]
    strategyWins[creature.archetype] = (strategyWins[creature.archetype] ?? 0) + 1
    const stat = highestStat(creature)
    statWins[stat] = (statWins[stat] ?? 0) + 1
  }

  console.log(
    `seed ${String(seed).padStart(2)}  seasons ${String(seasonsPlayed).padStart(2)}  ${pad(reason, 12)}  ${winnerLabel}`,
  )
  console.log(`         ${counts}`)
}

console.log('\nStrategy wins (winner, or largest survivor if mixed):')
for (const [name, count] of Object.entries(strategyWins).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(name, 16)} ${count}`)
}

console.log('\nHighest-stat wins:')
for (const [name, count] of Object.entries(statWins).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(name, 16)} ${count}`)
}
