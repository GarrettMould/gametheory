import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_GAMES, WRITTEN_MIN_WORDS, explainChallenge } from './challenge.js'
import { PLACES } from './places.js'
import './ChallengeOverlay.css'

// How long each beat of a challenge stays on screen, in milliseconds.
const INTRO_MS = 700 // the two names
const SPIN_MS = 1100 // the game names flick past before one settles
const LANDED_MS = 700 // a moment after the prediction, before the rounds start
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

/** One plain sentence on why the populations moved the way they did. */
function verdictLine(mineGap, theirsGap) {
  if (mineGap < 0 && theirsGap < 0) {
    return 'Earning food is not enough on its own. Both of you fell behind what the rest of the world is earning, so both populations shrank.'
  }
  if (mineGap > 0 && theirsGap > 0) {
    return 'Both of you out-earned the rest of the world, so both populations grew.'
  }
  if (mineGap > 0) return 'You out-earned the rest of the world and they fell behind it, so you grew and they shrank.'
  if (theirsGap > 0) return 'They out-earned the rest of the world and you fell behind it, so they grew and you shrank.'
  return 'This was about what the rest of the world is earning, so it changed little.'
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
 *
 * Some challenges carry a question (`battle.question`). It is asked before the explanation, and the
 * result stays hidden until it is answered so it cannot give the answer away. A choice question takes
 * one number key; a written one takes a typed sentence and Enter. `onAnswer(correct)` reports how it
 * went (a written answer always counts).
 */
export default function ChallengeOverlay({ battle, onReveal, onDone, onAnswer }) {
  const { outcome, player, opponent, forced, question } = battle
  const [picked, setPicked] = useState(null) // the option chosen, or the sentence typed, once answered
  const [draft, setDraft] = useState('') // a written answer in progress
  const asking = Boolean(question) && picked === null
  // Before the rounds, the player predicts who will come out ahead: 0 you, 1 them, 2 a tie.
  const [guess, setGuess] = useState(null)
  const predicting = guess === null
  const winner = outcome.food[0] > outcome.food[1] ? 0 : outcome.food[0] < outcome.food[1] ? 1 : 2
  const guessOptions = ['You', opponent.speciesName, 'Tie']
  const written = question?.kind === 'written'
  const draftWords = draft.trim().split(/\s+/).filter(Boolean).length
  const game = ALL_GAMES[outcome.game]
  const notes = useMemo(
    () => explainChallenge(player, opponent, outcome),
    [player, opponent, outcome],
  )
  const total = outcome.rounds.length
  // intro -> spin -> landed -> rounds -> result. The suspense of the draw is only for a game
  // nobody chose: one the player picked, or one set by a place, is shown straight away.
  const [phase, setPhase] = useState(battle.reason === 'caught' ? 'intro' : 'landed')
  const [shown, setShown] = useState(0) // rounds played so far
  const [flick, setFlick] = useState(0)
  const callbacks = useRef({ onReveal, onDone, onAnswer })

  useEffect(() => {
    callbacks.current = { onReveal, onDone, onAnswer }
  })

  // The timeline: each beat schedules the next. The prediction and any question wait for an
  // answer, however long it takes.
  useEffect(() => {
    if (phase === 'result' && asking) return undefined
    if (phase === 'landed' && predicting) return undefined
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
  }, [phase, shown, total, asking, predicting])

  // While the game is being picked, the names flick past.
  useEffect(() => {
    if (phase !== 'spin') return undefined
    const timer = setInterval(() => setFlick((value) => value + 1), 110)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'result' || asking) return
    callbacks.current.onReveal(guess === null ? null : { guess, correct: guess === winner })
  }, [phase, asking, guess, winner])

  // Predicting the winner: one number key, once the game and both strategies are on show.
  useEffect(() => {
    if (phase !== 'landed' || !predicting) return undefined
    function onKey(event) {
      const choice = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 }[event.code]
      if (choice == null || event.repeat) return
      event.preventDefault()
      setGuess(choice)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, predicting])

  // Answering a choice question: one number key.
  useEffect(() => {
    if (phase !== 'result' || !asking || written) return undefined
    function onKey(event) {
      const choice = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 }[event.code]
      if (choice == null || choice >= question.options.length || event.repeat) return
      event.preventDefault()
      setPicked(choice)
      callbacks.current.onAnswer?.(choice === question.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, asking, written, question])

  // E or Enter: jump to the result, or close it.
  useEffect(() => {
    function onKey(event) {
      if (event.code !== 'KeyE' && event.code !== 'Enter') return
      if (event.repeat || event.target?.tagName === 'TEXTAREA') return // typing an answer
      event.preventDefault()
      if (phase === 'result') {
        if (!asking) callbacks.current.onDone() // a question has to be answered first
      } else if (!predicting) {
        // skipping ahead only once a prediction is in
        setShown(total)
        setPhase('result')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, total, asking, predicting])

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
        {forced
          ? `${opponent.speciesName} caught you`
          : battle.reason === 'place'
            ? `Challenge at ${PLACES[battle.placeType]?.name ?? 'this place'}`
            : 'Challenge · your pick'}
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
          {phase === 'landed' && predicting && (
            <div className="challenge-predict">
              <p className="challenge-why-label">Your prediction</p>
              <h3>Based on the game and both strategies, who comes out ahead?</h3>
              <ol>
                {guessOptions.map((option, index) => (
                  <li key={option}>
                    <kbd>{index + 1}</kbd>
                    {option}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {!predicting && (
            <p className="challenge-guessed">
              You predicted: <strong>{guessOptions[guess]}</strong>
            </p>
          )}
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

      {phase === 'result' && asking && !written && (
        <div className="challenge-question">
          <p className="challenge-why-label">Question</p>
          <h3>{question.prompt}</h3>
          <ol>
            {question.options.map((option, index) => (
              <li key={option}>
                <kbd>{index + 1}</kbd>
                {option}
              </li>
            ))}
          </ol>
        </div>
      )}

      {phase === 'result' && asking && written && (
        <div className="challenge-question">
          <p className="challenge-why-label">In your own words</p>
          <h3>{question.prompt}</h3>
          <textarea
            autoFocus
            rows={3}
            maxLength={280}
            value={draft}
            placeholder="Type a sentence, then press Enter"
            aria-label={question.prompt}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation() // letters typed here are not game keys
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (draftWords < WRITTEN_MIN_WORDS) return
              setPicked(draft.trim())
              callbacks.current.onAnswer?.(true)
            }}
            onKeyUp={(event) => event.stopPropagation()}
          />
        </div>
      )}

      {phase === 'result' && !asking && (
        <div className="challenge-result">
          {guess !== null && (
            <p className={guess === winner ? 'challenge-marked is-right' : 'challenge-marked'}>
              <strong>{guess === winner ? 'You called it.' : 'Not this time.'}</strong> You
              predicted {guess === 2 ? 'a tie' : `${guessOptions[guess] === 'You' ? 'you' : guessOptions[guess]} would come out ahead`}.
            </p>
          )}
          {question && !written && (
            <p className={picked === question.answer ? 'challenge-marked is-right' : 'challenge-marked'}>
              <strong>{picked === question.answer ? 'Right.' : 'Not quite.'}</strong>{' '}
              {question.because}
            </p>
          )}
          {question && written && (
            <p className="challenge-marked is-right">
              <strong>You wrote:</strong> {picked} <em>Compare it with what happened, below.</em>
            </p>
          )}
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
          <p className="challenge-verdict">{verdictLine(mineFinal - outcome.par, theirsFinal - outcome.par)}</p>
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
        {phase !== 'result' && predicting ? (
          gameKnown ? (
            <>Press 1, 2 or 3 to predict</>
          ) : (
            <>The game is being chosen…</>
          )
        ) : phase === 'result' && asking ? (
          written ? (
            <>
              {draftWords < WRITTEN_MIN_WORDS
                ? `At least ${WRITTEN_MIN_WORDS} words, then `
                : ''}
              <kbd>Enter</kbd> to answer
            </>
          ) : (
            <>Press the number of your answer</>
          )
        ) : (
          <>
            <kbd>E</kbd> {phase === 'result' ? 'to carry on' : 'to skip to the result'}
          </>
        )}
      </p>
    </section>
  )
}
