import { useState } from 'react'

const GAMES = [
  {
    id: 'food',
    name: 'Food Sharing',
    kind: 'Prisoner’s dilemma',
    blurb: 'A carcass is on the ground. You can share it or keep it.',
    moves: ['SHARE', 'KEEP'],
    cells: [
      [
        { you: 3, them: 3 },
        { you: -3, them: 5 },
      ],
      [
        { you: 5, them: -3 },
        { you: 0, them: 0 },
      ],
    ],
    notes: [
      'These numbers are for a mid-efficiency animal (3 or 4).',
      'Sharing costs more if you are inefficient, so both-share becomes 2 instead of 3.',
      'Very efficient animals (5 or 6) get 4.',
      'If you share and they keep, reserves make your loss −1 instead of −3.',
    ],
  },
  {
    id: 'territory',
    name: 'Territory',
    kind: 'Hawk–dove',
    blurb: 'Two animals want the same patch. You can show off or start a fight.',
    moves: ['DISPLAY', 'ESCALATE'],
    cells: [
      [
        { you: 2, them: 2 },
        { you: 'flee 0 / caught −1', them: 4 },
      ],
      [
        { you: 4, them: 'flee 0 / caught −1' },
        { you: 'win 4 / lose −5 / tie −2', them: 'win 4 / lose −5 / tie −2' },
      ],
    ],
    notes: [
      'If one escalates and the other displays, the displayer rolls a six-sided die and adds Agility.',
      '6 or higher: they get away (0) and the escalator takes the patch (4).',
      'Lower: they get caught (−1) and the escalator still gets 4.',
      'If both escalate, they fight: each rolls a six-sided die and adds Size (armor adds 1).',
      'Winner 4, loser −5, tie −2 each.',
    ],
  },
  {
    id: 'pack',
    name: 'Pack Hunting',
    kind: 'Stag hunt',
    blurb: 'Hunt a big meal together, or grab a small safe meal alone.',
    moves: ['STAG', 'HARE'],
    cells: [
      [
        { you: 'stag 6 / miss 0', them: 'stag 6 / miss 0' },
        { you: 0, them: 2 },
      ],
      [
        { you: 2, them: 0 },
        { you: 2, them: 2 },
      ],
    ],
    notes: [
      'If both go for the stag, add both Sizes, both Agilities, and one six-sided die.',
      'Pack adaptation adds 1 more per animal that has it.',
      'Total 16 or higher: both get 6. Lower: both get 0.',
      'A hare is always 2.',
      'Going for the stag alone gets you 0.',
    ],
  },
  {
    id: 'ambush',
    name: 'Ambush',
    kind: 'Hide or hunt',
    blurb: 'Forage in the open, or hide and try to jump the other animal.',
    moves: ['FORAGE', 'AMBUSH'],
    cells: [
      [
        { you: 1, them: 1 },
        { you: 'escape 1 / caught −5', them: 'works 6 / spotted 0' },
      ],
      [
        { you: 'works 6 / spotted 0', them: 'escape 1 / caught −5' },
        { you: '0, or −1 if tired', them: '0, or −1 if tired' },
      ],
    ],
    notes: [
      'If you both forage, you each get 1.',
      'If you both hide, nobody eats.',
      'If one hides and one forages, each rolls a six-sided die. The hider adds Efficiency. The forager adds Agility. Higher total wins.',
      'Ambush works: hider 6, victim −5.',
      'Forager notices and gets away: forager 1, hider 0.',
      'An inefficient hider (Efficiency 1–3) is tired from waiting, so those scores drop by 1.',
      'Camouflage gives one extra roll per match, to land the ambush or to notice it.',
    ],
  },
]

function Payoff({ value }) {
  const kind =
    typeof value === 'number' ? (value > 0 ? 'is-pos' : value < 0 ? 'is-neg' : '') : ''
  return <b className={kind}>{value}</b>
}

function Matrix({ game }) {
  return (
    <article className="payoff-card">
      <p className="eyebrow">{game.kind}</p>
      <h3>{game.name}</h3>
      <p className="hint">{game.blurb}</p>
      <p className="hint">
        Each box is your food, then their food. You pick the row. They pick the
        column.
      </p>
      <div className="lab-table-wrap">
        <table className="payoff-matrix">
          <thead>
            <tr>
              <th scope="col">{'You \\ Them'}</th>
              {game.moves.map((move) => (
                <th key={move} scope="col">
                  {move}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {game.moves.map((move, row) => (
              <tr key={move}>
                <th scope="row">{move}</th>
                {game.cells[row].map((cell, col) => (
                  <td key={game.moves[col]}>
                    <span>
                      You <Payoff value={cell.you} />
                    </span>
                    <span>
                      Them <Payoff value={cell.them} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="payoff-notes">
        {game.notes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  )
}

export default function PayoffMatrices() {
  const [index, setIndex] = useState(0)
  const game = GAMES[index]
  const last = index >= GAMES.length - 1
  const first = index <= 0

  return (
    <section className="sheet">
      <div className="payoff-carousel-head">
        <div>
          <h2>Payoff matrices</h2>
          <p className="hint">
            One game at a time. Food from the checked games is what selection
            acts on.
          </p>
        </div>
        <p className="payoff-step">
          {index + 1} of {GAMES.length}
        </p>
      </div>
      <Matrix game={game} />
      <div className="payoff-nav">
        <button
          type="button"
          className="secondary"
          onClick={() => setIndex((value) => value - 1)}
          disabled={first}
        >
          Previous game
        </button>
        <div className="payoff-dots" role="tablist" aria-label="Games">
          {GAMES.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              aria-label={item.name}
              className={itemIndex === index ? 'is-current' : undefined}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setIndex((value) => value + 1)}
          disabled={last}
        >
          Next game
        </button>
      </div>
    </section>
  )
}
