const DETECTIVE_OPENING = [
  'cooperate',
  'cheat',
  'cooperate',
  'cooperate',
]

export function chooseMove(archetype, history, round) {
  switch (archetype) {
    case 'All Cooperate':
      return 'cooperate'
    case 'All Cheat':
      return 'cheat'
    case 'Copycat':
      return copycatMove(history, round)
    case 'Grudger':
      return history.includes('cheat') ? 'cheat' : 'cooperate'
    case 'Detective':
      return detectiveMove(history, round)
    default:
      throw new Error(`Unknown archetype: ${archetype}`)
  }
}

function copycatMove(history, round) {
  if (round <= 1) return 'cooperate'
  return history[round - 2] ?? 'cooperate'
}

function detectiveMove(history, round) {
  if (round <= 4) return DETECTIVE_OPENING[round - 1]
  const probed = history.slice(0, 4)
  if (probed.includes('cheat')) return copycatMove(history, round)
  return 'cheat'
}
