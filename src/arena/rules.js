export const ARCHETYPES = [
  'Copycat',
  'All Cooperate',
  'All Cheat',
  'Grudger',
  'Detective',
]

export const ADAPTATIONS = ['armor', 'reserves', 'pack', 'camouflage']

export const DEFAULT_RULES = {
  startingCount: 1000,
  extinctionThreshold: 10,
  maxSeasons: 30,
  stableSeasons: 5,
  stableTolerance: 0.01,
  selectionStrength: 0.01,
  minGrowthFactor: 0.05,
  seasonNoise: 0.03,
  matchesPerPair: 50,

  roundsPerArena: 10,
  arenas: ['territory', 'food', 'pack', 'ambush'],

  territory: {
    bothDisplay: 2,
    escalatorWins: 4,
    fleeTarget: 6,
    fleeCaught: -1,
    fightWin: 4,
    fightLose: -5,
    fightTie: -2,
    armorFightBonus: 1,
  },

  food: {
    shareGain: 4,
    shareCostByEfficiency: { 1: 2, 2: 2, 3: 1, 4: 1, 5: 0, 6: 0 },
    keeperWins: 5,
    suckerLoss: -3,
    suckerLossWithReserves: -1,
    bothKeep: 0,
    bigAndEfficientRule: false,
  },

  pack: {
    stagThreshold: 16,
    packBonus: 1,
    stagSuccess: 6,
    stagFail: 0,
    hare: 2,
    aloneOnStag: 0,
  },

  ambush: {
    bothForage: 1,
    waitingCostLowEfficiency: -1,
    waitingCostHighEfficiency: 0,
    ambushSuccess: 6,
    ambushVictim: -5,
    spottedEscape: 1,
  },
}

export function mergeRules(overrides = {}) {
  const rules = {
    ...DEFAULT_RULES,
    ...overrides,
    territory: { ...DEFAULT_RULES.territory, ...overrides.territory },
    food: {
      ...DEFAULT_RULES.food,
      ...overrides.food,
      shareCostByEfficiency: {
        ...DEFAULT_RULES.food.shareCostByEfficiency,
        ...overrides.food?.shareCostByEfficiency,
      },
    },
    pack: { ...DEFAULT_RULES.pack, ...overrides.pack },
    ambush: { ...DEFAULT_RULES.ambush, ...overrides.ambush },
  }

  if (overrides.arenas) rules.arenas = [...overrides.arenas]
  return rules
}
