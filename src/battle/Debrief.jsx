import { useEffect, useRef } from 'react'
import './Debrief.css'

const signed = (value) => `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`

/** A small table of how the player did against each kind of opponent, or at each game. */
function Averages({ title, rows }) {
  if (rows.length === 0) return null
  return (
    <div className="debrief-averages">
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span>{row.name}</span>
            <small>
              {row.games} {row.games === 1 ? 'game' : 'games'}
            </small>
            <strong className={row.average < 0 ? 'is-down' : 'is-up'}>{signed(row.average)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The end-of-game debrief (see buildDebrief): where the player finished, what they did, what
 * helped and hurt, and a question to talk about. E or Enter calls `onContinue`.
 */
export default function Debrief({ debrief, onContinue }) {
  const continueRef = useRef(onContinue)
  useEffect(() => {
    continueRef.current = onContinue
  })
  useEffect(() => {
    function onKey(event) {
      if ((event.code !== 'KeyE' && event.code !== 'Enter') || event.repeat) return
      event.preventDefault()
      continueRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="debrief" role="status" aria-label="How your game went">
      <header>
        <p className="debrief-label">How it went · you played {debrief.strategy}</p>
        <h2>{debrief.title}</h2>
        <p>{debrief.placement}</p>
      </header>

      <ul className="debrief-facts">
        {debrief.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>

      {(debrief.best || debrief.worst) && (
        <dl className="debrief-moments">
          {debrief.best && (
            <div>
              <dt>Best challenge</dt>
              <dd>
                {debrief.best.text}
                <small>{debrief.best.detail}</small>
              </dd>
            </div>
          )}
          {debrief.worst && (
            <div>
              <dt>Worst challenge</dt>
              <dd>
                {debrief.worst.text}
                <small>{debrief.worst.detail}</small>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="debrief-tables">
        <Averages title="Against each strategy" rows={debrief.byStrategy} />
        <Averages title="At each game" rows={debrief.byGame} />
      </div>
      {debrief.byStrategy.length > 0 && (
        <p className="debrief-key">
          Numbers are food above or below what a typical animal earned, on average.
        </p>
      )}

      <div className="debrief-why">
        <h3>What decided it</h3>
        <p>{debrief.takeaway}</p>
        <h3>Talk about</h3>
        <p>{debrief.discuss}</p>
      </div>

      <p className="debrief-keys">
        <kbd>E</kbd> to play again
      </p>
    </section>
  )
}
