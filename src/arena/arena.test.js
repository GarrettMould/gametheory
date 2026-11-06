import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { explainRun } from './explain.js'
import { runEvolution } from './evolution.js'
import { FIXTURES, makeRandomClass } from './fixtures.js'
import { playAmbush, playFood, playPack, playTerritory } from './games.js'
import { playMatch } from './match.js'
import { rngFromDice } from './rng.js'
import { mergeRules } from './rules.js'
import { chooseMove } from './strategies.js'

function critter(id, archetype, extras = {}) {
  return {
    id,
    speciesName: id,
    period: 'C',
    archetype,
    size: 3,
    efficiency: 4,
    agility: 3,
    adaptation: 'pack',
    ...extras,
  }
}

function foodRules(overrides = {}) {
  return mergeRules({ arenas: ['food'], seasonNoise: 0, ...overrides })
}

function movesFor(log, side) {
  return log.map((entry) => entry.moves[side])
}

test('Copycat vs Copycat in Food Sharing: both share all 10 rounds', () => {
  const match = playMatch(
    critter('a', 'Copycat'),
    critter('b', 'Copycat'),
    rngFromDice([]),
    foodRules(),
  )
  assert.equal(match.log.length, 10)
  for (const entry of match.log) {
    assert.deepEqual(entry.moves, ['cooperate', 'cooperate'])
  }
})

test('Grudger vs All Cheat in Food Sharing: Grudger shares round 1 only', () => {
  const match = playMatch(
    critter('grudger', 'Grudger'),
    critter('cheat', 'All Cheat'),
    rngFromDice([]),
    foodRules(),
  )
  assert.deepEqual(movesFor(match.log, 0), [
    'cooperate',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
  ])
  assert.deepEqual(match.totals, [-3, 5])
})

test('Detective vs All Cooperate: probes then cheats from round 5', () => {
  const match = playMatch(
    critter('detective', 'Detective'),
    critter('coop', 'All Cooperate'),
    rngFromDice([]),
    foodRules(),
  )
  assert.deepEqual(movesFor(match.log, 0), [
    'cooperate',
    'cheat',
    'cooperate',
    'cooperate',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
    'cheat',
  ])
})

test('Detective vs Copycat: Detective plays Copycat from round 5', () => {
  const history = []
  const detectiveMoves = []
  for (let round = 1; round <= 10; round += 1) {
    const move = chooseMove('Detective', history, round)
    detectiveMoves.push(move)
    const copycat = chooseMove('Copycat', detectiveMoves.slice(0, -1), round)
    history.push(copycat)
  }

  for (let round = 5; round <= 10; round += 1) {
    const copycatFromHere = chooseMove(
      'Copycat',
      history.slice(0, round - 1),
      round,
    )
    assert.equal(detectiveMoves[round - 1], copycatFromHere)
  }
})

test('Food: two sharers with Efficiency 4 get +3, Efficiency 6 get +4', () => {
  const mid = playFood(
    critter('a', 'All Cooperate'),
    critter('b', 'All Cooperate'),
    'cooperate',
    'cooperate',
    rngFromDice([]),
    {},
    foodRules(),
  )
  assert.deepEqual(mid.points, [3, 3])

  const high = playFood(
    critter('a', 'All Cooperate', { efficiency: 6, size: 2, agility: 2 }),
    critter('b', 'All Cooperate', { efficiency: 6, size: 2, agility: 2 }),
    'cooperate',
    'cooperate',
    rngFromDice([]),
    {},
    foodRules(),
  )
  assert.deepEqual(high.points, [4, 4])
})

test('Food: a sharer with reserves who gets exploited gets -1', () => {
  const result = playFood(
    critter('sucker', 'All Cooperate', { adaptation: 'reserves' }),
    critter('keeper', 'All Cheat'),
    'cooperate',
    'cheat',
    rngFromDice([]),
    {},
    foodRules(),
  )
  assert.equal(result.points[0], -1)
  assert.equal(result.points[1], 5)
})

test('Territory: armor adds 1 to fight rolls, and ties give both -2', () => {
  const rules = mergeRules({ arenas: ['territory'] })
  const armored = critter('armored', 'All Cheat', { adaptation: 'armor' })
  const plain = critter('plain', 'All Cheat', { adaptation: 'pack' })

  const boosted = playTerritory(
    armored,
    plain,
    'cheat',
    'cheat',
    rngFromDice([3, 3]),
    {},
    rules,
  )
  assert.equal(boosted.rolls.a, 3 + 3 + 1)
  assert.equal(boosted.rolls.b, 3 + 3)
  assert.deepEqual(boosted.points, [4, -5])

  const tied = playTerritory(
    armored,
    plain,
    'cheat',
    'cheat',
    rngFromDice([3, 4]),
    {},
    rules,
  )
  assert.equal(tied.rolls.a, tied.rolls.b)
  assert.deepEqual(tied.points, [-2, -2])
})

test('Pack: without pack a 3 fails and a 4 succeeds; with pack a 2 is enough', () => {
  const rules = mergeRules()
  const noPack = critter('a', 'All Cooperate', { adaptation: 'armor' })
  const packed = critter('a', 'All Cooperate', { adaptation: 'pack' })

  const fail = playPack(
    noPack,
    { ...noPack, id: 'b', speciesName: 'b' },
    'cooperate',
    'cooperate',
    rngFromDice([3]),
    {},
    rules,
  )
  assert.equal(fail.rolls.total, 15)
  assert.deepEqual(fail.points, [0, 0])

  const succeed = playPack(
    noPack,
    { ...noPack, id: 'b', speciesName: 'b' },
    'cooperate',
    'cooperate',
    rngFromDice([4]),
    {},
    rules,
  )
  assert.equal(succeed.rolls.total, 16)
  assert.deepEqual(succeed.points, [6, 6])

  const withPack = playPack(
    packed,
    { ...packed, id: 'b', speciesName: 'b' },
    'cooperate',
    'cooperate',
    rngFromDice([2]),
    {},
    rules,
  )
  assert.equal(withPack.rolls.total, 16)
  assert.deepEqual(withPack.points, [6, 6])
})

test('Ambush: camouflage reroll is used at most once per Ambush game', () => {
  const rules = mergeRules({ arenas: ['ambush'], roundsPerArena: 3 })
  const sneaky = critter('sneaky', 'All Cooperate', { adaptation: 'camouflage' })
  const hunter = critter('hunter', 'All Cheat')
  const match = playMatch(
    sneaky,
    hunter,
    rngFromDice([6, 1, 1, 6, 1, 6, 1]),
    rules,
  )

  const rerolls = match.log.filter((entry) => entry.rolls.aReroll != null)
  assert.equal(rerolls.length, 1)
  assert.equal(match.log[0].rolls.aRerollDie, 1)
  assert.equal(match.log[1].rolls.aReroll, undefined)
})

test('the same creatures, seed, and settings produce identical output', () => {
  const first = runEvolution(FIXTURES, { seed: 1, seasonNoise: 0 })
  const second = runEvolution(FIXTURES, { seed: 1, seasonNoise: 0 })
  assert.deepEqual(first, second)
})

test('a different seed changes at least the matchup averages', () => {
  const first = runEvolution(FIXTURES, { seed: 1, seasonNoise: 0 })
  const second = runEvolution(FIXTURES, { seed: 2, seasonNoise: 0 })
  assert.notDeepEqual(first.matchups, second.matchups)
})

test('Food only, All Cheat vs All Cooperate: All Cheat ends with everyone', () => {
  const result = runEvolution(
    [critter('cheat', 'All Cheat'), critter('coop', 'All Cooperate')],
    { seed: 1, arenas: ['food'], seasonNoise: 0 },
  )
  assert.equal(result.result.reason, 'one-left')
  assert.equal(result.result.winner, 'cheat')
  assert.deepEqual(result.result.survivors, ['cheat'])
})

test('Food only, Copycat vs All Cheat: Copycat wins', () => {
  const result = runEvolution(
    [critter('copycat', 'Copycat'), critter('cheat', 'All Cheat')],
    { seed: 1, arenas: ['food'], seasonNoise: 0 },
  )
  assert.equal(result.result.reason, 'one-left')
  assert.equal(result.result.winner, 'copycat')
})

test('total population equals the starting total after every season', () => {
  const result = runEvolution(FIXTURES, { seed: 1, seasonNoise: 0 })
  const capacity = FIXTURES.length * result.rules.startingCount
  for (const season of result.seasons) {
    const total = Object.values(season.counts).reduce((sum, count) => sum + count, 0)
    assert.ok(Math.abs(total - capacity) < 1e-6, `season ${season.season} total ${total}`)
  }
})

test('a species below 10 animals is removed and never returns', () => {
  const result = runEvolution(
    [critter('cheat', 'All Cheat'), critter('coop', 'All Cooperate')],
    {
      seed: 1,
      arenas: ['food'],
      seasonNoise: 0,
      startingCount: 100,
      extinctionThreshold: 40,
    },
  )

  const goneAt = result.seasons.find((season) => season.extinct.includes('coop'))
  assert.ok(goneAt, 'All Cooperate should go extinct')
  for (const season of result.seasons) {
    if (season.season >= goneAt.season) {
      assert.equal(season.counts.coop, 0)
    }
  }
  assert.ok(!result.result.survivors.includes('coop'))
})

test('leftover trait points still let a creature run', () => {
  const result = runEvolution(
    [
      critter('lean', 'Copycat', { size: 2, efficiency: 2, agility: 2 }),
      critter('full', 'All Cheat'),
    ],
    { seed: 1, arenas: ['food'], seasonNoise: 0 },
  )
  assert.ok(result.seasons.length > 1)
  assert.equal(result.species[0].size + result.species[0].efficiency + result.species[0].agility, 6)
})

test('a random sample class is six valid unique creatures', () => {
  const first = makeRandomClass(42)
  const second = makeRandomClass(42)
  const third = makeRandomClass(43)
  assert.equal(first.length, 6)
  assert.deepEqual(
    first.map((item) => item.id),
    second.map((item) => item.id),
  )
  assert.notDeepEqual(
    first.map((item) => item.speciesName),
    third.map((item) => item.speciesName),
  )
  const names = new Set(first.map((item) => item.speciesName))
  assert.equal(names.size, 6)
  runEvolution(first, { seed: 1, seasonNoise: 0, maxSeasons: 5 })
})

test('explainer walks through every Block E species in plain language', () => {
  const run = runEvolution(FIXTURES, { seed: 1 })
  const explainer = explainRun(run)
  assert.equal(explainer.pages.length, FIXTURES.length + 1)
  assert.equal(explainer.pages[0].id, 'overview')
  assert.match(explainer.pages[0].paragraphs.join(' '), /Painted Dog had the most/)

  const byId = Object.fromEntries(explainer.pages.slice(1).map((page) => [page.id, page]))
  assert.equal(explainer.pages[1].id, 'painted-dog')
  assert.match(byId['painted-dog'].paragraphs.join(' '), /group, not the duel/)
  assert.match(byId['brood-cuckoo'].paragraphs.join(' '), /gone by season 10/)
  assert.match(byId['brood-cuckoo'].paragraphs.join(' '), /Plain Dodo/)
  assert.match(byId['iron-crow'].paragraphs.join(' '), /did well at first/)
  assert.match(byId['nightveil-bat'].paragraphs.join(' '), /faded to/)
  assert.match(byId['brush-fox'].paragraphs.join(' '), /never forgave/)
  assert.match(byId['plain-dodo'].paragraphs.join(' '), /never hit back/)
  assert.match(byId['iron-crow'].paragraphs.join(' '), /grudge/)
  assert.match(byId['nightveil-bat'].paragraphs.join(' '), /miss the big group meal/)
  assert.ok(byId['painted-dog'].list.length >= 5)
  assert.match(byId['painted-dog'].listTitle, /classmate/)
})

test('explainer opens with prediction vs actual when a ranking is passed', () => {
  const run = runEvolution(FIXTURES, { seed: 1 })
  const predictedIds = run.species.map((species) => species.id)
  const explainer = explainRun(run, { predictedIds })
  assert.equal(explainer.pages[0].id, 'prediction')
  assert.equal(explainer.pages[1].id, 'overview')
  assert.equal(explainer.pages[0].compare.rows.length, FIXTURES.length)
  assert.equal(
    explainer.pages[0].compare.rows[0].actual.name,
    'Painted Dog',
  )
})

test('explainer stays safe across a few seeds', () => {
  for (const seed of [1, 2, 3, 7]) {
    const explainer = explainRun(runEvolution(FIXTURES, { seed }))
    assert.equal(explainer.pages.length, FIXTURES.length + 1)
    for (const page of explainer.pages) {
      assert.ok(page.title)
      assert.ok(page.paragraphs.length > 0)
    }
  }
})

test('the full fixture class finishes in under 2 seconds', () => {
  const start = performance.now()
  const result = runEvolution(FIXTURES, { seed: 1 })
  const elapsed = performance.now() - start
  assert.ok(result.seasons.length > 1)
  assert.ok(elapsed < 2000, `took ${elapsed}ms`)
})
