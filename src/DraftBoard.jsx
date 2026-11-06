import { useEffect, useState } from 'react'
import AdminLock from './AdminLock.jsx'
import { isLabUnlocked } from './adminPin.js'
import './DraftBoard.css'

const STORAGE_KEY = 'draft-board-taken'

const PILES = [
  {
    id: 'strategy',
    title: 'Strategy cards',
    hint: 'Five strategies. Click a card when a group drafts it. Click again if it goes back in the pile.',
  },
  {
    id: 'adaptation',
    title: 'Adaptation cards',
    hint: 'Four special adaptations. Darken one when it leaves the table.',
  },
  {
    id: 'traits',
    title: 'Attribute cards',
    hint: 'Size, Efficiency, and Agility. Darken a card when a group takes it.',
  },
]

function readTaken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export default function DraftBoard(props) {
  const [unlocked, setUnlocked] = useState(isLabUnlocked)

  if (!unlocked) {
    return (
      <AdminLock
        className="page draft-page"
        eyebrow="Classroom draft"
        title="Draft board"
        prompt="Enter the admin PIN to open the draft board."
        action="Open draft board"
        onUnlock={() => setUnlocked(true)}
      />
    )
  }

  return <DraftWorkspace {...props} />
}

function DraftWorkspace({ archetypes, adaptations, attributes, traitCards }) {
  const [pile, setPile] = useState(0)
  const [taken, setTaken] = useState(readTaken)
  const current = PILES[pile]
  const last = pile >= PILES.length - 1
  const first = pile <= 0

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...taken]))
  }, [taken])

  function toggle(id) {
    setTaken((currentTaken) => {
      const next = new Set(currentTaken)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const remaining = remainingCount(pile, taken, {
    archetypes,
    adaptations,
    traitCards,
  })

  return (
    <main className="page draft-page">
      <header className="intro">
        <p className="eyebrow">Classroom draft</p>
        <h1>Draft board</h1>
        <p>
          Put this on the projector. Click a card to darken it once a group
          takes it. Click again to put it back.
        </p>
      </header>

      <section className="sheet">
        <div className="draft-board-head">
          <div>
            <p className="draft-step">
              {pile + 1} of {PILES.length}
            </p>
            <h2>{current.title}</h2>
            <p className="hint">{current.hint}</p>
          </div>
          <p className="draft-remaining">
            {remaining.left} of {remaining.total} still in the pile
          </p>
        </div>

        {pile === 0 && (
          <div className="draft-grid">
            {archetypes.map((archetype) => {
              const id = `strategy:${archetype.name}`
              const drafted = taken.has(id)
              return (
                <button
                  type="button"
                  key={id}
                  className={
                    drafted
                      ? 'draft-card strategy is-drafted'
                      : 'draft-card strategy'
                  }
                  aria-pressed={drafted}
                  onClick={() => toggle(id)}
                >
                  <span className="draft-band">Strategy</span>
                  <span className="draft-title">{archetype.name}</span>
                  <span className="draft-body">{archetype.description}</span>
                  <span className="draft-rows">
                    <span className="draft-row">
                      <b>Animal: </b>
                      {archetype.animal}
                    </span>
                    <span className="draft-row">
                      <b>Why: </b>
                      {archetype.why}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {pile === 1 && (
          <div className="draft-grid">
            {adaptations.map((adaptation) => {
              const id = `adaptation:${adaptation.id}`
              const drafted = taken.has(id)
              return (
                <button
                  type="button"
                  key={id}
                  className={
                    drafted
                      ? 'draft-card adaptation is-drafted'
                      : 'draft-card adaptation'
                  }
                  aria-pressed={drafted}
                  onClick={() => toggle(id)}
                >
                  <span className="draft-band">
                    Adaptation · {adaptation.arena}
                  </span>
                  <span className="draft-title">{adaptation.name}</span>
                  <span className="draft-body">{adaptation.detail}</span>
                  <span className="draft-rows">
                    <span className="draft-row">
                      <b>Animal: </b>
                      {adaptation.animal}
                    </span>
                    <span className="draft-row">
                      <b>Why: </b>
                      {adaptation.why}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {pile === 2 && (
          <div className="trait-groups">
            {attributes.map((attribute) => (
              <fieldset className="trait-group" key={attribute.key}>
                <legend>
                  {attribute.label}{' '}
                  <abbr title={attribute.label}>({attribute.code})</abbr>
                </legend>
                <div className="draft-grid">
                  {traitCards
                    .filter((card) => card.stat === attribute.key)
                    .sort((a, b) => b.points - a.points)
                    .map((card) => {
                      const id = `trait:${card.id}`
                      const drafted = taken.has(id)
                      return (
                        <button
                          type="button"
                          key={id}
                          className={[
                            'draft-card',
                            'trait',
                            attribute.band,
                            drafted ? 'is-drafted' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-pressed={drafted}
                          onClick={() => toggle(id)}
                        >
                          <span className="draft-band">
                            {attribute.label} trait
                          </span>
                          <span className="draft-points">
                            <span className="num">+{card.points}</span>
                            <span className="word">{attribute.short}</span>
                          </span>
                          <span className="draft-title">{card.animal}</span>
                          <span className="draft-body">{card.fact}</span>
                        </button>
                      )
                    })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        <div className="draft-board-nav">
          <button
            type="button"
            className="secondary draft-pile-btn"
            onClick={() => setPile((value) => value - 1)}
            disabled={first}
          >
            Previous pile
          </button>
            <div className="draft-dots" role="tablist" aria-label="Card piles">
            {PILES.map((item, index) => (
              <button
                type="button"
                key={item.id}
                role="tab"
                aria-selected={index === pile}
                className={index === pile ? 'is-current' : undefined}
                aria-label={item.title}
                onClick={() => setPile(index)}
              />
            ))}
          </div>
          <button
            type="button"
            className="secondary draft-pile-btn"
            onClick={() => setPile((value) => value + 1)}
            disabled={last}
          >
            Next pile
          </button>
        </div>

        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setTaken(new Set())}
            disabled={taken.size === 0}
          >
            Reset board
          </button>
        </div>
      </section>
    </main>
  )
}

function remainingCount(pile, taken, catalogs) {
  if (pile === 0) {
    const total = catalogs.archetypes.length
    const left = catalogs.archetypes.filter(
      (item) => !taken.has(`strategy:${item.name}`),
    ).length
    return { left, total }
  }
  if (pile === 1) {
    const total = catalogs.adaptations.length
    const left = catalogs.adaptations.filter(
      (item) => !taken.has(`adaptation:${item.id}`),
    ).length
    return { left, total }
  }
  const total = catalogs.traitCards.length
  const left = catalogs.traitCards.filter(
    (item) => !taken.has(`trait:${item.id}`),
  ).length
  return { left, total }
}
