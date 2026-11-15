import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_GAMES, explainChallenge } from './challenge.js'
import './ChallengeOverlay.css'

// How long each beat of a challenge stays on screen, in milliseconds.
const INTRO_MS = 700 // the two names
const SPIN_MS = 1100 // the game names flick past before one settles
const LANDED_MS = 2600 // time to read what the game is and how each side plays
const ROUND_MS = 600 // one round of the game
const LAST_ROUND_MS = 700 // a breath after the final round
const RESULT_MS = 30000 // the result waits for E, but not for ever

const GAME_NAMES = Object.values(ALL_GAMES).map((game) => game.name)

const percent = (change) => {
  if (change <= -1) return 'died out'
  const value = Math.round(change * 1000) / 10
  return `${value > 0 ? '+' : ''}${value}%`
}
const signed = (points) => (points > 0 ? `+${points}` : String(points))
const round1 = (value) => String(Math.round(value * 10) / 10)
const headcount = (animals) =>
  `${animals > 0 ? '+' : ''}${animals.toLocaleString()} ${Math.abs(animals) === 1 ? 'animal' : 'animals'}`
/** "You earned 3.5 more than that." — how one side did against par. */
function standing(gap, who) {
  const size = round1(Math.abs(gap))
  if (size === '0') return `${who} earned exactly that.`
  return `${who} earned ${size} ${gap > 0 ? 'more' : 'less'} than that.`
}

/** What one side did in a round: its move in a normal game, its roll in a wildcard. */
function RoundChip({ round, side, game }) {
  if (round.moves) {
    return (
      <span className={`challenge-chip is-${round.moves[side]}`}>
        {game.moves[round.moves[side]]}
      </span>
    )
  }
  const won = round.points[side] > 0
  return (
    <span className={won ? 'challenge-chip is-roll is-best' : 'challenge-chip is-roll'}>
      Rolled {round.rolls[side]}
    </span>
  )
}

/**
 * Plays a finished challenge back in a small card: the surprise game and how each strategy plays,
 * ten rounds one by one, then what happened and why. `onReveal` fires when the result appears (that
 * is when the numbers in the sidebar should change) and `onDone` when the card closes. E or Enter
 * skips ahead.
 */
export default function ChallengeOverlay({ battle, onReveal, onDone }) {
  const { outcome, player, opponent, forced } = battle
  const game = ALL_GAMES[outcome.game]
  const notes = useMemo(
    () => explainChallenge(player, opponent, outcome),
    [player, opponent, outcome],
  )
  const total = outcome.rounds.length
  const [phase, setPhase] = useState('intro') // intro -> spin -> landed -> rounds -> result
  const [shown, setShown] = useState(0) // rounds played so far
  const [flick, setFlick] = useState(0)
  const callbacks = useRef({ onReveal, onDone })

  useEffect(() => {
    callbacks.current = { onReveal, onDone }
  })

  // The timeline: each beat schedules the next.
  useEffect(() => {
    let wait = RESULT_MS
    let next = () => callbacks.current.onDone()
    if (phase === 'intro') {
      wait = INTRO_MS
      next = () => setPhase('spin')
    } else if (phase === 'spin') {
      wait = SPIN_MS
      next = () => setPhase('landed')
    } else if (phase === 'landed') {
      wait = LANDED_MS
      next = () => setPhase('rounds')
    } else if (phase === 'rounds') {
      wait = shown === total ? LAST_ROUND_MS : ROUND_MS
      next = () => (shown === total ? setPhase('result') : setShown(shown + 1))
    }
    const timer = setTimeout(next, wait)
    return () => clearTimeout(timer)
  }, [phase, shown, total])

  // While the game is being picked, the names flick past.
  useEffect(() => {
    if (phase !== 'spin') return undefined
    const timer = setInterval(() => setFlick((value) => value + 1), 110)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase === 'result') callbacks.current.onReveal()
  }, [phase])

  // E or Enter: jump to the result, or close it.
  useEffect(() => {
    function onKey(event) {
      if (event.code !== 'KeyE' && event.code !== 'Enter') return
      if (event.repeat) return
      event.preventDefault()
      if (phase === 'result') {
        callbacks.current.onDone()
      } else {
        setShown(total)
        setPhase('result')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, total])

  const played = outcome.rounds.slice(0, shown)
  const mine = played.reduce((sum, round) => sum + round.points[0], 0)
  const theirs = played.reduce((sum, round) => sum + round.points[1], 0)
  const current = played[played.length - 1] || null
  const gameKnown = phase !== 'intro' && phase !== 'spin'
  const scoring = phase === 'rounds' || phase === 'result'
  const [mineFinal, theirsFinal] = outcome.food
  const headline =
    mineFinal === theirsFinal
      ? `Even, ${mineFinal} food each`
      : mineFinal > theirsFinal
        ? `You came out ahead, ${mineFinal} food to ${theirsFinal}`
        : `${opponent.speciesName} came out ahead, ${theirsFinal} food to ${mineFinal}`

  return (
    <section className="challenge" role="status">
      <p className="challenge-label">
        {forced ? `${opponent.speciesName} forced a challenge` : 'Challenge'}
        {phase === 'rounds' && shown > 0 ? ` · round ${shown} of ${total}` : ''}
      </p>

      <div className="challenge-sides">
        <div className="challenge-side">
          <span className="challenge-who">You · {player.speciesName}</span>
          <strong key={mine}>{scoring ? mine : '–'}</strong>
        </div>
        <div className="challenge-game">
          {phase === 'intro' ? (
            <span>The game is…</span>
          ) : (
            <>
              {gameKnown && game.wildcard && (
                <span className="challenge-wild">Wildcard</span>
              )}
              <strong
                key={gameKnown ? 'known' : flick}
                className={
                  !gameKnown ? undefined : game.wildcard ? 'is-known is-wild' : 'is-known'
                }
              >
                {gameKnown ? game.name : GAME_NAMES[flick % GAME_NAMES.length]}
              </strong>
            </>
          )}
        </div>
        <div className="challenge-side is-them">
          <span className="challenge-who">{opponent.speciesName}</span>
          <strong key={theirs}>{scoring ? theirs : '–'}</strong>
        </div>
      </div>

      {gameKnown && phase !== 'result' && (
        <div className="challenge-notes">
          <p>{notes.how}</p>
          <dl>
            <div>
              <dt>You</dt>
              <dd>{notes.mine}</dd>
            </div>
            <div>
              <dt>{opponent.speciesName}</dt>
              <dd>{notes.theirs}</dd>
            </div>
          </dl>
        </div>
      )}

      {scoring && (
        <ol className="challenge-pips" aria-label={`Round ${shown} of ${total}`}>
          {outcome.rounds.map((round, index) => {
            let state = ''
            if (index < shown) {
              const gap = round.points[0] - round.points[1]
              state = gap > 0 ? 'is-mine' : gap < 0 ? 'is-theirs' : 'is-even'
            }
            return <li key={index} className={state} />
          })}
        </ol>
      )}

      {phase === 'rounds' && (
        <div className="challenge-round" key={shown}>
          {current ? (
            <>
              <p className="challenge-moves">
                <RoundChip round={current} side={0} game={game} />
                <span className="challenge-gain">{signed(current.points[0])}</span>
                <span className="challenge-gap" aria-hidden="true">
                  ·
                </span>
                <span className="challenge-gain">{signed(current.points[1])}</span>
                <RoundChip round={current} side={1} game={game} />
              </p>
              <p className="challenge-note">{current.note}</p>
            </>
          ) : (
            <p className="challenge-note">Ten rounds. Here they come.</p>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="challenge-result">
          <h3>{headline}</h3>
          <p className="challenge-why-label">What happened</p>
          <p>{notes.meeting}</p>
          {notes.stats && <p>{notes.stats}</p>}
          <p className="challenge-why-label">Against the rest of the world</p>
          <p>
            Right now a typical animal earns {round1(outcome.par)} food from ten rounds
            of {game.name}. {standing(mineFinal - outcome.par, 'You')}{' '}
            {standing(theirsFinal - outcome.par, opponent.speciesName)}
          </p>
          <p className="challenge-aside">
            Every other species played a game of its own at the same time, so the
            changes below are after theirs too.
          </p>
          <p className="challenge-change">
            <span className={outcome.change[0] < 0 ? 'is-down' : 'is-up'}>
              Your population {percent(outcome.change[0])} ({headcount(outcome.animals[0])})
            </span>
            <span className={outcome.change[1] < 0 ? 'is-down' : 'is-up'}>
              {opponent.speciesName} {percent(outcome.change[1])} (
              {headcount(outcome.animals[1])})
            </span>
          </p>
        </div>
      )}

      <p className="challenge-keys">
        <kbd>E</kbd> {phase === 'result' ? 'to carry on' : 'to skip to the result'}
      </p>
    </section>
  )
}
