import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import BattleScene from './battle/BattleScene.jsx'
import ChallengeOverlay from './battle/ChallengeOverlay.jsx'
import RoundStandings, { StandingsPeek } from './battle/RoundStandings.jsx'
import {
  SEASON_SECONDS,
  STARTING_FOOD,
  buildMatchups,
  eliminate,
  playChallenge,
  populationOf,
  standings,
  stepSeason,
} from './battle/challenge.js'
import CreaturePortrait from './battle/CreaturePortrait.jsx'
import { ROSTER } from './creaturesupdate/roster.js'
import { loadCreatures } from './loadCreatures.js'
import './BattleArena.css'

const ROUND_SECONDS = 180 // how long a round lasts
const ELIMINATED_PER_ROUND = 5 // how many of the smallest populations go at the end of each round

const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const rosterByName = Object.fromEntries(
  ROSTER.map((row) => [row.name.toLowerCase(), row]),
)

function withRosterMatch(creature) {
  const match = rosterByName[String(creature.speciesName || '').toLowerCase()]
  if (!match) return creature
  return {
    ...creature,
    animals: match.animals,
    size: creature.size || match.stats?.size,
    efficiency: creature.efficiency || match.stats?.efficiency,
    agility: creature.agility || match.stats?.agility,
  }
}

const SHOWCASE = [
  {
    id: 'showcase:tusk-heron',
    speciesName: 'Tusk Heron',
    period: 'demo',
    archetype: 'Copycat',
    adaptation: 'camouflage',
    size: 3,
    efficiency: 4,
    agility: 5,
    traitCards: [],
    story: '',
    studentNames: ['Demo model'],
    habitat: 'aquatic',
    showcase: true,
  },
]

function creatorsLabel(creature) {
  if (creature.showcase) return 'Demo model'
  const names = (creature.studentNames || [])
    .flatMap((entry) =>
      String(entry || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
  if (names.length === 0) return 'Unknown designers'
  return names.join(', ')
}

function blockLabel(period) {
  if (period === 'demo') return 'Demo models'
  if (!period) return 'Other'
  return `Block ${period}`
}

function groupByBlock(options) {
  const order = []
  const groups = new Map()
  for (const creature of options) {
    const key = creature.showcase ? 'demo' : String(creature.period || '')
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(creature)
  }
  order.sort((a, b) => {
    if (a === 'demo') return -1
    if (b === 'demo') return 1
    return a.localeCompare(b)
  })
  for (const key of order) {
    groups.get(key).sort((a, b) => a.speciesName.localeCompare(b.speciesName))
  }
  return order.map((key) => ({
    key,
    label: blockLabel(key),
    creatures: groups.get(key),
  }))
}

function CreaturePicker({ options, value, onChange, label, goneIds }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const groups = useMemo(() => groupByBlock(options), [options])
  const selected = options.find((item) => item.id === value) || null

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="creature-picker" ref={rootRef}>
      <span className="creature-picker-label">{label}</span>
      <button
        type="button"
        className="creature-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <span className="creature-picker-current">
            <strong>{selected.speciesName}</strong>
            <small>{creatorsLabel(selected)}</small>
          </span>
        ) : (
          <span className="creature-picker-current">
            <strong>Select a creature</strong>
          </span>
        )}
      </button>
      {open && (
        <div className="creature-picker-menu" id={listId} role="listbox">
          {groups.map((group) => (
            <div className="creature-picker-group" key={group.key}>
              <p className="creature-picker-block">{group.label}</p>
              <ul>
                {group.creatures.map((creature) => {
                  const active = creature.id === value
                  return (
                    <li key={creature.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={active ? 'is-current' : undefined}
                        disabled={goneIds.has(creature.id)}
                        onClick={() => {
                          onChange(creature.id)
                          setOpen(false)
                        }}
                      >
                        <strong>{creature.speciesName}</strong>
                        <small>
                          {goneIds.has(creature.id)
                            ? 'Eliminated'
                            : creatorsLabel(creature)}
                        </small>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerCard({
  creature,
  options,
  value,
  onChange,
  population,
  food,
  season,
  goneIds,
  rank,
  alive,
}) {
  return (
    <article className="fighter-card">
      <div className="fighter-head">
        <div className="fighter-copy">
          <p className="fighter-side">Playing as</p>
          {creature ? (
            <>
              <h2>{creature.speciesName}</h2>
              <p className="fighter-makers">{creatorsLabel(creature)}</p>
            </>
          ) : (
            <div className="fighter-empty">
              <h2>Choose a creature</h2>
              <p className="fighter-tag">Pick any classroom creature.</p>
            </div>
          )}
        </div>
        {creature ? <CreaturePortrait creature={creature} /> : null}
      </div>
      {creature ? (
        <div className="fighter-stats" aria-label="Stats">
          <div>
            <strong>{creature.size}</strong>
            <span>Size</span>
          </div>
          <div>
            <strong>{creature.efficiency}</strong>
            <span>Eff</span>
          </div>
          <div>
            <strong>{creature.agility}</strong>
            <span>Agi</span>
          </div>
        </div>
      ) : null}
      {creature ? (
        <dl className="fighter-vitals">
          <div>
            <dt>Population</dt>
            {/* keyed by value so the number pops each time it changes */}
            <dd key={Math.round(population)}>
              {population > 0 ? Math.round(population).toLocaleString() : 'Extinct'}
            </dd>
          </div>
          <div>
            <dt>Food</dt>
            <dd key={Math.round(food)}>{Math.round(food).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd key={rank}>
              {rank > 0 ? (
                <>
                  {rank}
                  <small> of {alive}</small>
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
        </dl>
      ) : null}
      {creature ? <p className="fighter-season">Season {season}</p> : null}
      <CreaturePicker
        label="Creature"
        options={options}
        value={value}
        onChange={onChange}
        goneIds={goneIds}
      />
    </article>
  )
}

export default function BattleArena() {
  const [creatures, setCreatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playerId, setPlayerId] = useState(SHOWCASE[0]?.id || '')
  const [terrainKind, setTerrainKind] = useState('savanna')

  useEffect(() => {
    let cancelled = false
    loadCreatures().then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setError(result.message)
        setCreatures([])
        return
      }
      const sorted = result.creatures
        .map(withRosterMatch)
        .sort((a, b) => {
          const period = String(a.period).localeCompare(String(b.period))
          if (period !== 0) return period
          return a.speciesName.localeCompare(b.speciesName)
        })
      setCreatures(sorted)
      setError('')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Population of every species and the food each playable creature has earned, for this visit.
  const [populations, setPopulations] = useState({})
  const [food, setFood] = useState({})
  const [nearby, setNearby] = useState(null)
  const [battle, setBattle] = useState(null) // the challenge being played back, if any
  const [pointerHeld, setPointerHeld] = useState(false) // true while the view has captured the pointer

  useEffect(() => {
    const onChange = () => setPointerHeld(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  const options = useMemo(() => [...SHOWCASE, ...creatures], [creatures])
  const player = options.find((item) => item.id === playerId) || null

  // The world carries on around the player. Every season, each species has an encounter with a
  // stranger from the whole world and grows or shrinks by the food that typically pays. Seasons
  // wait while a challenge is on screen.
  const [season, setSeason] = useState(1)
  const matchups = useMemo(() => buildMatchups(options), [options])
  // Rounds. A clock counts down; at zero the smallest populations are eliminated, and if the
  // player's species is among them the game is over. Everything waits while a challenge or the
  // standings are on screen.
  const [round, setRound] = useState(1)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [roundEnd, setRoundEnd] = useState(null) // the standings being shown, if any
  const [run, setRun] = useState(1) // goes up each time the game is restarted
  const inBattle = Boolean(battle)
  const paused = inBattle || Boolean(roundEnd)
  const ready = !loading && options.length > 1 // no clock until there is someone to play against

  useEffect(() => {
    if (paused || !ready || secondsLeft <= 0) return undefined
    const timer = setInterval(
      () => setSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    )
    return () => clearInterval(timer)
  }, [paused, ready, secondsLeft])

  // Time is up (and any challenge has finished): rank everyone and remove the bottom of the table.
  useEffect(() => {
    if (secondsLeft > 0 || paused || !ready) return
    const rows = standings(options, populations)
    const count = Math.min(ELIMINATED_PER_ROUND, Math.max(0, rows.length - 1))
    const outIds = rows.slice(rows.length - count).reverse().map((row) => row.id) // last place first
    const playerAlive = rows.some((row) => row.id === playerId)
    const playerOut = !playerAlive || outIds.includes(playerId)
    setRoundEnd({
      round,
      rows,
      outIds,
      playerId,
      playerOut,
      won: !playerOut && rows.length - count === 1,
    })
    setPopulations(eliminate(options, populations, outIds))
  }, [secondsLeft, paused, ready, options, populations, playerId, round])

  const closeStandings = useCallback(() => {
    if (!roundEnd) return
    if (roundEnd.playerOut || roundEnd.won) {
      // Play again: a fresh world.
      setPopulations({})
      setFood({})
      setSeason(1)
      setRound(1)
      setRun((current) => current + 1)
    } else {
      setRound((current) => current + 1)
    }
    setSecondsLeft(ROUND_SECONDS)
    setRoundEnd(null)
  }, [roundEnd])

  // Where everyone stands right now, and who would go if the round ended this second.
  const table = useMemo(() => standings(options, populations), [options, populations])
  const rank = table.findIndex((row) => row.id === playerId) + 1
  const dangerIds = useMemo(() => {
    const count = Math.min(ELIMINATED_PER_ROUND, Math.max(0, table.length - 1))
    return table.slice(table.length - count).map((row) => row.id)
  }, [table])

  // A pinch on the trackpad would zoom the whole page, and because the arena fills the window
  // exactly, a zoomed page pushes the sidebar and clock half off screen with no way to scroll back.
  // So pinches are swallowed everywhere on this page.
  const pageRef = useRef(null)
  useEffect(() => {
    const page = pageRef.current
    if (!page) return undefined
    const onWheel = (event) => {
      if (event.ctrlKey) event.preventDefault() // browsers report a trackpad pinch as ctrl + wheel
    }
    const onGesture = (event) => event.preventDefault() // Safari's own pinch events
    page.addEventListener('wheel', onWheel, { passive: false })
    page.addEventListener('gesturestart', onGesture)
    page.addEventListener('gesturechange', onGesture)
    return () => {
      page.removeEventListener('wheel', onWheel)
      page.removeEventListener('gesturestart', onGesture)
      page.removeEventListener('gesturechange', onGesture)
    }
  }, [])

  // Holding Tab shows the standings mid-round.
  const [peeking, setPeeking] = useState(false)
  useEffect(() => {
    const onDown = (event) => {
      if (event.code !== 'Tab') return
      event.preventDefault()
      setPeeking(true)
    }
    const onUp = (event) => {
      if (event.code === 'Tab') setPeeking(false)
    }
    const onBlur = () => setPeeking(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const goneIds = useMemo(
    () =>
      new Set(
        options
          .filter((creature) => populationOf(populations, creature.id) <= 0)
          .map((creature) => creature.id),
      ),
    [options, populations],
  )

  useEffect(() => {
    if (paused) return undefined
    const timer = setInterval(() => {
      setPopulations((current) => stepSeason(options, current, matchups))
      setSeason((current) => current + 1)
    }, SEASON_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [paused, options, matchups])

  // A challenge is decided the moment it starts, then played back as a short show.
  // The sidebar numbers only change when the show reaches its verdict.
  const challenge = useCallback(
    (opponent, forced = false) => {
      if (!player || battle) return
      setBattle({
        outcome: playChallenge(player, opponent, options, populations, matchups),
        player,
        opponent,
        forced,
        revealed: false,
      })
    },
    [player, battle, options, populations, matchups],
  )

  const revealBattle = useCallback(() => {
    if (!battle || battle.revealed) return
    setBattle({ ...battle, revealed: true })
    setPopulations((current) => ({ ...current, ...battle.outcome.populations }))
    setFood((current) => ({
      ...current,
      [battle.player.id]:
        (current[battle.player.id] ?? STARTING_FOOD) + battle.outcome.food[0],
    }))
  }, [battle])

  const endBattle = useCallback(() => setBattle(null), [])

  return (
    <div className="battle-page" ref={pageRef}>
      <div className="battle-stage">
        <BattleScene
          creatures={options}
          playerId={playerId}
          populations={populations}
          onNearby={setNearby}
          onChallenge={challenge}
          busy={paused}
          run={run}
          terrainKind={terrainKind}
        />
      </div>

      <div className="battle-hud">
        <div className="battle-top">
          <a className="battle-home" href="#design" aria-label="Return home">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M10.2 2.4 4.6 8l5.6 5.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          {ready && (
            <p
              className={
                secondsLeft <= 10 ? 'battle-clock is-ending' : 'battle-clock'
              }
              role="timer"
              aria-label={`Round ${round}, ${clock(secondsLeft)} left`}
            >
              <span>Round {round}</span>
              <strong>{clock(secondsLeft)}</strong>
            </p>
          )}
          <div className="battle-terrain" role="group" aria-label="Terrain">
            {[
              ['savanna', 'Savanna'],
              ['jungle', 'Jungle'],
            ].map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={terrainKind === kind ? 'is-current' : undefined}
                aria-pressed={terrainKind === kind}
                onClick={(event) => {
                  setTerrainKind(kind)
                  event.currentTarget.blur() // so Space and E go back to the game
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="battle-fighters">
          <PlayerCard
            creature={player}
            options={options}
            value={playerId}
            onChange={setPlayerId}
            population={populationOf(populations, playerId)}
            food={food[playerId] ?? STARTING_FOOD}
            season={season}
            goneIds={goneIds}
            rank={rank}
            alive={table.length}
          />
        </div>

        <p
          className={pointerHeld ? 'battle-look is-held' : 'battle-look'}
          role="status"
        >
          {pointerHeld ? (
            <>
              <kbd>Esc</kbd> to stop looking around and get your cursor back
            </>
          ) : (
            'Click the view to look around'
          )}
        </p>

        <div className="battle-bottom">
          {nearby && !paused && (
            <p className="battle-prompt">
              <kbd>E</kbd> Challenge {nearby.speciesName}
            </p>
          )}
          {!paused && (
            <p className="battle-hint">
              <kbd>W</kbd>
              <kbd>S</kbd> walk · <kbd>A</kbd>
              <kbd>D</kbd> turn · <kbd>Space</kbd> jump · <kbd>E</kbd> challenge · hold{' '}
              <kbd>Tab</kbd> standings
            </p>
          )}
        </div>
      </div>

      {battle && (
        <ChallengeOverlay
          battle={battle}
          onReveal={revealBattle}
          onDone={endBattle}
        />
      )}

      {roundEnd && (
        <RoundStandings summary={roundEnd} onContinue={closeStandings} />
      )}

      {peeking && !paused && ready && (
        <StandingsPeek
          round={round}
          rows={table}
          playerId={playerId}
          dangerIds={dangerIds}
        />
      )}

      {loading && (
        <div className="battle-loading" role="status">
          Loading classroom creatures…
        </div>
      )}
      {!loading && error && (
        <div className="battle-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
