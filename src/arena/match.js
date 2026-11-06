import { playRound } from './games.js'
import { chooseMove } from './strategies.js'

export function playMatch(a, b, rng, rules) {
  const totals = [0, 0]
  const byArena = {}
  const log = []

  for (const arena of rules.arenas) {
    byArena[arena] = [0, 0]
    const historyA = []
    const historyB = []
    const state = { camouflageUsedA: false, camouflageUsedB: false }

    for (let round = 1; round <= rules.roundsPerArena; round += 1) {
      const moveA = chooseMove(a.archetype, historyA, round)
      const moveB = chooseMove(b.archetype, historyB, round)
      const result = playRound(arena, a, b, moveA, moveB, rng, state, rules)

      totals[0] += result.points[0]
      totals[1] += result.points[1]
      byArena[arena][0] += result.points[0]
      byArena[arena][1] += result.points[1]

      log.push({
        arena,
        round,
        moves: [moveA, moveB],
        rolls: result.rolls,
        points: result.points,
        note: result.note,
      })

      historyA.push(moveB)
      historyB.push(moveA)
    }
  }

  return { totals, byArena, log }
}
