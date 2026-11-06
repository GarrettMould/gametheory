export function explainRun(run, options = {}) {
  const last = run.seasons[run.seasons.length - 1]
  const ranked = [...run.species].sort((a, b) => {
    const counts = (last.counts[b.id] ?? 0) - (last.counts[a.id] ?? 0)
    if (counts !== 0) return counts
    return (extinctSeason(run, a.id) ?? 99) - (extinctSeason(run, b.id) ?? 99)
  })
  const colorIndex = Object.fromEntries(
    run.species.map((species, index) => [species.id, index]),
  )
  const winner = ranked[0]
  const pages = []
  if (options.predictedIds?.length) {
    pages.push(predictionComparePage(ranked, colorIndex, options.predictedIds))
  }
  pages.push(overviewPage(run, ranked, last, winner, colorIndex))
  for (const species of ranked) {
    pages.push(animalPage(run, species, ranked, last, winner, colorIndex))
  }
  return { pages }
}

function predictionComparePage(ranked, colorIndex, predictedIds) {
  const byId = Object.fromEntries(ranked.map((species) => [species.id, species]))
  const rows = ranked.map((actual, index) => {
    const predicted = byId[predictedIds[index]] ?? null
    return {
      rank: index + 1,
      predicted: predicted ? teamChip(predicted, colorIndex) : null,
      actual: teamChip(actual, colorIndex),
      match: Boolean(predicted && predicted.id === actual.id),
    }
  })
  const hits = rows.filter((row) => row.match).length
  const n = rows.length
  const summary =
    hits === n
      ? 'You called every rank. Next we walk through why that order showed up.'
      : hits === 0
        ? 'None of the ranks matched. Next we walk through why the class actually finished this way.'
        : `You nailed ${hits} of ${n} ranks. Next we walk through why the rest landed where they did.`

  return {
    id: 'prediction',
    kicker: 'Your call',
    title: 'Prediction vs actual standings',
    paragraphs: [
      `${summary} Here is the order you locked in, next to how the class actually finished.`,
    ],
    compare: {
      predictedLabel: 'You predicted',
      actualLabel: 'Actual finish',
      rows,
    },
  }
}

function teamChip(species, colorIndex) {
  return {
    id: species.id,
    name: species.speciesName,
    colorIndex: colorIndex[species.id],
  }
}

function overviewPage(run, ranked, last, winner, colorIndex) {
  const season = last.season
  const gone = ranked.filter((species) => extinctSeason(run, species.id))
  const here = ranked.filter((species) => !extinctSeason(run, species.id))
  const fades = ranked
    .map((species) => ({ species, peak: peakInfo(run, species.id) }))
    .filter(({ peak, species }) => peak.fell && species.id !== winner.id)
    .slice(0, 2)
  const fadeLine =
    fades.length > 0
      ? fades
          .map(({ species, peak }) => {
            const goneAt = extinctSeason(run, species.id)
            return goneAt
              ? `${species.speciesName} climbed to ${prettyCount(peak.max)} by season ${peak.at}, then crashed and was gone by season ${goneAt}.`
              : `${species.speciesName} peaked at ${prettyCount(peak.max)} in season ${peak.at}, then faded as ${winner.speciesName} took the room.`
          })
          .join(' ')
      : gone.length > 0
        ? `${gone.map((species) => species.speciesName).join(' and ')} disappeared. The rest are still here, but not equally.`
        : 'Nobody went extinct. Some groups still grew a lot more than others.'

  return {
    id: 'overview',
    kicker: 'The whole class',
    title: 'Why they finished this way',
    paragraphs: [
      'Food is the score. Eat more than the class average, and you get more babies. The room only holds a fixed number of animals, so when one group grows, another has to shrink.',
      endReason(run, season, winner, last),
      fadeLine,
      'Next, the story of each animal in this exact class — not a generic recap of the games.',
    ],
    list: ranked.map((species) => ({
      id: species.id,
      name: species.speciesName,
      colorIndex: colorIndex[species.id],
      detail: rosterDetail(run, species, last),
    })),
    hereCount: here.length,
  }
}

function animalPage(run, species, ranked, last, winner, colorIndex) {
  const goneAt = extinctSeason(run, species.id)
  const count = last.counts[species.id] ?? 0
  const place = ranked.findIndex((item) => item.id === species.id) + 1
  const adaptation = ADAPTATION_LABELS[species.adaptation] ?? species.adaptation
  const scores = otherScores(run, species.id)

  return {
    id: species.id,
    kicker: goneAt ? `Gone · season ${goneAt}` : `${ordinal(place)} · still here`,
    title: species.speciesName,
    meta: `${species.archetype} · ${adaptation}`,
    colorIndex: colorIndex[species.id],
    paragraphs: [
      arcParagraph(run, species, goneAt, count, winner),
      turningParagraph(run, species),
      ...mixParagraphs(run, species, ranked, last, winner, goneAt),
      matchupParagraph(run, species, scores),
      gameParagraph(run, species),
      adaptParagraph(run, species),
    ].filter(Boolean),
    listTitle: scores.length ? 'Food vs each classmate' : '',
    list: scores.map((row) => ({
      id: row.id,
      name: row.name,
      colorIndex: colorIndex[row.id],
      detail: `${row.total.toFixed(0)} food${row === scores[0] ? ' · easiest meal' : row === scores[scores.length - 1] ? ' · hardest matchup' : ''}`,
    })),
  }
}

function arcParagraph(run, species, goneAt, count, winner) {
  const start = run.rules.startingCount ?? 1000
  const peak = peakInfo(run, species.id)
  const name = species.speciesName

  if (goneAt) {
    if (peak.max > start * 1.08 && peak.at > 0 && peak.at < goneAt) {
      return `${name} started at ${prettyCount(start)}, climbed to ${prettyCount(peak.max)} by season ${peak.at}, then crashed. It disappeared in season ${goneAt}. Zero left.`
    }
    return `${name} never really took off. From ${prettyCount(start)} it slid until it disappeared in season ${goneAt}. Zero left.`
  }

  if (winner.id === species.id) {
    if (run.result.reason === 'one-left') {
      return `${name} finished as the only species left (${prettyCount(count)} animals).`
    }
    if (peak.fell) {
      return `${name} peaked at ${prettyCount(peak.max)} in season ${peak.at}, then settled at ${prettyCount(count)} — still the biggest group in the room.`
    }
    return `${name} grew from ${prettyCount(start)} to ${prettyCount(count)} and finished with the biggest group in the room.`
  }

  if (peak.fell) {
    return `${name} did well at first: ${prettyCount(peak.max)} animals by season ${peak.at}. Then it faded to ${prettyCount(count)} by the end as ${winner.speciesName} took more of the room.`
  }
  if (count < 50) {
    return `${name} barely made it: ${prettyCount(count)} animals left.`
  }
  if (count >= start) {
    return `${name} finished with ${prettyCount(count)} animals. Still here, but not in charge.`
  }
  return `${name} shrank from ${prettyCount(start)} to ${prettyCount(count)}.`
}

function turningParagraph(run, species) {
  const peak = peakInfo(run, species.id)
  const series = seasonFood(run, species.id)
  if (series.length < 3) return ''
  const firstBelow = series.find(
    (row) => row.season >= Math.max(2, peak.at) && row.food < row.avg - 0.4,
  )
  if (!firstBelow) return ''

  const nearbyGone = []
  for (const season of run.seasons) {
    if (
      season.season >= firstBelow.season - 2 &&
      season.season <= firstBelow.season + 1
    ) {
      for (const id of season.extinct) {
        if (id !== species.id) nearbyGone.push(nameOf(run, id))
      }
    }
  }
  const uniqueGone = [...new Set(nearbyGone)]
  const foodBit = `its expected food fell below the class average (${firstBelow.food.toFixed(1)} vs ${firstBelow.avg.toFixed(1)})`

  if (uniqueGone.length > 0) {
    return `The slide started around season ${firstBelow.season}, when ${andList(uniqueGone)} left. After that the mix in the room changed, and ${foodBit}.`
  }

  const leader = leaderAt(run, firstBelow.season)
  if (leader && leader.id !== species.id) {
    return `Around season ${firstBelow.season}, ${foodBit}. ${leader.name} was already taking the extra space.`
  }
  return `Around season ${firstBelow.season}, ${foodBit}, so selection started shrinking it.`
}

function mixParagraphs(run, species, ranked, last, winner, goneAt) {
  const out = []
  const self = avgFood(run, species.id, species.id)
  const victim = bestOther(run, species.id)
  const foe = worstOther(run, species.id)
  const arenas = run.rules.arenas ?? []
  const packSelf = arenaFood(run, species.id, species.id, 'pack')

  switch (species.archetype) {
    case 'All Cheat': {
      const first = run.seasons[1]?.food?.[species.id]
      const firstAvg = mean(Object.values(run.seasons[1]?.food ?? {}))
      if (first != null && first > firstAvg + 2 && victim) {
        out.push(
          `Grabbing paid at first, mostly by taking food from ${victim.name}${victim.archetype === 'All Cooperate' ? ', who never hit back' : ''}.`,
        )
      } else {
        out.push(
          'Grabbing did not even pay at the start. Too many animals in this class copy or hold a grudge, so they stop being nice after one cheat.',
        )
      }
      if (self.total < 25) {
        out.push(
          `When two ${crowd(species.speciesName)} meet, they both grab, fight, and hide. They leave hungry. A group of them cannot feed itself.`,
        )
      }
      if (goneAt) {
        out.push(`Easy meals dried up, and it was gone by season ${goneAt}.`)
      }
      break
    }
    case 'All Cooperate': {
      if (foe) {
        out.push(
          `${foe.name} could take food because ${species.speciesName} never hit back. Always-nice is kind. It is also an easy lunch.`,
        )
      }
      if ((last.counts[species.id] ?? 0) > 0) {
        out.push(
          'A few hung on because copiers will keep sharing with a nice animal. There just were not many left to share with.',
        )
      }
      break
    }
    case 'Copycat': {
      out.push(
        'Copiers stay nice to other nice animals. That is a good life in a crowd of friends: they keep feeding each other instead of fighting.',
      )
      if (arenas.includes('pack') && packSelf >= 40) {
        out.push(
          `Pack hunting made that even better. Two ${crowd(species.speciesName)} going for the big meal together actually catch it (about ${packSelf.toFixed(0)} food when they meet).`,
        )
      } else if (arenas.includes('pack') && packSelf < 20) {
        out.push(
          'This one is small, so two of them often miss the big group meal. Friends that cannot catch dinner do not take over.',
        )
      }
      const otherCopy = ranked.find(
        (item) => item.archetype === 'Copycat' && item.id !== species.id,
      )
      if (otherCopy && winner.id === species.id) {
        const otherSelf = avgFood(run, otherCopy.id, otherCopy.id)
        const head = avgFood(run, species.id, otherCopy.id).total
        const reverse = avgFood(run, otherCopy.id, species.id).total
        if (reverse > head + 2) {
          out.push(
            `Here is the surprise: in a one-on-one, ${otherCopy.speciesName} even took a bit more food from ${species.speciesName}. ${species.speciesName} still took over because a bunch of ${crowd(species.speciesName)} feeding each other beat a bunch of ${crowd(otherCopy.speciesName)}. The group, not the duel, decided it.`,
          )
        } else if (self.total > otherSelf.total + 5) {
          out.push(
            `There was another copier, ${otherCopy.speciesName}. A crowd of ${crowd(species.speciesName)} ate more together, so they filled the room.`,
          )
        }
      }
      break
    }
    case 'Grudger': {
      out.push(
        'A grudge is a shield: cheat it once, and it is mean for the rest of the match. That punishes grabbers and testers.',
      )
      const detective = run.species.find((item) => item.archetype === 'Detective')
      const cheater = run.species.find((item) => item.archetype === 'All Cheat')
      if (detective) {
        const vsDet = avgFood(run, species.id, detective.id).total
        const vsSelf = self.total
        if (vsDet > vsSelf + 2) {
          out.push(
            `${detective.speciesName} opened with a test cheat. The grudge never forgave that, so ${species.speciesName} stopped being nice for the rest of those matches.`,
          )
        }
      }
      if (cheater) {
        out.push(
          `Against ${cheater.speciesName} the grudge kicked in after one grab, so the cheater could not keep milking it.`,
        )
      }
      if (winner.id !== species.id && winner.archetype === 'Copycat') {
        out.push(
          `Against ${winner.speciesName} it stayed nice the whole time, because a copier never cheated first. So this was not a manners contest. It was a food contest.`,
        )
        if (species.efficiency < winner.efficiency) {
          out.push(
            `${winner.speciesName} wastes less food when sharing (higher Efficiency), so a crowd of them packed on more each season.`,
          )
        }
      }
      break
    }
    case 'Detective': {
      out.push(
        'The test includes one mean move. That is a trap for anyone who never hits back, and a slap in the face for anyone who holds a grudge.',
      )
      const grudger = run.species.find((item) => item.archetype === 'Grudger')
      if (grudger) {
        const vsGrudge = avgFood(run, species.id, grudger.id).total
        if (vsGrudge < self.total - 15) {
          out.push(
            `${grudger.speciesName} never forgave that test. That pairing went badly.`,
          )
        }
      }
      if (victim?.archetype === 'All Cooperate') {
        out.push(
          `It did take a lot from ${victim.name}, the always-nice one. That meal got smaller every season as ${victim.name} shrank.`,
        )
      }
      if (goneAt) {
        out.push(
          `When easy targets got rare, ${species.speciesName} could not keep up. Gone by season ${goneAt}.`,
        )
      }
      break
    }
    default:
      break
  }

  return out
}

function matchupParagraph(run, species, scores) {
  if (!scores.length) return ''
  const best = scores[0]
  const worst = scores[scores.length - 1]
  const self = avgFood(run, species.id, species.id).total
  if (best.total - worst.total < 5) {
    return `It earned about the same food from everyone. When two ${crowd(species.speciesName)} met, they got ${self.toFixed(0)} food.`
  }
  return `Its easiest classmate was ${best.name} (${best.total.toFixed(0)} food). Its hardest was ${worst.name} (${worst.total.toFixed(0)} food). When two ${crowd(species.speciesName)} met, they got ${self.toFixed(0)}.`
}

function gameParagraph(run, species) {
  const arenas = run.rules.arenas ?? []
  if (arenas.length < 2) return ''
  const totals = arenaAverages(run, species.id)
  const ranked = [...arenas].sort((a, b) => totals[b] - totals[a])
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  if (totals[best] - totals[worst] < 3) return ''
  return `In this class its best game was ${ARENA_LABELS[best]} (about ${totals[best].toFixed(0)} food). ${ARENA_LABELS[worst]} paid the least (about ${totals[worst].toFixed(0)}).`
}

function adaptParagraph(run, species) {
  const self = avgFood(run, species.id, species.id)
  if (species.adaptation === 'pack') {
    const packSelf = self.pack ?? 0
    if (packSelf >= 40) {
      return `Pack was not flavor text here: two ${crowd(species.speciesName)} actually landed the stag together.`
    }
    if (packSelf < 20) {
      return `It brought Pack, but two of them often miss the big group meal, so the adaptation barely showed up.`
    }
  }
  if (species.adaptation === 'reserves') {
    const cheater = run.species.find((item) => item.archetype === 'All Cheat')
    if (cheater) {
      return `Reserves made it hurt less when ${cheater.speciesName} kept the food instead of sharing.`
    }
  }
  if (species.adaptation === 'armor') {
    const fighter = worstOther(run, species.id)
    if (fighter) {
      return `Armor added a little in fights, but it could not rewrite the matchups. ${fighter.name} was still a problem.`
    }
  }
  if (species.adaptation === 'camouflage') {
    const ambush = self.ambush ?? 0
    return `Camouflage is one extra Ambush roll. In this class that was worth about ${ambush.toFixed(0)} Ambush food against itself — usually the weakest extra in the mix.`
  }
  return ''
}

function endReason(run, season, winner, last) {
  const lead = `${winner.speciesName} had the most (${prettyCount(last.counts[winner.id] ?? 0)} animals).`
  if (run.result.reason === 'one-left') {
    return `By season ${season}, only ${winner.speciesName} was left.`
  }
  if (run.result.reason === 'stable') {
    return `By season ${season} the counts barely moved, so we stopped. ${lead}`
  }
  return `The clock hit ${season} seasons, so we stopped. ${lead}`
}

function rosterDetail(run, species, last) {
  const goneAt = extinctSeason(run, species.id)
  if (goneAt) return `gone, season ${goneAt}`
  return `${prettyCount(last.counts[species.id] ?? 0)} animals`
}

function extinctSeason(run, id) {
  return (
    run.seasons.find((season) => season.season > 0 && season.extinct.includes(id))
      ?.season ?? null
  )
}

function avgFood(run, a, b) {
  return run.matchups[a][b].avgFood
}

function arenaFood(run, a, b, arena) {
  return run.matchups[a][b].avgFood[arena] ?? 0
}

function bestOther(run, id) {
  return otherScores(run, id)[0] ?? null
}

function worstOther(run, id) {
  const scores = otherScores(run, id)
  return scores[scores.length - 1] ?? null
}

function otherScores(run, id) {
  return run.species
    .filter((species) => species.id !== id)
    .map((species) => ({
      id: species.id,
      name: species.speciesName,
      archetype: species.archetype,
      total: avgFood(run, id, species.id).total,
    }))
    .sort((a, b) => b.total - a.total)
}

function peakInfo(run, id) {
  let max = -1
  let at = 0
  for (const season of run.seasons) {
    const count = season.counts[id] ?? 0
    if (count > max) {
      max = count
      at = season.season
    }
  }
  const end = run.seasons[run.seasons.length - 1].counts[id] ?? 0
  return {
    max,
    at,
    fell: at > 0 && at < lastSeason(run) - 2 && max > end * 1.15,
  }
}

function seasonFood(run, id) {
  return run.seasons
    .filter((season) => season.season > 0 && season.food?.[id] != null)
    .map((season) => {
      const values = Object.values(season.food)
      return {
        season: season.season,
        food: season.food[id],
        avg: mean(values),
        count: season.counts[id] ?? 0,
      }
    })
}

function leaderAt(run, seasonNumber) {
  const record = run.seasons.find((season) => season.season === seasonNumber)
  if (!record) return null
  let best = null
  for (const species of run.species) {
    const count = record.counts[species.id] ?? 0
    if (!best || count > best.count) {
      best = { id: species.id, name: species.speciesName, count }
    }
  }
  return best
}

function nameOf(run, id) {
  return run.species.find((species) => species.id === id)?.speciesName ?? id
}

function andList(names) {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function arenaAverages(run, id) {
  const arenas = run.rules.arenas ?? []
  const others = run.species.map((species) => species.id)
  const sums = Object.fromEntries(arenas.map((arena) => [arena, 0]))
  for (const other of others) {
    const food = avgFood(run, id, other)
    for (const arena of arenas) sums[arena] += food[arena] ?? 0
  }
  const n = Math.max(1, others.length)
  for (const arena of arenas) sums[arena] /= n
  return sums
}

function lastSeason(run) {
  return run.seasons[run.seasons.length - 1].season
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function prettyCount(count) {
  return Math.round(count).toLocaleString('en-US')
}

function ordinal(value) {
  const teens = value % 100
  if (teens >= 11 && teens <= 13) return `${value}th`
  switch (value % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}

function crowd(name) {
  if (name.endsWith('s')) return name
  if (/(x|sh|ch)$/i.test(name)) return `${name}es`
  return `${name}s`
}

const ADAPTATION_LABELS = {
  armor: 'Armor',
  reserves: 'Reserves',
  pack: 'Pack',
  camouflage: 'Camouflage',
}

const ARENA_LABELS = {
  territory: 'Territory',
  food: 'Food Sharing',
  pack: 'Pack Hunting',
  ambush: 'Ambush',
}
