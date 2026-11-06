import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './ArenaLab.css'
import AdminLock from './AdminLock.jsx'
import { isLabUnlocked } from './adminPin.js'
import {
  ADAPTATIONS,
  ARCHETYPES,
  makeRandomClass,
  runEvolution,
} from './arena/index.js'
import { explainRun } from './arena/explain.js'
import ExplainModal from './ExplainModal.jsx'
import { loadCreatures } from './loadCreatures.js'
import PayoffMatrices from './PayoffMatrices.jsx'
import PredictModal from './PredictModal.jsx'

const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const SAMPLE_CLASS = 'sample'

const SEASON_STEP = 5
const PLAY_MS = 2500

const ARENA_LABELS = {
  territory: 'Territory',
  food: 'Food Sharing',
  pack: 'Pack Hunting',
  ambush: 'Ambush',
}

const SETTING_HELP = {
  seed: 'The random-number starter. It drives the 50 practice matches that fill the matchup table, and the luck each season. Seed 1 is the default. Change it to see whether a winner is robust or just lucky. Leave it the same when you are comparing other settings.',
  selectionStrength:
    'How hard a food advantage turns into extra offspring. Each season a species grows by 1 + selection strength × (its food − class average). At 0.01, being 10 food above average is about a 10% bump before noise. Turn it up and winners take over fast. Turn it down and mixed groups last longer. Growth is never allowed below 5%, so a terrible season cannot wipe a species in one shot.',
  seasonNoise:
    'Random wobble after selection, so a slightly worse species can still have a good year. At 0.03, each living species is multiplied by a random factor between 0.97 and 1.03. 0 is a clean, luck-free replay. Higher values make the chart jitter and can save a species that was about to drop out.',
  maxSeasons:
    'The hard stop. Default 30. The run can end earlier if only one species is left, or if counts barely move for 5 seasons in a row (within 1%). If you hit the cap with several species still up, the result line will say time ran out.',
  arenas:
    'Which games count toward food. A match is 10 rounds of each checked game. Uncheck one to see whether a strategy only wins because of that game. Each species starts at 1,000. Total population stays at class size × 1,000. A count under 10 is extinct.',
}

const MOVE_LABELS = {
  territory: { cooperate: 'DISPLAY', cheat: 'ESCALATE' },
  food: { cooperate: 'SHARE', cheat: 'KEEP' },
  pack: { cooperate: 'STAG', cheat: 'HARE' },
  ambush: { cooperate: 'FORAGE', cheat: 'AMBUSH' },
}

const ADAPTATION_LABELS = {
  armor: 'Armor',
  reserves: 'Reserves',
  pack: 'Pack',
  camouflage: 'Camouflage',
}

const COLORS = [
  '#245246',
  '#8a4b12',
  '#3d3a72',
  '#1d6b8a',
  '#8f2d2d',
  '#1f6b45',
  '#6b4f1d',
  '#5a2d6b',
  '#2d5a3a',
  '#6b3a1d',
  '#1d4a6b',
  '#6b1d3a',
]

function colorFor(index) {
  return COLORS[index % COLORS.length]
}

function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
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
    <span className="info-tip" ref={wrapRef}>
      <button
        type="button"
        className="info-tip-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open && (
        <span className="info-tip-panel" id={id} role="tooltip">
          {children}
        </span>
      )}
    </span>
  )
}

function lastSeason(run) {
  return run.seasons[run.seasons.length - 1].season
}

function seasonRecord(run, season) {
  return run.seasons.find((item) => item.season === season) ?? run.seasons[0]
}

function clampSeason(run, season) {
  return Math.max(0, Math.min(season, lastSeason(run)))
}

function extinctSeasonFor(run, id) {
  return (
    run.seasons.find(
      (season) => season.season > 0 && season.extinct.includes(id),
    )?.season ?? null
  )
}

function formatCount(count) {
  return Math.round(count).toLocaleString()
}

function formatDelta(count) {
  const rounded = Math.round(count)
  if (rounded > 0) return `+${rounded.toLocaleString()}`
  if (rounded < 0) return rounded.toLocaleString()
  return '0'
}

function standingsRows(run, revealedSeason, previousSeason) {
  const now = seasonRecord(run, revealedSeason)
  const prev = seasonRecord(run, previousSeason)
  return [...run.species]
    .map((species, index) => {
      const extinctSeason = extinctSeasonFor(run, species.id)
      const gone = extinctSeason != null && extinctSeason <= revealedSeason
      return {
        ...species,
        index,
        count: now.counts[species.id] ?? 0,
        delta: (now.counts[species.id] ?? 0) - (prev.counts[species.id] ?? 0),
        food: now.food?.[species.id],
        extinctSeason: gone ? extinctSeason : null,
      }
    })
    .sort((a, b) => b.count - a.count)
}

function isPlayable(creature) {
  return (
    Boolean(creature?.id) &&
    ARCHETYPES.includes(creature.archetype) &&
    ADAPTATIONS.includes(creature.adaptation) &&
    Number.isInteger(creature.size) &&
    creature.size >= 1 &&
    creature.size <= 6 &&
    Number.isInteger(creature.efficiency) &&
    creature.efficiency >= 1 &&
    creature.efficiency <= 6 &&
    Number.isInteger(creature.agility) &&
    creature.agility >= 1 &&
    creature.agility <= 6
  )
}

function classLabel(source) {
  return source === SAMPLE_CLASS ? 'Random sample' : `Block ${source}`
}

function ClassRoster({
  source,
  onSource,
  creatures,
  submittedCount,
  loading,
  loadError,
  onShuffle,
}) {
  const sample = source === SAMPLE_CLASS
  const skipped = Math.max(0, submittedCount - creatures.length)

  return (
    <section className="sheet">
      <p className="eyebrow">Class</p>
      <div className="lab-class-head">
        <h2>{classLabel(source)}</h2>
        <div className="lab-class-pick">
          <label className="field" htmlFor="lab-class">
            <span>Block</span>
            <select
              id="lab-class"
              value={source}
              onChange={(event) => onSource(event.target.value)}
            >
              <option value={SAMPLE_CLASS}>Random sample class</option>
              {BLOCKS.map((block) => (
                <option key={block} value={block}>
                  Block {block}
                </option>
              ))}
            </select>
          </label>
          {sample && (
            <button type="button" className="secondary" onClick={onShuffle}>
              New random class
            </button>
          )}
        </div>
      </div>
      <p className="hint">
        {sample
          ? 'Six generated teams. Each starts at 1,000 animals. Shuffle to draw a new mix of strategies, stats, and adaptations.'
          : 'Submitted creatures from this block. Each starts at 1,000 animals. Incomplete entries are left out.'}
      </p>
      {loading && <p className="hint">Loading submitted creatures…</p>}
      {loadError && <p className="error">{loadError}</p>}
      {!loading && !loadError && creatures.length === 0 && (
        <p className="hint">
          {sample
            ? 'Could not build a sample class.'
            : `No playable creatures in Block ${source} yet.`}
        </p>
      )}
      {skipped > 0 && (
        <p className="hint">
          {skipped} submitted creature{skipped === 1 ? '' : 's'} skipped (missing
          a strategy, adaptation, or stats).
        </p>
      )}
      {creatures.length > 0 && (
        <div className="lab-table-wrap">
          <table className="lab-table lab-class">
            <thead>
              <tr>
                <th>Species</th>
                <th>Strategy</th>
                <th>Size</th>
                <th>Efficiency</th>
                <th>Agility</th>
                <th>Adaptation</th>
              </tr>
            </thead>
            <tbody>
              {creatures.map((creature, index) => (
                <tr key={creature.id}>
                  <th>
                    <i className="lab-swatch" style={{ background: colorFor(index) }} />
                    {creature.speciesName}
                  </th>
                  <td>{creature.archetype}</td>
                  <td>{creature.size}</td>
                  <td>{creature.efficiency}</td>
                  <td>{creature.agility}</td>
                  <td>{ADAPTATION_LABELS[creature.adaptation]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Standings({ run, revealedSeason, previousSeason }) {
  const rows = standingsRows(run, revealedSeason, previousSeason)
  const showFood = revealedSeason > 0
  return (
    <div className="lab-table-wrap">
      <table className="lab-table lab-class">
        <thead>
          <tr>
            <th>Species</th>
            <th>Strategy</th>
            {showFood && <th>Food</th>}
            <th>Count</th>
            <th>Change</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.extinctSeason ? 'is-extinct' : undefined}>
              <th>
                <i className="lab-swatch" style={{ background: colorFor(row.index) }} />
                {row.speciesName}
              </th>
              <td>{row.archetype}</td>
              {showFood && (
                <td>{row.food == null ? '—' : row.food.toFixed(1)}</td>
              )}
              <td>{formatCount(row.count)}</td>
              <td
                className={
                  row.delta > 0 ? 'is-pos' : row.delta < 0 ? 'is-neg' : undefined
                }
              >
                {formatDelta(row.delta)}
              </td>
              <td>
                {row.extinctSeason
                  ? `Gone · season ${row.extinctSeason}`
                  : 'Still here'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Playback({
  run,
  revealedSeason,
  playing,
  onBack,
  onNext,
  onPlay,
  onEnd,
}) {
  const max = lastSeason(run)
  const atStart = revealedSeason <= 0
  const atEnd = revealedSeason >= max
  return (
    <div className="lab-playback">
      <p className="lab-now">
        Season {revealedSeason} of {max}
      </p>
      <div className="actions">
        <button type="button" className="secondary" onClick={onBack} disabled={atStart}>
          Back 5
        </button>
        <button
          type="button"
          onClick={onPlay}
          aria-pressed={playing}
          disabled={atEnd && !playing}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={onNext} disabled={atEnd}>
          Next 5 seasons
        </button>
        <button type="button" className="secondary" onClick={onEnd} disabled={atEnd}>
          Jump to end
        </button>
      </div>
    </div>
  )
}

function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / mag
  const step =
    normalized <= 1 ? mag : normalized <= 2 ? 2 * mag : normalized <= 5 ? 5 * mag : 10 * mag
  const ticks = []
  for (let value = 0; value < max + step / 2; value += step) {
    ticks.push(value)
  }
  const last = ticks[ticks.length - 1]
  if (last < max) ticks.push(last + step)
  return ticks
}

function Chart({ run, revealedSeason }) {
  const width = 640
  const height = 320
  const pad = { top: 18, right: 18, bottom: 52, left: 64 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxSeason = lastSeason(run)
  const visible = run.seasons.filter((season) => season.season <= revealedSeason)
  const maxCount = Math.max(
    1,
    ...run.seasons.flatMap((season) => Object.values(season.counts)),
  )
  const yTicks = niceTicks(maxCount)
  const yMax = Math.max(maxCount, yTicks[yTicks.length - 1])
  const seasonTicks = []
  for (let season = 0; season <= maxSeason; season += 5) seasonTicks.push(season)
  if (seasonTicks[seasonTicks.length - 1] !== maxSeason) seasonTicks.push(maxSeason)
  const x = (season) => pad.left + (season / Math.max(maxSeason, 1)) * innerW
  const y = (count) => pad.top + innerH - (count / yMax) * innerH
  const nowX = x(revealedSeason)

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Population through season ${revealedSeason}. Vertical axis is number of animals. Horizontal axis is season.`}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={pad.left + innerW}
              y2={y(tick)}
              stroke="#eee8de"
            />
            <line
              x1={pad.left - 5}
              y1={y(tick)}
              x2={pad.left}
              y2={y(tick)}
              stroke="#5e564c"
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 4}
              fill="#5e564c"
              fontSize="11"
              textAnchor="end"
            >
              {Math.round(tick).toLocaleString()}
            </text>
          </g>
        ))}
        {seasonTicks.map((season) => (
          <g key={`x-${season}`}>
            <line
              x1={x(season)}
              y1={pad.top + innerH}
              x2={x(season)}
              y2={pad.top + innerH + 5}
              stroke="#5e564c"
            />
            <text
              x={x(season)}
              y={pad.top + innerH + 18}
              fill={season === revealedSeason ? '#245246' : '#5e564c'}
              fontSize="11"
              fontWeight={season === revealedSeason ? '700' : '400'}
              textAnchor="middle"
            >
              {season}
            </text>
          </g>
        ))}
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + innerH}
          stroke="#5e564c"
        />
        <line
          x1={pad.left}
          y1={pad.top + innerH}
          x2={pad.left + innerW}
          y2={pad.top + innerH}
          stroke="#5e564c"
        />
        <text
          x={14}
          y={pad.top + innerH / 2}
          fill="#5e564c"
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
          transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
        >
          Animals
        </text>
        <text
          x={pad.left + innerW / 2}
          y={height - 6}
          fill="#5e564c"
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
        >
          Season
        </text>
        {revealedSeason > 0 && (
          <line
            x1={nowX}
            y1={pad.top}
            x2={nowX}
            y2={pad.top + innerH}
            stroke="#245246"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        )}
        {run.species.map((species, index) => {
          const extinctSeason = extinctSeasonFor(run, species.id)
          const gone =
            extinctSeason != null && extinctSeason <= revealedSeason
          const series = visible.filter(
            (season) => extinctSeason == null || season.season <= extinctSeason,
          )
          const points = series.map(
            (season) => `${x(season.season)},${y(season.counts[species.id] ?? 0)}`,
          )
          const tip = gone ? null : series[series.length - 1]
          const extinctAt = gone
            ? series.find((season) => season.season === extinctSeason)
            : null
          return (
            <g key={species.id}>
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke={colorFor(index)}
                  strokeWidth="2.4"
                  points={points.join(' ')}
                />
              )}
              {tip && (
                <circle
                  cx={x(tip.season)}
                  cy={y(tip.counts[species.id] ?? 0)}
                  r="4"
                  fill={colorFor(index)}
                />
              )}
              {extinctAt && (
                <circle
                  cx={x(extinctAt.season)}
                  cy={y(0)}
                  r="4.5"
                  fill={colorFor(index)}
                />
              )}
            </g>
          )
        })}
      </svg>
      <ul className="chart-legend">
        {run.species.map((species, index) => (
          <li key={species.id}>
            <i style={{ background: colorFor(index) }} />
            {species.speciesName}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MatchupTable({ run }) {
  return (
    <div className="lab-table-wrap">
      <table className="lab-table">
        <thead>
          <tr>
            <th>vs</th>
            {run.species.map((species) => (
              <th key={species.id}>{species.speciesName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.species.map((row) => (
            <tr key={row.id}>
              <th>{row.speciesName}</th>
              {run.species.map((col) => {
                const value = run.matchups[row.id][col.id].avgFood.total
                const kind =
                  row.id === col.id ? 'is-self' : value > 0 ? 'is-pos' : value < 0 ? 'is-neg' : ''
                return (
                  <td key={col.id} className={kind}>
                    {value.toFixed(1)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function rollSummary(side, rolls) {
  const die = rolls[`${side}Die`]
  const total = rolls[side]
  const rerollDie = rolls[`${side}RerollDie`]
  const reroll = rolls[`${side}Reroll`]
  if (die == null && rolls.die == null) return 'No dice this round.'
  if (rolls.die != null) return `Team roll ${rolls.die} (total ${rolls.total}).`
  const first = `d6 ${die} → ${total}`
  if (rerollDie != null) return `${first}. Camouflage reroll d6 ${rerollDie} → ${reroll}.`
  return first
}

function SampleMatch({ run }) {
  const [left, setLeft] = useState(run.species[0].id)
  const [right, setRight] = useState(run.species[1]?.id ?? run.species[0].id)
  const [step, setStep] = useState(0)
  const pair = run.matchups[left]?.[right]
  const log = pair?.sampleLog ?? []
  const entry = log[step]
  const leftName = run.species.find((item) => item.id === left)?.speciesName
  const rightName = run.species.find((item) => item.id === right)?.speciesName

  function pick(which, id) {
    setStep(0)
    if (which === 'left') setLeft(id)
    else setRight(id)
  }

  return (
    <div>
      <div className="sample-head">
        <label className="field">
          <span>Species A</span>
          <select value={left} onChange={(event) => pick('left', event.target.value)}>
            {run.species.map((species) => (
              <option key={species.id} value={species.id}>
                {species.speciesName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Species B</span>
          <select value={right} onChange={(event) => pick('right', event.target.value)}>
            {run.species.map((species) => (
              <option key={species.id} value={species.id}>
                {species.speciesName}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={step <= 0}
            onClick={() => setStep((value) => value - 1)}
          >
            Previous round
          </button>
          <button
            type="button"
            className="secondary"
            disabled={step >= log.length - 1}
            onClick={() => setStep((value) => value + 1)}
          >
            Next round
          </button>
        </div>
      </div>

      {entry && (
        <div className="round-card">
          <h3>
            {ARENA_LABELS[entry.arena]} · Round {entry.round}
          </h3>
          <p className="hint">
            Round {step + 1} of {log.length}
          </p>
          <div className="move-row">
            <div className="move-card">
              <span className="eyebrow">{leftName}</span>
              <strong>{MOVE_LABELS[entry.arena][entry.moves[0]]}</strong>
              <small className="detail">{rollSummary('a', entry.rolls)}</small>
              <small className="detail">Food {entry.points[0]}</small>
            </div>
            <div className="move-card">
              <span className="eyebrow">{rightName}</span>
              <strong>{MOVE_LABELS[entry.arena][entry.moves[1]]}</strong>
              <small className="detail">{rollSummary('b', entry.rolls)}</small>
              <small className="detail">Food {entry.points[1]}</small>
            </div>
          </div>
          <p className="round-note">{entry.note}</p>
        </div>
      )}
    </div>
  )
}

export default function ArenaLab() {
  const [unlocked, setUnlocked] = useState(isLabUnlocked)

  if (!unlocked) {
    return (
      <AdminLock
        className="page lab-page"
        eyebrow="Teacher lab"
        title="Arena Lab"
        prompt="Enter the admin PIN to open the lab."
        action="Open lab"
        onUnlock={() => setUnlocked(true)}
      />
    )
  }

  return <LabWorkspace />
}

function LabWorkspace() {
  const [seed, setSeed] = useState(1)
  const [selectionStrength, setSelectionStrength] = useState(0.01)
  const [seasonNoise, setSeasonNoise] = useState(0.03)
  const [maxSeasons, setMaxSeasons] = useState(30)
  const [arenas, setArenas] = useState(['territory', 'food', 'pack', 'ambush'])
  const [classSource, setClassSource] = useState(SAMPLE_CLASS)
  const [sampleClass, setSampleClass] = useState(() => makeRandomClass())
  const [submitted, setSubmitted] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loadingClass, setLoadingClass] = useState(true)
  const [runError, setRunError] = useState('')
  const [runClassLabel, setRunClassLabel] = useState('')
  const [predictOpen, setPredictOpen] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [run, setRun] = useState(null)
  const [revealedSeason, setRevealedSeason] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState('setup')
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainPage, setExplainPage] = useState(0)
  const explainSeenFor = useRef(null)

  const sample = classSource === SAMPLE_CLASS
  const blockSubmitted = sample
    ? []
    : submitted.filter((creature) => creature.period === classSource)
  const creatures = sample ? sampleClass : blockSubmitted.filter(isPlayable)
  const canRun = arenas.length > 0 && creatures.length >= 2
  const habitat = creatures.length * 1000
  const previousSeason = run
    ? clampSeason(run, revealedSeason - SEASON_STEP)
    : 0

  useEffect(() => {
    let cancelled = false
    loadCreatures().then((result) => {
      if (cancelled) return
      setLoadingClass(false)
      if (result.ok) {
        setSubmitted(result.creatures)
        setLoadError('')
      } else {
        setSubmitted([])
        setLoadError(result.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function toggleArena(id) {
    setArenas((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function handleRun(event) {
    event.preventDefault()
    if (!canRun) return
    setPredictOpen(true)
  }

  function startRun(rankedIds) {
    setPredictOpen(false)
    setPrediction(rankedIds)
    setPlaying(false)
    setExplainOpen(false)
    setExplainPage(0)
    setRevealedSeason(0)
    setRunError('')
    try {
      setRun(
        runEvolution(creatures, {
          seed: Number(seed) || 1,
          selectionStrength: Number(selectionStrength),
          seasonNoise: Number(seasonNoise),
          maxSeasons: Number(maxSeasons) || 30,
          arenas,
        }),
      )
      setRunClassLabel(classLabel(classSource))
      setPhase('live')
    } catch (error) {
      setRunError(error.message || 'Could not start this run.')
    }
  }

  function showSetup() {
    setPlaying(false)
    setPhase('setup')
  }

  function stepTo(season) {
    if (!run) return
    const next = clampSeason(run, season)
    setRevealedSeason(next)
    if (next >= lastSeason(run)) setPlaying(false)
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase])

  useEffect(() => {
    if (!playing || !run) return undefined
    if (revealedSeason >= lastSeason(run)) {
      setPlaying(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      setRevealedSeason((current) => clampSeason(run, current + SEASON_STEP))
    }, PLAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, revealedSeason, run])

  const chartKey = useMemo(
    () => (run ? `${run.seed}-${run.result.seasonsPlayed}-${run.result.reason}` : 'empty'),
    [run],
  )
  const explainer = useMemo(
    () => (run ? explainRun(run, { predictedIds: prediction }) : null),
    [run, prediction],
  )
  const atEnd = Boolean(run && revealedSeason >= lastSeason(run))

  useEffect(() => {
    if (!run || phase !== 'live' || !atEnd) return
    if (explainSeenFor.current === chartKey) return
    explainSeenFor.current = chartKey
    setExplainPage(0)
    setExplainOpen(true)
  }, [run, phase, atEnd, chartKey])

  const live = phase === 'live' && run

  return (
    <main className="page lab-page">
      {live ? (
        <header className="intro lab-live-head">
          <p className="eyebrow">
            Teacher lab · {runClassLabel || classLabel(classSource)}
          </p>
          <h1>Live run</h1>
          <p>
            Walk the class forward five seasons at a time. Watch who eats, who
            grows, and who disappears.
          </p>
          <div className="actions">
            <button type="button" className="secondary" onClick={showSetup}>
              Change settings
            </button>
            {atEnd && (
              <button
                type="button"
                onClick={() => {
                  setExplainPage(0)
                  setExplainOpen(true)
                }}
              >
                Why they finished this way
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="intro">
          <p className="eyebrow">Teacher lab</p>
          <h1>Arena Lab</h1>
          <p>
            Pick a class, set the knobs, read each game, then press Run.
            You will predict the finish before the seasons start.
          </p>
          {run && (
            <div className="actions">
              <button type="button" onClick={() => setPhase('live')}>
                Back to results
              </button>
            </div>
          )}
        </header>
      )}

      {!live && (
        <>
          <ClassRoster
            source={classSource}
            onSource={setClassSource}
            creatures={creatures}
            submittedCount={blockSubmitted.length}
            loading={!sample && loadingClass}
            loadError={!sample ? loadError : ''}
            onShuffle={() => setSampleClass(makeRandomClass())}
          />
          <form className="sheet" onSubmit={handleRun}>
        <h2>Settings</h2>
        <div className="lab-controls">
          <div className="field">
            <span className="field-head">
              <label htmlFor="lab-seed">Seed</label>
              <InfoTip label="Seed">{SETTING_HELP.seed}</InfoTip>
            </span>
            <input
              id="lab-seed"
              type="number"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-head">
              <label htmlFor="lab-selection">Selection strength</label>
              <InfoTip label="Selection strength">{SETTING_HELP.selectionStrength}</InfoTip>
            </span>
            <input
              id="lab-selection"
              type="number"
              step="0.001"
              value={selectionStrength}
              onChange={(event) => setSelectionStrength(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-head">
              <label htmlFor="lab-noise">Season noise</label>
              <InfoTip label="Season noise">{SETTING_HELP.seasonNoise}</InfoTip>
            </span>
            <input
              id="lab-noise"
              type="number"
              step="0.01"
              value={seasonNoise}
              onChange={(event) => setSeasonNoise(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-head">
              <label htmlFor="lab-max-seasons">Max seasons</label>
              <InfoTip label="Max seasons">{SETTING_HELP.maxSeasons}</InfoTip>
            </span>
            <input
              id="lab-max-seasons"
              type="number"
              value={maxSeasons}
              onChange={(event) => setMaxSeasons(event.target.value)}
            />
          </div>
          <fieldset className="lab-arenas">
            <legend>
              <span className="field-head">
                Arenas
                <InfoTip label="Arenas">{SETTING_HELP.arenas}</InfoTip>
              </span>
            </legend>
            {Object.entries(ARENA_LABELS).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={arenas.includes(id)}
                  onChange={() => toggleArena(id)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="lab-run">
            <ol className="lab-run-steps">
              <li>
                Every pair in {classLabel(classSource)} plays 50 matches across
                the checked games.
              </li>
              <li>
                Those averages become expected food each season.
              </li>
              <li>
                Species above the class average grow; species below shrink. The
                habitat stays at {habitat.toLocaleString()} animals.
              </li>
              <li>
                Below 10 animals is extinct. The run stops at one species left,
                5 stable seasons, or max seasons.
              </li>
              <li>
                Then the class watches five seasons at a time. Students are not
                emailed or sent anywhere.
              </li>
            </ol>
            {runError && <p className="error">{runError}</p>}
            <button type="submit" disabled={!canRun}>
              {run
                ? 'Run again'
                : `Run ${sample ? 'sample class' : `Block ${classSource}`}`}
            </button>
          </div>
        </div>
      </form>
          <PayoffMatrices />
        </>
      )}

      {live && (
        <div className="lab-results">
          <section className="sheet">
            <h2>Standings</h2>
            <Playback
              run={run}
              revealedSeason={revealedSeason}
              playing={playing}
              onBack={() => {
                setPlaying(false)
                stepTo(revealedSeason - SEASON_STEP)
              }}
              onNext={() => stepTo(revealedSeason + SEASON_STEP)}
              onPlay={() => setPlaying((current) => !current)}
              onEnd={() => {
                setPlaying(false)
                stepTo(lastSeason(run))
              }}
            />
            <Standings
              run={run}
              revealedSeason={revealedSeason}
              previousSeason={previousSeason}
            />
          </section>

          <section className="sheet">
            <h2>Population</h2>
            <p className="hint">
              The chart grows as you step. The dashed line is the season you
              are on. A line stops when that species goes extinct.
            </p>
            <Chart run={run} revealedSeason={revealedSeason} />
          </section>

          {atEnd && (
          <section className="sheet">
            <h2>Matchup table</h2>
            <p className="hint">
              Held back until the seasons finished. Each cell is average food
              the row animal earned against the column animal, across all
              checked games, over 50 matches. This is the scoreboard behind
              the chart, not a spoiler for watching it.
            </p>
            <MatchupTable run={run} />
          </section>
          )}

          <section className="sheet">
            <h2>Sample match</h2>
            <p className="hint">
              One recorded match for the pair, replayed round by round.
            </p>
            <SampleMatch key={chartKey} run={run} />
          </section>
        </div>
      )}

      {predictOpen && (
        <PredictModal
          key={creatures.map((creature) => creature.id).join('-')}
          teams={creatures.map((creature, index) => ({
            ...creature,
            name: creature.speciesName,
            color: colorFor(index),
          }))}
          onConfirm={startRun}
          onCancel={() => setPredictOpen(false)}
        />
      )}

      {explainOpen && explainer && (
        <ExplainModal
          explainer={explainer}
          pageIndex={explainPage}
          onPage={setExplainPage}
          onClose={() => setExplainOpen(false)}
        />
      )}
    </main>
  )
}
