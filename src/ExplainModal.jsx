import { useEffect, useRef } from 'react'

export default function ExplainModal({ explainer, pageIndex, onPage, onClose }) {
  const closeRef = useRef(null)
  const bodyRef = useRef(null)
  const page = explainer.pages[pageIndex]
  const last = pageIndex >= explainer.pages.length - 1
  const first = pageIndex <= 0

  useEffect(() => {
    closeRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [pageIndex])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && !last) onPage(pageIndex + 1)
      if (event.key === 'ArrowLeft' && !first) onPage(pageIndex - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [first, last, onClose, onPage, pageIndex])

  return (
    <div className="modal-backdrop">
      <div
        className={page.compare ? 'modal is-explainer is-compare' : 'modal is-explainer'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explain-title"
        aria-describedby="explain-copy"
      >
        <p className="explain-step">
          {pageIndex + 1} of {explainer.pages.length}
        </p>
        <p className="eyebrow">{page.kicker}</p>
        <h2 id="explain-title">
          {page.colorIndex != null && (
            <i
              className="lab-swatch"
              style={{ background: swatch(page.colorIndex) }}
            />
          )}
          {page.title}
        </h2>
        {page.meta && <p className="explain-meta">{page.meta}</p>}
        <div id="explain-copy" className="explain-body" ref={bodyRef}>
          {page.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {page.compare && (
            <div className="predict-compare">
              <div className="predict-compare-head">
                <span>Rank</span>
                <span>{page.compare.predictedLabel}</span>
                <span>{page.compare.actualLabel}</span>
              </div>
              <ol>
                {page.compare.rows.map((row) => (
                  <li
                    key={row.rank}
                    className={row.match ? 'is-hit' : 'is-miss'}
                  >
                    <span className="predict-place">{ordinal(row.rank)}</span>
                    <CompareTeam team={row.predicted} />
                    <CompareTeam team={row.actual} match={row.match} />
                  </li>
                ))}
              </ol>
            </div>
          )}
          {page.list && (
            <>
              {page.listTitle ? (
                <p className="explain-list-title">{page.listTitle}</p>
              ) : null}
              <ul className="explain-roster">
                {page.list.map((item) => (
                  <li key={item.id}>
                    <i
                      className="lab-swatch"
                      style={{ background: swatch(item.colorIndex) }}
                    />
                    <b>{item.name}</b>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => onPage(pageIndex - 1)}
            disabled={first}
          >
            Back
          </button>
          {last ? (
            <button ref={closeRef} type="button" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button ref={closeRef} type="button" onClick={() => onPage(pageIndex + 1)}>
                Next
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const COLORS = [
  '#245246',
  '#8a4b12',
  '#3d3a72',
  '#1d6b8a',
  '#8f2d2d',
  '#1f6b45',
  '#6b4f1d',
]

function swatch(index) {
  return COLORS[index % COLORS.length]
}

function CompareTeam({ team, match }) {
  if (!team) {
    return <span className="predict-compare-empty">—</span>
  }
  return (
    <span className="predict-compare-team">
      <i className="lab-swatch" style={{ background: swatch(team.colorIndex) }} />
      <b>{team.name}</b>
      {match ? <em>Match</em> : null}
    </span>
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
