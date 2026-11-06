import { useId } from 'react'
import './HerdView.css'

const WIDTH = 920
const HEIGHT = 500
const PAD = 28
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const TARGET_DOTS = 160

function animalsPerDot(capacity) {
  const raw = capacity / TARGET_DOTS
  return Math.max(10, Math.round(raw / 5) * 5)
}

function dotsFor(count, unit) {
  if (count < 10) return 0
  return Math.max(1, Math.round(count / unit))
}

function gridShape(n) {
  if (n <= 3) return { cols: n, rows: 1 }
  const cols = Math.ceil(n / 2)
  return { cols, rows: 2 }
}

function homes(count) {
  const { cols, rows } = gridShape(count)
  const innerW = WIDTH - PAD * 2
  const innerH = HEIGHT - PAD * 2
  const cellW = innerW / cols
  const cellH = innerH / rows
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const inRow = row === rows - 1 ? count - row * cols : cols
    const x = PAD + ((col + 0.5) / inRow) * innerW
    const y = PAD + (row + 0.42) * cellH
    return { x, y, cellW, cellH }
  })
}

function spiralOffset(k, spacing) {
  const radius = spacing * Math.sqrt(k + 0.35)
  const angle = k * GOLDEN_ANGLE
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
  }
}

export default function HerdView({ run, revealedSeason }) {
  const clipId = `herd-clip-${useId().replace(/:/g, '')}`
  const now = run.seasons.find((item) => item.season === revealedSeason) ?? run.seasons[0]
  const capacity = run.species.length * run.rules.startingCount
  const unit = animalsPerDot(capacity)
  const spots = homes(run.species.length)
  const spacing = Math.min(spots[0].cellW, spots[0].cellH) / 11.2

  const herds = run.species.map((species, index) => {
    const extinctAt = run.seasons.find(
      (season) => season.season > 0 && season.extinct.includes(species.id),
    )?.season
    const gone = extinctAt != null && extinctAt <= revealedSeason
    const count = gone ? 0 : now.counts[species.id] ?? 0
    return {
      id: species.id,
      name: species.speciesName,
      color: colorFor(index),
      count,
      gone,
      home: spots[index],
      dots: dotsFor(count, unit),
    }
  })

  const summary = herds
    .map((herd) =>
      herd.gone
        ? `${herd.name} extinct`
        : `${herd.name} ${Math.round(herd.count).toLocaleString()}`,
    )
    .join('. ')

  return (
    <div className="herd">
      <p className="herd-key">
        Each dot is about {unit} animals. The fence always holds{' '}
        {capacity.toLocaleString()} — when one herd dies, the others spread
        into the space.
      </p>
      <div className="herd-pasture">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Habitat in season ${revealedSeason}. ${summary}.`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x="14"
                y="14"
                width={WIDTH - 28}
                height={HEIGHT - 28}
                rx="22"
              />
            </clipPath>
          </defs>
          <rect
            className="herd-ground"
            x="14"
            y="14"
            width={WIDTH - 28}
            height={HEIGHT - 28}
            rx="22"
          />
          <rect
            className="herd-fence"
            x="14"
            y="14"
            width={WIDTH - 28}
            height={HEIGHT - 28}
            rx="22"
          />
          <g clipPath={`url(#${clipId})`}>
            {herds.map((herd) =>
              Array.from({ length: herd.dots }, (_, k) => {
                const { dx, dy } = spiralOffset(k, spacing)
                return (
                  <circle
                    className="herd-dot"
                    key={`${herd.id}-${k}`}
                    cx={herd.home.x + dx}
                    cy={herd.home.y + dy}
                    r="6.2"
                    fill={herd.color}
                    stroke="#fbf7f1"
                    strokeWidth="1.15"
                  />
                )
              }),
            )}
          </g>
        </svg>
        {herds.map((herd) => (
          <p
            key={herd.id}
            className={herd.gone ? 'herd-label is-gone' : 'herd-label'}
            style={{
              left: `${(herd.home.x / WIDTH) * 100}%`,
              top: `${((herd.home.y + herd.home.cellH * 0.36) / HEIGHT) * 100}%`,
            }}
          >
            <span className="herd-swatch" style={{ background: herd.color }} />
            <span className="herd-name">{herd.name}</span>{' '}
            <strong>
              {herd.gone ? 'Gone' : Math.round(herd.count).toLocaleString()}
            </strong>
          </p>
        ))}
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
  '#5a2d6b',
  '#2d5a3a',
  '#6b3a1d',
  '#1d4a6b',
  '#6b1d3a',
]

function colorFor(index) {
  return COLORS[index % COLORS.length]
}
