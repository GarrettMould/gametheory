// One challenge between the player's species and another, and what it does to both populations.
// Uses the games already in src/arena: a challenge is ten rounds of ONE of the four games, picked at
// random, so nobody knows beforehand which game they are walking into.
import { playMatch } from '../arena/match.js'
import { createRng } from '../arena/rng.js'
import { ADAPTATIONS, ARCHETYPES, DEFAULT_RULES } from '../arena/rules.js'

export const STARTING_POPULATION = DEFAULT_RULES.startingCount
export const STARTING_FOOD = 0
export const EXTINCT_BELOW = DEFAULT_RULES.extinctionThreshold

// How food turns into population. Food is counted per animal, so it moves a population by a
// percentage: a big population gains more animals from the same meal than a small one.
//
// A challenge is scored against par: what a typical animal in the world is earning at that game right
// now. Each point above par grows a species by CHALLENGE_STRENGTH, each point below shrinks it.
// Doing what everyone else is doing (sharing in a world that shares) is par and changes nothing.
//
// In the background, every species has one typical encounter per season and grows by the food it
// pays. The world has room for a fixed number of animals (see `settle`), so there too only earning
// more than the rest of the world gains ground.
export const CHALLENGE_STRENGTH = 0.003 // for a challenge the player takes part in
export const SEASON_STRENGTH = 0.003 // for the encounters every species has in the background each season
export const SEASON_SECONDS = 20 // how often a background season passes
export const WILDCARD_CHANCE = 1 / 3 // how often a challenge turns out to be a wildcard contest
const WILDCARD_PRIZE = 3 // each round of a wildcard, the winner takes this and the loser pays it
const MATCHUP_SAMPLES = 12 // matches averaged per pairing when working out what a typical encounter pays

/**
 * The four games, with the words shown to the player. Each side's move is 'cooperate' or 'cheat'.
 * `how` says what the choice is and what it pays; `stats` says what decides it besides the moves.
 */
export const GAMES = {
  territory: {
    name: 'Territory',
    moves: { cooperate: 'Display', cheat: 'Escalate' },
    how: 'Two animals want the same patch. Each round both Display or Escalate. Two displays split it quietly (2 each). An escalator takes it (4) while the displayer tries to flee. Two escalators fight.',
    stats: 'A fight goes to Size plus a die roll, with Armor adding 1, and the loser takes −5. Fleeing safely takes Agility.',
  },
  food: {
    name: 'Food Sharing',
    moves: { cooperate: 'Share', cheat: 'Keep' },
    how: 'A carcass is on the ground. Each round both Share or Keep. Sharing together feeds both (3 or 4 each). Keeping while the other shares takes 5 and costs the sharer 3. If both keep, nobody eats.',
    stats: 'Efficiency 4 or higher shares at no cost, and Reserves soften the loss when a sharer is exploited.',
  },
  pack: {
    name: 'Pack Hunting',
    moves: { cooperate: 'Stag', cheat: 'Hare' },
    how: 'Each round both go for the Stag or settle for a Hare. A hare is a safe 2. The stag pays 6 each, but only if both commit and the hunt comes off. A lone stag hunter gets nothing.',
    stats: 'The hunt comes off when both animals’ Size and Agility plus a die roll reach 16. Pack adds 1.',
  },
  ambush: {
    name: 'Ambush',
    moves: { cooperate: 'Forage', cheat: 'Ambush' },
    how: 'Each round both Forage in the open or lie in Ambush. Two foragers eat a little (1 each). An unnoticed ambusher takes 6 and costs the forager 5; a spotted one gets nothing. Two ambushers catch nothing.',
    stats: 'The ambusher rolls with Efficiency and the forager with Agility. Camouflage gives one re-roll.',
  },
}

/**
 * Wildcards: head-to-head contests with a clear winner and loser. Strategies sit these out. Each
 * round both animals roll a die and add one stat (plus 1 for the helping power-up); the higher total
 * takes the prize and the other pays it. They only exist in the roaming arena, not in the simulation.
 */
export const WILDCARDS = {
  chase: {
    name: 'Chase',
    wildcard: true,
    stat: 'agility',
    statName: 'Agility',
    helper: null,
    how: 'A wildcard: no sharing here, one wins and one loses. One runs and one pursues. Each round both roll a die and add Agility. The higher total takes 3 food and the other loses 3.',
    won: 'outran',
  },
  shove: {
    name: 'Shoving Match',
    wildcard: true,
    stat: 'size',
    statName: 'Size',
    helper: 'armor',
    helperName: 'Armor',
    how: 'A wildcard: no sharing here, one wins and one loses. Two animals shove over the same prize. Each round both roll a die and add Size, plus 1 for Armor. The higher total takes 3 food and the other loses 3.',
    won: 'shoved aside',
  },
  standoff: {
    name: 'Standoff',
    wildcard: true,
    stat: 'efficiency',
    statName: 'Efficiency',
    helper: 'reserves',
    helperName: 'Reserves',
    how: 'A wildcard: no sharing here, one wins and one loses. Each waits for the other to give up. Each round both roll a die and add Efficiency, plus 1 for Reserves. The higher total takes 3 food and the other loses 3.',
    won: 'outlasted',
  },
}

/** Every game a challenge can turn out to be: the four from the simulation plus the wildcards. */
export const ALL_GAMES = { ...GAMES, ...WILDCARDS }

/** What an animal adds to its die roll in a wildcard. */
function wildcardBonus(creature, card) {
  return creature[card.stat] + (card.helper && creature.adaptation === card.helper ? 1 : 0)
}

/** Ten rounds of a wildcard. Same shape as a match from the simulation: { totals, log }. */
function playWildcard(a, b, key, rng) {
  const card = WILDCARDS[key]
  const bonus = [wildcardBonus(a, card), wildcardBonus(b, card)]
  const totals = [0, 0]
  const log = []
  for (let round = 1; round <= DEFAULT_RULES.roundsPerArena; round += 1) {
    const rolls = [1 + Math.floor(rng() * 6) + bonus[0], 1 + Math.floor(rng() * 6) + bonus[1]]
    let points = [0, 0]
    let note = `${a.speciesName} and ${b.speciesName} are dead level.`
    if (rolls[0] > rolls[1]) {
      points = [WILDCARD_PRIZE, -WILDCARD_PRIZE]
      note = `${a.speciesName} ${card.won} ${b.speciesName}.`
    } else if (rolls[1] > rolls[0]) {
      points = [-WILDCARD_PRIZE, WILDCARD_PRIZE]
      note = `${b.speciesName} ${card.won} ${a.speciesName}.`
    }
    totals[0] += points[0]
    totals[1] += points[1]
    log.push({ moves: null, rolls, points, note })
  }
  return { totals, log }
}

/** Ten rounds of whichever game this is, between two creatures. */
function playGame(a, b, game, rng) {
  if (WILDCARDS[game]) return playWildcard(toEngineCreature(a), toEngineCreature(b), game, rng)
  return playMatch(toEngineCreature(a), toEngineCreature(b), rng, {
    ...DEFAULT_RULES,
    arenas: [game],
  })
}

/** Draw the game for a challenge: usually one of the four, sometimes a wildcard. */
function drawGame(rng) {
  const pool = rng() < WILDCARD_CHANCE ? Object.keys(WILDCARDS) : DEFAULT_RULES.arenas
  return pool[Math.floor(rng() * pool.length)]
}

/* How each strategy plays, in the words of the game at hand. */
const STRATEGY_PLAY = {
  'All Cooperate': 'always plays {N}, whatever happens.',
  'All Cheat': 'always plays {M}.',
  Copycat: 'opens with {N}, then copies the other animal’s last move.',
  Grudger: 'plays {N} until it is crossed once, then plays {M} for good.',
  Detective:
    'tests the other animal first ({N}, {M}, {N}, {N}). If it never hits back, plays {M} from then on. If it does, copies it.',
}

/*
 * What happens when two strategies meet. Keyed "first+second" in the order of STRATEGY_PLAY;
 * {X} is whoever holds the first strategy and {Y} the second.
 */
const MEETINGS = {
  'All Cooperate+All Cooperate':
    'Neither strategy ever plays {M}, so every round was {N} against {N}. Two always-nice animals do well together.',
  'All Cooperate+All Cheat':
    '{X} never hits back, so {Y} played {M} against {N} every round. An always-nice animal is the easiest mark there is.',
  'All Cooperate+Copycat':
    '{Y} only turns on an animal that crosses it, and {X} never crosses anyone, so it was {N} against {N} throughout.',
  'All Cooperate+Grudger':
    '{Y} only holds a grudge once it is crossed, and {X} never crosses anyone, so it was {N} against {N} throughout.',
  'All Cooperate+Detective':
    '{Y} slipped in one {M} as a test in round 2, saw that {X} never hit back, and played {M} from round 5 on. Not hitting back is what invited it.',
  'All Cheat+All Cheat':
    'Both strategies play {M} every round. Neither can be taken advantage of, and neither gets what cooperating pays.',
  'All Cheat+Copycat':
    '{Y} opened with {N} and was crossed once. After that it copied {X}’s {M} every round, so the easy gain lasted exactly one round.',
  'All Cheat+Grudger':
    '{Y} opened with {N}, was crossed in round 1, and played {M} for the rest. A grudge gives a cheater one free round and no more.',
  'All Cheat+Detective':
    '{X} played {M} throughout, so {Y}’s test rounds were punished. Having met {M} in the test, {Y} switched to copying and answered {M} with {M}.',
  'Copycat+Copycat':
    'Both open with {N} and then mirror each other, so nobody ever breaks the peace.',
  'Copycat+Grudger':
    'Neither strategy is ever the first to play {M}, so the grudge never starts and it was {N} against {N} throughout.',
  'Copycat+Detective':
    '{Y}’s test {M} in round 2 was answered in kind a round later. Seeing that {X} hits back, {Y} settled into copying, and both went back to {N}.',
  'Grudger+Grudger':
    'Neither is ever the first to play {M}, so no grudge starts and it was {N} against {N} throughout.',
  'Grudger+Detective':
    '{Y}’s single test {M} in round 2 set off {X}’s grudge for good. {Y} then copied it, so the rest was {M} against {M}. One probe cost both sides the peace.',
  'Detective+Detective':
    'Both ran the same test, each saw the other play {M} in round 2, and each concluded the other hits back. Both then settled into copying and stayed on {N}.',
}

const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Plain-language notes for one challenge, centred on how the two strategies met.
 * Returns { how, mine, theirs, meeting, stats }:
 *   how      what the game is
 *   mine     how the player's strategy plays, e.g. "Copycat opens with Share, then..."
 *   theirs   the same for the opponent
 *   meeting  what happened when those two strategies met
 *   stats    set only when the moves matched every round yet the scores differ, so stats and dice explain the gap
 */
export function explainChallenge(me, them, outcome) {
  const card = WILDCARDS[outcome.game]
  if (card) {
    const sides = [toEngineCreature(me), toEngineCreature(them)]
    const adds = sides.map((side) => wildcardBonus(side, card))
    const line = (side, add) =>
      `${card.statName} ${side[card.stat]}${add > side[card.stat] ? `, +1 for ${card.helperName}` : ''}. Adds ${add} to every roll.`
    const wins = outcome.rounds.filter((round) => round.points[0] > 0).length
    const losses = outcome.rounds.filter((round) => round.points[0] < 0).length
    const edge = adds[0] - adds[1]
    const edgeText =
      edge === 0
        ? 'The two of you add the same to every roll, so this one was down to the dice.'
        : `${edge > 0 ? 'You add' : `${them.speciesName} adds`} ${Math.abs(edge)} more to every roll, which ${Math.abs(edge) === 1 ? 'tilts' : 'heavily tilts'} each round ${edge > 0 ? 'your' : 'their'} way.`
    return {
      how: card.how,
      mine: line(sides[0], adds[0]),
      theirs: line(sides[1], adds[1]),
      meeting: `Strategies sit a wildcard out, so this was ${card.statName} and dice. You took ${wins} of the ten rounds and ${them.speciesName} took ${losses}. ${edgeText}`,
      stats: '',
    }
  }
  const game = GAMES[outcome.game]
  const mine = toEngineCreature(me).archetype
  const theirs = toEngineCreature(them).archetype
  const words = (text) =>
    text.replaceAll('{N}', game.moves.cooperate).replaceAll('{M}', game.moves.cheat)

  const order = Object.keys(STRATEGY_PLAY)
  const playerFirst = order.indexOf(mine) <= order.indexOf(theirs)
  const [first, second] = playerFirst ? [mine, theirs] : [theirs, mine]
  const yours = `your ${mine}`
  const rivals = `${them.speciesName}’s ${theirs}`
  const meeting = words(MEETINGS[`${first}+${second}`] || '')
    .replaceAll('{X}', playerFirst ? yours : rivals)
    .replaceAll('{Y}', playerFirst ? rivals : yours)
    .split('. ')
    .map(upperFirst)
    .join('. ')

  const mirrored = outcome.rounds.every((round) => round.moves[0] === round.moves[1])
  return {
    how: game.how,
    mine: `${mine} ${words(STRATEGY_PLAY[mine])}`,
    theirs: `${theirs} ${words(STRATEGY_PLAY[theirs])}`,
    meeting,
    stats:
      mirrored && outcome.food[0] !== outcome.food[1]
        ? `The two sides made the same move every round, so the gap came from stats and dice. ${game.stats}`
        : '',
  }
}

const LEAST_GROWTH = 0.5 // no single match can do worse than halve a population

const stat = (value) => Math.min(6, Math.max(1, Math.round(Number(value) || 3)))

/** The shape the game engine expects, with gaps in classroom data filled by safe defaults. */
export function toEngineCreature(creature) {
  const adaptation = String(creature.adaptation || '').toLowerCase()
  return {
    id: creature.id,
    speciesName: creature.speciesName,
    archetype: ARCHETYPES.includes(creature.archetype) ? creature.archetype : 'Copycat',
    adaptation: ADAPTATIONS.includes(adaptation) ? adaptation : 'armor',
    size: stat(creature.size),
    efficiency: stat(creature.efficiency),
    agility: stat(creature.agility),
  }
}

export const populationOf = (populations, id) => populations[id] ?? STARTING_POPULATION

function grow(population, food, strength) {
  const next = population * Math.max(LEAST_GROWTH, 1 + strength * food)
  return next < EXTINCT_BELOW ? 0 : next
}

/** The world holds a fixed number of animals: scale every living species so the total fits it again. */
function settle(populations, speciesCount) {
  const capacity = speciesCount * STARTING_POPULATION
  const total = Object.values(populations).reduce((sum, value) => sum + value, 0)
  if (total > 0) for (const id of Object.keys(populations)) populations[id] *= capacity / total
  return populations
}

/** Every creature's current population, as a plain { id: number } map. */
function census(creatures, populations) {
  const now = {}
  for (const creature of creatures) now[creature.id] = populationOf(populations, creature.id)
  return now
}

/**
 * What a typical encounter pays: matchups[a][b] holds the food species `a` earns, on average, from
 * ten rounds against species `b` at each game ({ territory, food, pack, ambush }) and across the four
 * (`typical`). Includes a species meeting its own kind. Worked out once per creature list by playing
 * each pairing a number of times.
 */
export function buildMatchups(creatures, seed = 1) {
  const rng = createRng(seed)
  const players = creatures.map(toEngineCreature)
  const games = DEFAULT_RULES.arenas
  const table = Object.fromEntries(players.map((player) => [player.id, {}]))
  const average = (sums, divisor) => {
    const row = { typical: 0 }
    for (const game of games) {
      row[game] = sums[game] / divisor
      row.typical += row[game] / games.length
    }
    return row
  }
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i; j < players.length; j += 1) {
      const first = Object.fromEntries(games.map((game) => [game, 0]))
      const second = { ...first }
      for (let n = 0; n < MATCHUP_SAMPLES; n += 1) {
        const match = playMatch(players[i], players[j], rng, DEFAULT_RULES)
        for (const game of games) {
          first[game] += match.byArena[game][0]
          second[game] += match.byArena[game][1]
        }
      }
      if (i === j) {
        for (const game of games) first[game] += second[game]
        table[players[i].id][players[j].id] = average(first, 2 * MATCHUP_SAMPLES)
      } else {
        table[players[i].id][players[j].id] = average(first, MATCHUP_SAMPLES)
        table[players[j].id][players[i].id] = average(second, MATCHUP_SAMPLES)
      }
    }
  }
  return table
}

/**
 * Par for a game: the food an animal picked at random from the whole world earns from ten rounds
 * against another animal picked at random. Common species count for more on both sides, so par
 * shifts as the world changes: high where most animals cooperate, low where they do not.
 */
export function parFor(game, creatures, populations, matchups) {
  if (WILDCARDS[game]) return 0 // whatever one side wins the other loses, so the world breaks even
  const now = census(creatures, populations)
  const total = Object.values(now).reduce((sum, value) => sum + value, 0)
  if (total <= 0) return 0
  let par = 0
  for (const a of creatures) {
    if (now[a.id] <= 0) continue
    for (const b of creatures) {
      par += (now[a.id] / total) * (now[b.id] / total) * (matchups[a.id]?.[b.id]?.[game] ?? 0)
    }
  }
  return par
}

/**
 * Play one challenge and work out the new populations.
 *
 * The player's challenge is not a free extra meal: at the same moment every other living species
 * plays a challenge of its own (one random game against a stranger drawn from the whole world), so
 * all species play the same number of games. Each one grows or shrinks by how far its food landed
 * from par for the game it played, then the whole world (`everyone`) is settled back to its fixed size.
 *
 * Options: `game` to force the player's game instead of a random one, `seed` for the dice.
 * Returns { game, food: [mine, theirs], par, rounds: [{ moves, rolls, points, note }],
 * populations: { [id]: number }, change: [mine, theirs], animals: [mine, theirs] }
 * where change is the fractional change in each population (-1 means it died out) and animals is
 * the same change as a head count. Both include the effect of everyone else's games.
 */
export function playChallenge(me, them, everyone, populations, matchups, options = {}) {
  const rng = createRng(options.seed ?? Date.now())
  const game = options.game ?? drawGame(rng)
  const match = playGame(me, them, game, rng)
  const [mine, theirs] = match.totals

  const before = census(everyone, populations)
  const pars = Object.fromEntries(
    Object.keys(ALL_GAMES).map((name) => [
      name,
      parFor(name, everyone, populations, matchups),
    ]),
  )
  const next = { ...before }
  next[me.id] = grow(before[me.id], mine - pars[game], CHALLENGE_STRENGTH)
  next[them.id] = grow(before[them.id], theirs - pars[game], CHALLENGE_STRENGTH)

  // Everyone else's game. Only the species whose turn it is gets scored, so each plays exactly one.
  const living = everyone.filter((creature) => before[creature.id] > 0)
  for (const creature of living) {
    if (creature.id === me.id || creature.id === them.id) continue
    const stranger = pickSpecies(living, before, rng)
    if (!stranger) continue
    const theirGame = drawGame(rng)
    const food = playGame(creature, stranger, theirGame, rng).totals[0]
    next[creature.id] = grow(before[creature.id], food - pars[theirGame], CHALLENGE_STRENGTH)
  }
  settle(next, everyone.length)

  const pair = [me.id, them.id]
  return {
    game,
    food: [mine, theirs],
    par: pars[game],
    rounds: match.log.map(({ moves, rolls, points, note }) => ({
      moves,
      rolls: moves ? null : rolls, // only wildcards show their rolls
      points,
      note,
    })),
    populations: next,
    change: pair.map((id) => (before[id] > 0 ? next[id] / before[id] - 1 : 0)),
    animals: pair.map((id) => Math.round(next[id]) - Math.round(before[id])),
  }
}

/**
 * One background season: every species has an encounter with a stranger drawn from the whole world,
 * so the more common a species is, the more often it is the one met (and a common species mostly
 * meets its own kind). Each grows by the food it can expect from that, then the world is settled
 * back to its fixed size, which leaves only the species that out-earned the rest ahead.
 * This is the simulation's own rule, run a little at a time.
 */
export function stepSeason(creatures, populations, matchups) {
  const now = census(creatures, populations)
  const total = Object.values(now).reduce((sum, value) => sum + value, 0)
  if (total <= 0) return now

  const next = {}
  for (const creature of creatures) {
    let food = 0
    for (const other of creatures) {
      food += (now[other.id] / total) * (matchups[creature.id]?.[other.id]?.typical ?? 0)
    }
    next[creature.id] = grow(now[creature.id], food, SEASON_STRENGTH)
  }
  return settle(next, creatures.length)
}

/** Every species still alive, biggest population first: [{ id, name, population }]. */
export function standings(creatures, populations) {
  return creatures
    .map((creature) => ({
      id: creature.id,
      name: creature.speciesName,
      population: populationOf(populations, creature.id),
    }))
    .filter((row) => row.population > 0)
    .sort((a, b) => b.population - a.population)
}

/** Remove the given species from the world; the survivors spread out into the room they leave. */
export function eliminate(creatures, populations, ids) {
  const next = census(creatures, populations)
  for (const id of ids) next[id] = 0
  return settle(next, creatures.length)
}

/** Pick a species to appear next, in proportion to its population. Returns null if nobody is left. */
export function pickSpecies(creatures, populations, random = Math.random) {
  let total = 0
  for (const creature of creatures) total += populationOf(populations, creature.id)
  if (total <= 0) return null
  let roll = random() * total
  for (const creature of creatures) {
    roll -= populationOf(populations, creature.id)
    if (roll < 0) return creature
  }
  return creatures[creatures.length - 1] || null
}
