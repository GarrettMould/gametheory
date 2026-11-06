import { useEffect, useRef, useState } from 'react'
import CreatureProfileCard from './CreatureProfileCard.jsx'

export default function PredictModal({ teams, onConfirm, onCancel }) {
  const [slots, setSlots] = useState(() => teams.map(() => null))
  const [bench, setBench] = useState(() => teams.map((team) => team.id))
  const [selected, setSelected] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hoverSlot, setHoverSlot] = useState(null)
  const [hoverBench, setHoverBench] = useState(false)
  const [peekId, setPeekId] = useState(null)
  const dragId = useRef(null)
  const closeRef = useRef(null)
  const byId = Object.fromEntries(teams.map((team) => [team.id, team]))
  const ready = slots.every(Boolean)
  const peekTeam = peekId ? byId[peekId] : null

  useEffect(() => {
    closeRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape') {
        if (peekId) {
          setPeekId(null)
          return
        }
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel, peekId])

  function place(id, index) {
    const occupant = slots[index]
    const fromSlot = slots.indexOf(id)
    if (fromSlot === index) return

    const nextSlots = [...slots]
    let nextBench = bench.filter((item) => item !== id)

    if (fromSlot >= 0) {
      nextSlots[fromSlot] = occupant
      nextSlots[index] = id
    } else {
      nextSlots[index] = id
      if (occupant) nextBench = [...nextBench, occupant]
    }

    setSlots(nextSlots)
    setBench(nextBench)
    setSelected(null)
  }

  function returnToBench(id) {
    const fromSlot = slots.indexOf(id)
    if (fromSlot < 0) return
    const nextSlots = [...slots]
    nextSlots[fromSlot] = null
    setSlots(nextSlots)
    setBench((current) => (current.includes(id) ? current : [...current, id]))
    setSelected(null)
  }

  function startDrag(id) {
    dragId.current = id
    setDraggingId(id)
  }

  function endDrag() {
    dragId.current = null
    setDraggingId(null)
    setHoverSlot(null)
    setHoverBench(false)
  }

  function onDropSlot(index) {
    const id = dragId.current
    endDrag()
    if (id) place(id, index)
  }

  function onDropBench() {
    const id = dragId.current
    endDrag()
    if (id) returnToBench(id)
  }

  function onSlotDragOver(event, index) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (hoverSlot !== index) setHoverSlot(index)
  }

  function onSlotDragLeave(event, index) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setHoverSlot((current) => (current === index ? null : current))
  }

  function onBenchDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!hoverBench) setHoverBench(true)
  }

  function onBenchDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setHoverBench(false)
  }

  function onChipClick(id) {
    const inSlot = slots.indexOf(id)
    if (selected === id) {
      setSelected(null)
      return
    }
    if (selected && inSlot >= 0) {
      place(selected, inSlot)
      return
    }
    setSelected(id)
  }

  function onSlotClick(index) {
    if (selected) {
      place(selected, index)
      return
    }
    if (slots[index]) setSelected(slots[index])
  }

  function closePeek() {
    setPeekId(null)
  }

  function openPeek(id) {
    setPeekId((current) => (current === id ? null : id))
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal is-explainer is-predict"
        role="dialog"
        aria-modal="true"
        aria-labelledby="predict-title"
        aria-describedby="predict-copy"
      >
        <p className="eyebrow">Before you play</p>
        <h2 id="predict-title">Wait! Before you play, predict the final standings.</h2>
        <p id="predict-copy" className="hint">
          Drag each team into a rank, or click a team and then a slot. 1st is
          who you think will have the most animals when the seasons end.
        </p>
        <div className={draggingId ? 'predict-body is-dragging' : 'predict-body'}>
          <div
            className={hoverBench ? 'predict-bench is-drop' : 'predict-bench'}
            onDragOver={onBenchDragOver}
            onDragLeave={onBenchDragLeave}
            onDrop={onDropBench}
          >
            <p className="predict-bench-label">Unplaced teams</p>
            {bench.length === 0 ? (
              <p className="hint">Every team has a rank.</p>
            ) : (
              <ul>
                {bench.map((id) => (
                  <li key={id}>
                    <Chip
                      team={byId[id]}
                      selected={selected === id}
                      dragging={draggingId === id}
                      peeking={peekId === id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', id)
                        event.dataTransfer.effectAllowed = 'move'
                        closePeek()
                        startDrag(id)
                      }}
                      onDragEnd={endDrag}
                      onClick={() => onChipClick(id)}
                      onPeek={() => openPeek(id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ol className="predict-ranks">
            {slots.map((id, index) => {
              const team = id ? byId[id] : null
              const classes = ['predict-slot']
              if (draggingId) classes.push('is-ready')
              if (hoverSlot === index) classes.push('is-drop')
              if (selected && !team) classes.push('is-target')
              return (
                <li
                  key={`slot-${index}`}
                  className={classes.join(' ')}
                  onDragEnter={(event) => event.preventDefault()}
                  onDragOver={(event) => onSlotDragOver(event, index)}
                  onDragLeave={(event) => onSlotDragLeave(event, index)}
                  onDrop={() => onDropSlot(index)}
                  onClick={() => onSlotClick(index)}
                >
                  <span className="predict-place">{ordinal(index + 1)}</span>
                  {team ? (
                    <Chip
                      team={team}
                      selected={selected === team.id}
                      dragging={draggingId === team.id}
                      peeking={peekId === team.id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', team.id)
                        event.dataTransfer.effectAllowed = 'move'
                        closePeek()
                        startDrag(team.id)
                      }}
                      onDragEnd={endDrag}
                      onClick={(event) => {
                        event.stopPropagation()
                        onChipClick(team.id)
                      }}
                      onPeek={() => openPeek(team.id)}
                    />
                  ) : (
                    <span className="predict-empty">
                      {hoverSlot === index ? 'Drop here' : 'Drop a team here'}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
        <div className="actions">
          <button
            ref={closeRef}
            type="button"
            className="secondary"
            onClick={onCancel}
          >
            Back
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onConfirm(slots)}
          >
            Lock in prediction
          </button>
        </div>
      </div>
      {peekTeam && (
        <div
          className="peek-layer"
          onClick={closePeek}
        >
          <article
            className="modal is-profile-peek profile"
            role="dialog"
            aria-modal="true"
            aria-label={`${peekTeam.name} profile`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="peek-close"
              aria-label="Close"
              onClick={closePeek}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <CreatureProfileCard creature={peekTeam} />
          </article>
        </div>
      )}
    </div>
  )
}

function Chip({
  team,
  selected,
  dragging,
  peeking,
  onDragStart,
  onDragEnd,
  onClick,
  onPeek,
}) {
  const classes = ['predict-chip']
  if (selected) classes.push('is-selected')
  if (dragging) classes.push('is-dragging')
  return (
    <div className="predict-chip-wrap">
      <button
        type="button"
        className={classes.join(' ')}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        aria-pressed={selected}
      >
        <i className="lab-swatch" style={{ background: team.color }} />
        <span>
          <b>{team.name}</b>
          <small>{team.archetype}</small>
        </span>
      </button>
      <button
        type="button"
        className="info-tip-btn predict-info"
        aria-label={`About ${team.name}`}
        aria-expanded={peeking}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPeek()
        }}
      >
        i
      </button>
    </div>
  )
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
