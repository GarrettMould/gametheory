const STRATEGY_META = {
  Copycat: {
    animal: 'Vampire Bat',
    description: "Starts by cooperating, then copies the opponent's last move.",
  },
  'All Cooperate': {
    animal: 'Dodo',
    description: 'Always cooperates, even after being cheated.',
  },
  'All Cheat': {
    animal: 'Common Cuckoo',
    description: 'Always cheats, no matter what the opponent does.',
  },
  Grudger: {
    animal: 'American Crow',
    description:
      'Cooperates until it is cheated once, then cheats for the rest of the encounter.',
  },
  Detective: {
    animal: 'Red Fox',
    description:
      'Tests the opponent first. If they fight back, it copies their last move. If they never fight back, it cheats.',
  },
}

const ADAPTATION_META = {
  armor: {
    name: 'Thick Armor / Venomous Bite',
    animal: 'Pangolin',
    detail:
      'In a fight over territory, this creature hits harder (+1 to its fight rolls).',
  },
  reserves: {
    name: 'Fat Reserves / Low Energy Metabolism',
    animal: 'Camel',
    detail:
      'If this creature shares food and the other animal takes advantage, it loses only a little energy instead of a lot.',
  },
  pack: {
    name: 'Pack Coordination Calls / Tracking Pheromones',
    animal: 'African Wild Dog',
    detail:
      'When this creature hunts with a group, the pack has a better chance of bringing down a stag.',
  },
  camouflage: {
    name: 'Camouflage Skin / Silent Paws',
    animal: 'Stonefish',
    detail:
      'This creature gets a second chance to sneak up on another animal, or to notice an ambush and get away.',
  },
}

const TRAIT_META = {
  'african-elephant': { points: 3, animal: 'African Elephant' },
  'saltwater-crocodile': { points: 3, animal: 'Saltwater Crocodile' },
  'red-deer': { points: 2, animal: 'Red Deer' },
  gorilla: { points: 2, animal: 'Gorilla' },
  'american-bison': { points: 2, animal: 'American Bison' },
  'komodo-dragon': { points: 2, animal: 'Komodo Dragon' },
  'fiddler-crab': { points: 1, animal: 'Fiddler Crab' },
  'mantis-shrimp': { points: 1, animal: 'Mantis Shrimp' },
  'honey-badger': { points: 1, animal: 'Honey Badger' },
  'bighorn-sheep': { points: 1, animal: 'Bighorn Sheep' },
  'coconut-crab': { points: 1, animal: 'Coconut Crab' },
  'emperor-penguin': { points: 3, animal: 'Emperor Penguin' },
  anglerfish: { points: 3, animal: 'Anglerfish' },
  'galapagos-tortoise': { points: 2, animal: 'Galápagos Tortoise' },
  'burmese-python': { points: 2, animal: 'Burmese Python' },
  'bar-tailed-godwit': { points: 2, animal: 'Bar-tailed Godwit' },
  olm: { points: 2, animal: 'Olm' },
  'three-toed-sloth': { points: 1, animal: 'Three-toed Sloth' },
  koala: { points: 1, animal: 'Koala' },
  'black-bear': { points: 1, animal: 'Black Bear' },
  'arctic-fox': { points: 1, animal: 'Arctic Fox' },
  'edible-dormouse': { points: 1, animal: 'Edible Dormouse' },
  cheetah: { points: 3, animal: 'Cheetah' },
  'peregrine-falcon': { points: 3, animal: 'Peregrine Falcon' },
  'thomsons-gazelle': { points: 2, animal: "Thomson's Gazelle" },
  dragonfly: { points: 2, animal: 'Dragonfly' },
  'brown-hare': { points: 2, animal: 'Brown Hare' },
  impala: { points: 2, animal: 'Impala' },
  meerkat: { points: 1, animal: 'Meerkat' },
  'kangaroo-rat': { points: 1, animal: 'Kangaroo Rat' },
  gecko: { points: 1, animal: 'Gecko' },
  octopus: { points: 1, animal: 'Octopus' },
  hummingbird: { points: 1, animal: 'Hummingbird' },
}

export default function CreatureProfileCard({ creature }) {
  const strategy = STRATEGY_META[creature.archetype]
  const adaptation = ADAPTATION_META[creature.adaptation]
  const designers = Array.isArray(creature.studentNames)
    ? creature.studentNames.filter(Boolean)
    : []
  const traitCards = Array.isArray(creature.traitCards)
    ? creature.traitCards
    : []
  const hand = [
    strategy?.animal,
    adaptation?.animal,
    ...traitCards.map((id) => {
      const card = TRAIT_META[id]
      return card ? `+${card.points} ${card.animal}` : null
    }),
  ].filter(Boolean)
  const blockLabel =
    creature.period === 'sample'
      ? 'Random sample'
      : creature.period
        ? `Block ${creature.period}`
        : ''

  return (
    <>
      <header className="profile-hero">
        <div className="portrait" role="img" aria-label="Portrait placeholder">
          ?
        </div>
        <div>
          <p className="eyebrow">Creature profile</p>
          <h1>{creature.speciesName || creature.name}</h1>
          {(designers.length > 0 || blockLabel) && (
            <p className="receipt-lead">
              {designers.length > 0 ? designers.join(', ') : 'Classroom sample'}
              {blockLabel ? <span className="block-label">{blockLabel}</span> : null}
            </p>
          )}
        </div>
      </header>

      {creature.story ? <p className="profile-story">{creature.story}</p> : null}

      <div className="stat-grid">
        <div className="stat-tile">
          <strong>{creature.size}</strong>
          <span>Size / Power</span>
        </div>
        <div className="stat-tile">
          <strong>{creature.efficiency}</strong>
          <span>Metabolic Efficiency</span>
        </div>
        <div className="stat-tile">
          <strong>{creature.agility}</strong>
          <span>Agility / Speed</span>
        </div>
      </div>

      <dl className="summary">
        <div>
          <dt>Strategy</dt>
          <dd>{creature.archetype}</dd>
        </div>
        <div>
          <dt>Adaptation</dt>
          <dd>
            {adaptation?.name || creature.adaptation}
            {adaptation?.detail ? (
              <small className="detail">{adaptation.detail}</small>
            ) : null}
          </dd>
        </div>
        {hand.length > 0 && (
          <div>
            <dt>Card hand</dt>
            <dd>
              <ul className="hand-list">
                {hand.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {designers.length > 0 && (
          <div>
            <dt>Designers</dt>
            <dd>{designers.join(', ')}</dd>
          </div>
        )}
      </dl>
    </>
  )
}
