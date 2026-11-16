import { useEffect, useRef, useState } from 'react'
import './RoundStandings.css'

const READ_MS = 1800 // the standings sit still before anyone is removed
const REMOVE_MS = 650 // then the bottom species go one at a time, last place first

/**
 * The full standings: every living species in rank order, flowing down as many columns as fit.
 *   rows       every living species, biggest population first: [{ id, name, population }]
 *   bottomIds  the species at the bottom of the table (eliminated, or in danger)
 *   goneIds    which of those have already been struck off
 */
function StandingsList({ rows, playerId, bottomIds, goneIds }) {
  const bottom = new Set(bottomIds)
  return (
    <ol className="standings-list">
      {rows.map((row, index) => {
        const classes = ['standings-row']
        if (row.id === playerId) classes.push('is-you')
        if (bottom.has(row.id)) classes.push('is-bottom')
        if (goneIds.has(row.id)) classes.push('is-out')
        return (
          <li key={row.id} className={classes.join(' ')}>
            <span className="standings-rank">{index + 1}</span>
            <span className="standings-name">
              {row.name}
              {row.id === playerId ? ' (you)' : ''}
            </span>
            <span className="standings-count">
              {goneIds.has(row.id)
                ? 'Out'
                : Math.round(row.population).toLocaleString()}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The end of a round: the standings, then the bottom few struck off one by one.
 * `summary` is { round, rows, outIds, playerId, playerOut, won }. E or Enter skips the animation,
 * then calls `onContinue`.
 */
export default function RoundStandings({ summary, onContinue }) {
  const { round, rows, outIds, playerId, playerOut, won } = summary
  const [removed, setRemoved] = useState(0) // how many of outIds have been struck off so far
  const [started, setStarted] = useState(false)
  const done = removed >= outIds.length
  const continueRef = useRef(onContinue)

  useEffect(() => {
    continueRef.current = onContinue
  })

  useEffect(() => {
    if (done) return undefined
    const timer = setTimeout(
      () => {
        setStarted(true)
        setRemoved((count) => count + 1)
      },
      started ? REMOVE_MS : READ_MS,
    )
    return () => clearTimeout(timer)
  }, [removed, started, done])

  useEffect(() => {
    function onKey(event) {
      if (event.code !== 'KeyE' && event.code !== 'Enter') return
      if (event.repeat) return
      event.preventDefault()
      if (done) continueRef.current()
      else setRemoved(outIds.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, outIds.length])

  // outIds runs from last place upward, so the first `removed` of them are already gone.
  const gone = new Set(outIds.slice(0, removed))

  let verdict = null
  if (done && playerOut) {
    verdict = {
      title: 'Game over',
      text: 'Your species finished at the bottom of the standings and was eliminated.',
    }
  } else if (done && won) {
    verdict = {
      title: 'Last species standing',
      text: 'Every other species has been eliminated. You won.',
    }
  }

  return (
    <section
      className={rows.length > 8 ? 'standings is-wide' : 'standings'}
      role="status"
      aria-label={`Round ${round} standings`}
    >
      <header>
        <p className="standings-label">End of round {round}</p>
        <h2>{verdict ? verdict.title : 'Standings'}</h2>
        <p className="standings-lede">
          {verdict
            ? verdict.text
            : `The ${outIds.length} smallest ${outIds.length === 1 ? 'population is' : 'populations are'} eliminated.`}
        </p>
      </header>

      <StandingsList rows={rows} playerId={playerId} bottomIds={outIds} goneIds={gone} />

      <p className="standings-keys">
        <kbd>E</kbd>{' '}
        {!done
          ? 'to skip'
          : playerOut || won
            ? 'to see how your game went'
            : `to start round ${round + 1}`}
      </p>
    </section>
  )
}

const NOBODY = new Set()

/** The standings as they are right now, mid-round, with the species that would go if it ended. */
export function StandingsPeek({ round, rows, playerId, dangerIds }) {
  return (
    <section
      className={rows.length > 8 ? 'standings is-wide' : 'standings'}
      role="status"
      aria-label="Standings right now"
    >
      <header>
        <p className="standings-label">Round {round} · right now</p>
        <h2>Standings</h2>
        <p className="standings-lede">
          {dangerIds.length === 1
            ? 'The species marked at the bottom goes if the round ended now.'
            : `The ${dangerIds.length} marked at the bottom go if the round ended now.`}
        </p>
      </header>
      <StandingsList rows={rows} playerId={playerId} bottomIds={dangerIds} goneIds={NOBODY} />
    </section>
  )
}
