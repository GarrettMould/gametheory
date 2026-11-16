// The end-of-game debrief: what the player did and why it went the way it did, worked out from a log
// of the game. Pure functions, so they can be checked without a browser.
import { ALL_GAMES, STARVING_LOSS } from './challenge.js'

const round1 = (value) => Math.round(value * 10) / 10
const signed = (value) => `${value > 0 ? '+' : ''}${round1(value)}`
const ordinal = (n) => {
  const tail = n % 100
  if (tail >= 11 && tail <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}
const plural = (strategy) => (strategy.startsWith('All') ? `${strategy} animals` : `${strategy}s`)

/** One question for the class to talk about, by the strategy the player was stuck with. */
const DISCUSS = {
  'All Cheat': 'Grabbing pays against animals that never hit back. What happened to you once they were gone, or once the others had seen what you do?',
  'All Cooperate': 'You never hit back. Who took advantage of that, and what could a kind strategy do to protect itself?',
  Copycat: 'You copy whatever the other animal did last. Against which strategies did that protect you, and where did it lock you into a fight?',
  Grudger: 'One cross and you never forgive. When did that protect you, and when did it cost you a partner you could have used?',
  Detective: 'You test everyone before deciding. Which opponents punished the test, and which let you get away with it?',
}

/** Average of how far above or below par the player landed, grouped by `key(challenge)`. */
function averages(challenges, key, label) {
  const groups = new Map()
  for (const challenge of challenges) {
    const k = key(challenge)
    const group = groups.get(k) || { name: label(k), games: 0, total: 0 }
    group.games += 1
    group.total += challenge.mine - challenge.par
    groups.set(k, group)
  }
  return [...groups.values()]
    .map((group) => ({ ...group, average: group.total / group.games }))
    .sort((a, b) => b.average - a.average)
}

/**
 * `log` is { challenges: [{ round, opponent, strategy, game, mine, theirs, par, caught, predicted, correct }],
 * berries, starved, blocked } and `ending` is { won, round, rank, alive } (rank among `alive`
 * living species when the game ended). `strategy` is the player's own.
 * Returns { title, placement, facts: [text], best, worst, byStrategy, byGame, takeaway, discuss }.
 */
export function buildDebrief({ name, strategy, log, ending }) {
  const { challenges } = log
  const caught = challenges.filter((challenge) => challenge.caught).length
  const describe = (challenge) =>
    challenge && {
      text: `${ALL_GAMES[challenge.game].name} against ${challenge.opponent} (${challenge.strategy})`,
      detail: `${challenge.mine} food, ${signed(challenge.mine - challenge.par)} against a typical animal`,
    }
  const ranked = [...challenges].sort((a, b) => b.mine - b.par - (a.mine - a.par))
  const byStrategy = averages(challenges, (c) => c.strategy, (k) => k)
  const byGame = averages(challenges, (c) => c.game, (k) => ALL_GAMES[k].name)

  const facts = [
    `${challenges.length} ${challenges.length === 1 ? 'challenge' : 'challenges'} played`,
    `${caught} forced on you by a hunter`,
    `${log.berries} berry ${log.berries === 1 ? 'bush' : 'bushes'} eaten`,
    `${log.starved} ${log.starved === 1 ? 'season' : 'seasons'} spent starving`,
  ]
  const predicted = challenges.filter((challenge) => challenge.predicted != null)
  if (predicted.length) {
    const right = predicted.filter((challenge) => challenge.correct).length
    facts.unshift(`Predicted the winner in ${right} of ${predicted.length}`)
  }
  if (log.blocked) facts.push(`${log.blocked} ${log.blocked === 1 ? 'catch' : 'catches'} turned away by armor`)

  // The single biggest thing that shaped the result, in priority order.
  const hardest = byStrategy[byStrategy.length - 1]
  const easiest = byStrategy[0]
  let takeaway
  if (challenges.length === 0) {
    takeaway = 'You never played anyone, so your herd lived or died on hunger and on what the rest of the world was doing.'
  } else if (log.starved >= 3) {
    const lost = Math.round((1 - Math.pow(1 - STARVING_LOSS, log.starved)) * 100)
    takeaway = `Your herd went hungry for ${log.starved} seasons, and that alone cost about ${lost}% of it. Food comes from challenges that go well, so who you chose to play mattered twice over.`
  } else if (caught >= 2 && caught * 2 >= challenges.length) {
    takeaway = `Hunters caught you ${caught} times, and each time they got a game of their choosing, not yours. Staying out of reach was worth as much as winning.`
  } else if (hardest && hardest.games >= 2 && hardest.average < -4) {
    takeaway = `Your hardest opponents were ${plural(hardest.name)}: on average ${signed(hardest.average)} food against a typical animal, over ${hardest.games} games. Those meetings dragged you down the standings.`
  } else if (easiest && easiest.games >= 2 && easiest.average > 4) {
    takeaway = `Your best results came against ${plural(easiest.name)}: on average ${signed(easiest.average)} food against a typical animal, over ${easiest.games} games. Finding more of them was your way up.`
  } else {
    takeaway = 'Most of your challenges landed close to what a typical animal earns, so they barely moved you. The standings were decided by the slow drift of the whole world.'
  }

  return {
    title: ending.won ? `${name} is the last species standing` : `${name} was eliminated`,
    placement: ending.won
      ? `You outlasted every other species over ${ending.round} ${ending.round === 1 ? 'round' : 'rounds'}.`
      : ending.rank > 0
        ? `You finished ${ordinal(ending.rank)} of ${ending.alive} at the end of round ${ending.round}.`
        : `Your species died out before the end of round ${ending.round}.`,
    strategy,
    facts,
    best: describe(ranked[0]),
    worst: ranked.length > 1 ? describe(ranked[ranked.length - 1]) : null,
    byStrategy,
    byGame,
    takeaway,
    discuss: DISCUSS[strategy] || DISCUSS.Copycat,
  }
}
