import { d6 } from './rng.js'

export function playRound(arena, a, b, moveA, moveB, rng, state, rules) {
  switch (arena) {
    case 'territory':
      return playTerritory(a, b, moveA, moveB, rng, state, rules)
    case 'food':
      return playFood(a, b, moveA, moveB, rng, state, rules)
    case 'pack':
      return playPack(a, b, moveA, moveB, rng, state, rules)
    case 'ambush':
      return playAmbush(a, b, moveA, moveB, rng, state, rules)
    default:
      throw new Error(`Unknown arena: ${arena}`)
  }
}

export function playTerritory(a, b, moveA, moveB, rng, _state, rules) {
  const t = rules.territory
  const rolls = {}

  if (moveA === 'cooperate' && moveB === 'cooperate') {
    return {
      points: [t.bothDisplay, t.bothDisplay],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} display. Both back down.`,
    }
  }

  if (moveA === 'cheat' && moveB === 'cooperate') {
    return escalateVsDisplay(a, b, 'a', rng, t)
  }
  if (moveA === 'cooperate' && moveB === 'cheat') {
    return escalateVsDisplay(b, a, 'b', rng, t)
  }

  const totalA = fightTotal(a, rng, t, rolls, 'a')
  const totalB = fightTotal(b, rng, t, rolls, 'b')

  if (totalA > totalB) {
    return {
      points: [t.fightWin, t.fightLose],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} fight. ${a.speciesName} wins the territory.`,
    }
  }
  if (totalB > totalA) {
    return {
      points: [t.fightLose, t.fightWin],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} fight. ${b.speciesName} wins the territory.`,
    }
  }
  return {
    points: [t.fightTie, t.fightTie],
    rolls,
    note: `${a.speciesName} and ${b.speciesName} fight to a costly tie.`,
  }
}

function fightTotal(creature, rng, t, rolls, side) {
  const die = d6(rng)
  const armor = creature.adaptation === 'armor' ? t.armorFightBonus : 0
  const total = die + creature.size + armor
  rolls[`${side}Die`] = die
  rolls[side] = total
  return total
}

function escalateVsDisplay(escalator, displayer, escalatorSide, rng, t) {
  const die = d6(rng)
  const fleeRoll = die + displayer.agility
  const displaySide = escalatorSide === 'a' ? 'b' : 'a'
  const rolls = {
    [`${displaySide}Die`]: die,
    [displaySide]: fleeRoll,
  }

  if (fleeRoll >= t.fleeTarget) {
    const points = escalatorSide === 'a' ? [t.escalatorWins, 0] : [0, t.escalatorWins]
    return {
      points,
      rolls,
      note: `${escalator.speciesName} escalates. ${displayer.speciesName} flees.`,
    }
  }

  const points =
    escalatorSide === 'a'
      ? [t.escalatorWins, t.fleeCaught]
      : [t.fleeCaught, t.escalatorWins]
  return {
    points,
    rolls,
    note: `${escalator.speciesName} escalates. ${displayer.speciesName} is caught.`,
  }
}

export function playFood(a, b, moveA, moveB, _rng, _state, rules) {
  const f = rules.food
  const rolls = {}

  if (moveA === 'cooperate' && moveB === 'cooperate') {
    return {
      points: [sharePayoff(a, f), sharePayoff(b, f)],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} both share the carcass.`,
    }
  }

  if (moveA === 'cheat' && moveB === 'cooperate') {
    return {
      points: [f.keeperWins, suckerPayoff(b, f)],
      rolls,
      note: `${b.speciesName} shared. ${a.speciesName} kept the carcass.`,
    }
  }

  if (moveA === 'cooperate' && moveB === 'cheat') {
    return {
      points: [suckerPayoff(a, f), f.keeperWins],
      rolls,
      note: `${a.speciesName} shared. ${b.speciesName} kept the carcass.`,
    }
  }

  return {
    points: [f.bothKeep, f.bothKeep],
    rolls,
    note: `${a.speciesName} and ${b.speciesName} both keep to themselves.`,
  }
}

function shareCost(creature, f) {
  let cost = f.shareCostByEfficiency[creature.efficiency]
  if (cost == null) {
    throw new Error(`No sharing cost for efficiency ${creature.efficiency}`)
  }
  if (f.bigAndEfficientRule && creature.size >= 5) {
    cost = Math.max(0, cost - 1)
  }
  return cost
}

function sharePayoff(creature, f) {
  return f.shareGain - shareCost(creature, f)
}

function suckerPayoff(creature, f) {
  return creature.adaptation === 'reserves' ? f.suckerLossWithReserves : f.suckerLoss
}

export function playPack(a, b, moveA, moveB, rng, _state, rules) {
  const p = rules.pack
  const rolls = {}

  if (moveA === 'cheat' && moveB === 'cheat') {
    return {
      points: [p.hare, p.hare],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} both chase hares.`,
    }
  }

  if (moveA === 'cooperate' && moveB === 'cheat') {
    return {
      points: [p.aloneOnStag, p.hare],
      rolls,
      note: `${a.speciesName} hunts the stag alone. ${b.speciesName} chases a hare.`,
    }
  }

  if (moveA === 'cheat' && moveB === 'cooperate') {
    return {
      points: [p.hare, p.aloneOnStag],
      rolls,
      note: `${b.speciesName} hunts the stag alone. ${a.speciesName} chases a hare.`,
    }
  }

  const die = d6(rng)
  const bonusA = a.adaptation === 'pack' ? p.packBonus : 0
  const bonusB = b.adaptation === 'pack' ? p.packBonus : 0
  const total = a.size + a.agility + b.size + b.agility + bonusA + bonusB + die
  rolls.die = die
  rolls.total = total

  if (total >= p.stagThreshold) {
    return {
      points: [p.stagSuccess, p.stagSuccess],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} bring down a stag.`,
    }
  }

  return {
    points: [p.stagFail, p.stagFail],
    rolls,
    note: `${a.speciesName} and ${b.speciesName} fail to bring down the stag.`,
  }
}

export function playAmbush(a, b, moveA, moveB, rng, state, rules) {
  const u = rules.ambush
  const rolls = {}

  if (moveA === 'cooperate' && moveB === 'cooperate') {
    return {
      points: [u.bothForage, u.bothForage],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} forage peacefully.`,
    }
  }

  if (moveA === 'cheat' && moveB === 'cheat') {
    return {
      points: [waitingCost(a, u), waitingCost(b, u)],
      rolls,
      note: `${a.speciesName} and ${b.speciesName} both wait in ambush and catch nothing.`,
    }
  }

  if (moveA === 'cheat' && moveB === 'cooperate') {
    return resolveAmbush(a, b, 'a', rng, state, u, rolls)
  }

  return resolveAmbush(b, a, 'b', rng, state, u, rolls)
}

function waitingCost(creature, u) {
  return creature.efficiency <= 3
    ? u.waitingCostLowEfficiency
    : u.waitingCostHighEfficiency
}

function ambushScore(creature, role, rng) {
  const die = d6(rng)
  const bonus = role === 'ambush' ? creature.efficiency : creature.agility
  return { die, total: die + bonus }
}

function resolveAmbush(attacker, defender, attackerSide, rng, state, u, rolls) {
  const defenderSide = attackerSide === 'a' ? 'b' : 'a'
  let attack = ambushScore(attacker, 'ambush', rng)
  let defend = ambushScore(defender, 'forage', rng)

  rolls[`${attackerSide}Die`] = attack.die
  rolls[attackerSide] = attack.total
  rolls[`${defenderSide}Die`] = defend.die
  rolls[defenderSide] = defend.total

  if (attack.total <= defend.total && canCamouflage(attacker, attackerSide, state)) {
    markCamouflage(attackerSide, state)
    attack = ambushScore(attacker, 'ambush', rng)
    rolls[`${attackerSide}RerollDie`] = attack.die
    rolls[`${attackerSide}Reroll`] = attack.total
    rolls[attackerSide] = attack.total
  } else if (attack.total > defend.total && canCamouflage(defender, defenderSide, state)) {
    markCamouflage(defenderSide, state)
    defend = ambushScore(defender, 'forage', rng)
    rolls[`${defenderSide}RerollDie`] = defend.die
    rolls[`${defenderSide}Reroll`] = defend.total
    rolls[defenderSide] = defend.total
  }

  const cost = waitingCost(attacker, u)

  if (attack.total > defend.total) {
    const points =
      attackerSide === 'a'
        ? [cost + u.ambushSuccess, u.ambushVictim]
        : [u.ambushVictim, cost + u.ambushSuccess]
    return {
      points,
      rolls,
      note: `${attacker.speciesName} ambushes ${defender.speciesName}.`,
    }
  }

  const points =
    attackerSide === 'a'
      ? [cost, u.spottedEscape]
      : [u.spottedEscape, cost]
  return {
    points,
    rolls,
    note: `${defender.speciesName} spots the ambush and slips away.`,
  }
}

function canCamouflage(creature, side, state) {
  return creature.adaptation === 'camouflage' && !state[`camouflageUsed${side.toUpperCase()}`]
}

function markCamouflage(side, state) {
  state[`camouflageUsed${side.toUpperCase()}`] = true
}
