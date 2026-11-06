import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ADMIN_PIN } from './adminPin.js'
import ArenaLab from './ArenaLab.jsx'
import DraftBoard from './DraftBoard.jsx'
import { deleteCreature } from './deleteCreature.js'
import { loadCreatures } from './loadCreatures.js'
import CreatureProfileCard from './CreatureProfileCard.jsx'
import { saveCreature } from './saveCreature.js'

const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const STAT_VALUES = ['1', '2', '3', '4', '5', '6']
const STORY_LIMIT = 600

const ARCHETYPES = [
  {
    name: 'Copycat',
    description:
      "Starts by cooperating, then copies the opponent's last move.",
    animal: 'Vampire Bat',
    why: 'Shares blood with roostmates that shared with it before.',
    image: '/creatures/copycat-vampire-bat.jpg',
  },
  {
    name: 'All Cooperate',
    description: 'Always cooperates, even after being cheated.',
    animal: 'Dodo',
    why: 'Never learned to fear people, and was hunted to extinction in under a century.',
    image: '/creatures/all-cooperate-dodo.jpg',
  },
  {
    name: 'All Cheat',
    description: 'Always cheats, no matter what the opponent does.',
    animal: 'Common Cuckoo',
    why: "Lays its eggs in other birds' nests and lets them raise its chicks.",
    image: '/creatures/all-cheat-cuckoo.jpg',
  },
  {
    name: 'Grudger',
    description:
      'Cooperates until it is cheated once, then cheats for the rest of the encounter.',
    animal: 'American Crow',
    why: 'Remembers the faces of people who threatened it and scolds them for years.',
    image: '/creatures/grudger-crow.jpg',
  },
  {
    name: 'Detective',
    description:
      'Tests the opponent first. If they fight back, it copies their last move. If they never fight back, it cheats.',
    animal: 'Red Fox',
    why: 'Approaches carefully and tests a situation before it commits.',
    image: '/creatures/detective-red-fox.jpg',
  },
]

const ATTRIBUTES = [
  {
    key: 'size',
    band: 'size',
    code: 'S',
    short: 'Size',
    label: 'Size / Power',
    high: 'Creatures with a high Size score win more fights over territory and help their pack bring down a stag.',
    low: 'Creatures with a low Size score lose more fights over territory and add less to a pack hunt.',
  },
  {
    key: 'efficiency',
    band: 'eff',
    code: 'E',
    short: 'Efficiency',
    label: 'Metabolic Efficiency',
    high: 'Creatures with a high Metabolic Efficiency score will spend fewer calories when sharing food, and can hold an ambush longer without running out of energy.',
    low: 'Creatures with a low Metabolic Efficiency score will spend more calories when sharing food, and will run out of energy sooner while holding an ambush.',
  },
  {
    key: 'agility',
    band: 'agi',
    code: 'A',
    short: 'Agility',
    label: 'Agility / Speed',
    high: 'Creatures with a high Agility score will be better at escaping a fight, keeping up on a pack hunt, and spotting or slipping away from an ambush.',
    low: 'Creatures with a low Agility score will have a harder time escaping a fight, keeping up on a pack hunt, and spotting or slipping away from an ambush.',
  },
]

const ADAPTATIONS = [
  {
    id: 'armor',
    name: 'Thick Armor / Venomous Bite',
    arena: 'Territory',
    animal: 'Pangolin',
    why: "Rolls into a ball of overlapping scales most predators can't bite through.",
    game: 'Territory fights',
    detail:
      'In a fight over territory, this creature hits harder (+1 to its fight rolls).',
  },
  {
    id: 'reserves',
    name: 'Fat Reserves / Low Energy Metabolism',
    arena: 'Food sharing',
    animal: 'Camel',
    why: 'Its hump stores fat to burn when food runs out.',
    game: 'Sharing food',
    detail:
      'If this creature shares food and the other animal takes advantage, it loses only a little energy instead of a lot.',
  },
  {
    id: 'pack',
    name: 'Pack Coordination Calls / Tracking Pheromones',
    arena: 'Pack hunting',
    animal: 'African Wild Dog',
    why: 'Pack members sneeze to vote on starting a hunt.',
    game: 'Pack hunting',
    detail:
      'When this creature hunts with a group, the pack has a better chance of bringing down a stag.',
  },
  {
    id: 'camouflage',
    name: 'Camouflage Skin / Silent Paws',
    arena: 'Ambush',
    animal: 'Stonefish',
    why: 'Looks exactly like a rock until it strikes.',
    game: 'Ambushes',
    detail:
      'This creature gets a second chance to sneak up on another animal, or to notice an ambush and get away.',
  },
]

const TRAIT_CARDS = [
  { id: 'african-elephant', stat: 'size', points: 3, animal: 'African Elephant', fact: 'The largest land animal. A full-grown adult has almost no predators.' },
  { id: 'saltwater-crocodile', stat: 'size', points: 3, animal: 'Saltwater Crocodile', fact: 'The largest living reptile, with one of the strongest bites ever measured.' },
  { id: 'red-deer', stat: 'size', points: 2, animal: 'Red Deer', fact: 'Stags settle disputes with roaring contests and heavy antlers.' },
  { id: 'gorilla', stat: 'size', points: 2, animal: 'Gorilla', fact: "A silverback's chest-beating display usually ends a challenge before it starts." },
  { id: 'american-bison', stat: 'size', points: 2, animal: 'American Bison', fact: 'The heaviest land animal in North America.' },
  { id: 'komodo-dragon', stat: 'size', points: 2, animal: 'Komodo Dragon', fact: 'The largest living lizard. It can take down a deer.' },
  { id: 'fiddler-crab', stat: 'size', points: 1, animal: 'Fiddler Crab', fact: 'Waves one giant claw to look tougher than it is.' },
  { id: 'mantis-shrimp', stat: 'size', points: 1, animal: 'Mantis Shrimp', fact: 'Tiny, but throws one of the fastest punches in nature.' },
  { id: 'honey-badger', stat: 'size', points: 1, animal: 'Honey Badger', fact: 'Small, thick-skinned, and famously willing to take on bigger animals.' },
  { id: 'bighorn-sheep', stat: 'size', points: 1, animal: 'Bighorn Sheep', fact: 'Rams settle rank by crashing horns head-on.' },
  { id: 'coconut-crab', stat: 'size', points: 1, animal: 'Coconut Crab', fact: 'The largest crab on land, with claws strong enough to crack coconuts.' },
  { id: 'emperor-penguin', stat: 'efficiency', points: 3, animal: 'Emperor Penguin', fact: 'Males go about four months without eating while guarding the egg through the Antarctic winter.' },
  { id: 'anglerfish', stat: 'efficiency', points: 3, animal: 'Anglerfish', fact: 'Saves energy in the deep sea by waiting still while its glowing lure brings food to it.' },
  { id: 'galapagos-tortoise', stat: 'efficiency', points: 2, animal: 'Galápagos Tortoise', fact: 'Can survive many months without food or water.' },
  { id: 'burmese-python', stat: 'efficiency', points: 2, animal: 'Burmese Python', fact: 'One big meal can last it for months.' },
  { id: 'bar-tailed-godwit', stat: 'efficiency', points: 2, animal: 'Bar-tailed Godwit', fact: 'Flies more than 11,000 km nonstop from Alaska to New Zealand without eating.' },
  { id: 'olm', stat: 'efficiency', points: 2, animal: 'Olm', fact: 'A blind cave salamander that can survive years without food.' },
  { id: 'three-toed-sloth', stat: 'efficiency', points: 1, animal: 'Three-toed Sloth', fact: 'Moves so slowly it can live on a diet of leaves.' },
  { id: 'koala', stat: 'efficiency', points: 1, animal: 'Koala', fact: 'Sleeps up to 20 hours a day to save energy on a low-energy diet.' },
  { id: 'black-bear', stat: 'efficiency', points: 1, animal: 'Black Bear', fact: 'Sleeps through winter, living off stored body fat.' },
  { id: 'arctic-fox', stat: 'efficiency', points: 1, animal: 'Arctic Fox', fact: 'Its fur is so warm it barely burns extra energy until it gets bitterly cold.' },
  { id: 'edible-dormouse', stat: 'efficiency', points: 1, animal: 'Edible Dormouse', fact: 'Hibernates for more than half the year.' },
  { id: 'cheetah', stat: 'agility', points: 3, animal: 'Cheetah', fact: 'The fastest land animal, reaching about 100 km/h in short sprints.' },
  { id: 'peregrine-falcon', stat: 'agility', points: 3, animal: 'Peregrine Falcon', fact: 'The fastest animal alive, diving at over 300 km/h.' },
  { id: 'thomsons-gazelle', stat: 'agility', points: 2, animal: "Thomson's Gazelle", fact: "Zigzags at high speed until a cheetah's sprint runs out." },
  { id: 'dragonfly', stat: 'agility', points: 2, animal: 'Dragonfly', fact: 'Catches prey in midair on most of its attacks.' },
  { id: 'brown-hare', stat: 'agility', points: 2, animal: 'Brown Hare', fact: 'Sprints up to about 70 km/h and changes direction in an instant.' },
  { id: 'impala', stat: 'agility', points: 2, animal: 'Impala', fact: 'Leaps up to 3 m high and 10 m long to escape predators.' },
  { id: 'meerkat', stat: 'agility', points: 1, animal: 'Meerkat', fact: 'One always stands lookout, ready to call an alarm and dive for a burrow.' },
  { id: 'kangaroo-rat', stat: 'agility', points: 1, animal: 'Kangaroo Rat', fact: 'Kicks off and leaps away from a striking rattlesnake in a fraction of a second.' },
  { id: 'gecko', stat: 'agility', points: 1, animal: 'Gecko', fact: 'Runs up walls and across ceilings.' },
  { id: 'octopus', stat: 'agility', points: 1, animal: 'Octopus', fact: 'Squeezes through any gap bigger than its beak.' },
  { id: 'hummingbird', stat: 'agility', points: 1, animal: 'Hummingbird', fact: 'Can hover in place and even fly backward.' },
]

const STEPS = [
  {
    id: 'identity',
    title: 'Your group',
    short: 'Group',
    keys: ['studentName', 'period'],
  },
  {
    id: 'strategy',
    title: 'Strategy',
    short: 'Strategy',
    keys: ['archetype'],
  },
  {
    id: 'adaptation',
    title: 'Specialized adaptation',
    short: 'Adaptation',
    keys: ['adaptation'],
  },
  {
    id: 'traits',
    title: 'Trait cards',
    short: 'Traits',
    keys: ['traitCards'],
  },
  {
    id: 'story',
    title: 'Name your creature',
    short: 'Name',
    keys: ['speciesName', 'story'],
  },
]

let nextMemberId = 1

function createMember(name = '') {
  nextMemberId += 1
  return { id: nextMemberId, name }
}

function blankForm() {
  return {
    studentNames: [createMember()],
    period: '',
    speciesName: '',
    archetype: '',
    adaptation: '',
    traitCards: [],
    story: '',
  }
}

const FIELD_ORDER = [
  'studentName',
  'period',
  'archetype',
  'adaptation',
  'traitCards',
  'speciesName',
  'story',
]

function cardsForStat(stat) {
  return TRAIT_CARDS.filter((card) => card.stat === stat).sort(
    (a, b) => b.points - a.points,
  )
}

const FIRST_TRAIT_ID = cardsForStat('size')[0].id

function traitSummary(selectedIds) {
  const points = { size: 0, efficiency: 0, agility: 0 }
  for (const id of selectedIds) {
    const card = TRAIT_CARDS.find((item) => item.id === id)
    if (card) points[card.stat] += card.points
  }

  const total = points.size + points.efficiency + points.agility
  const stats = {
    size: 1 + points.size,
    efficiency: 1 + points.efficiency,
    agility: 1 + points.agility,
  }
  const overCap = ATTRIBUTES.find((attribute) => points[attribute.key] > 5)

  return { points, total, stats, overCap }
}

function nextTraitSelection(selectedIds, card) {
  const withoutSameStat = selectedIds.filter((id) => {
    const existing = TRAIT_CARDS.find((item) => item.id === id)
    return existing && existing.stat !== card.stat
  })
  return [...withoutSameStat, card.id]
}

function canAddTraitCard(selectedIds, card) {
  if (selectedIds.includes(card.id)) return true
  const next = traitSummary(nextTraitSelection(selectedIds, card))
  return next.total <= 7 && !next.overCap
}

function blockReason(card, selectedIds) {
  if (canAddTraitCard(selectedIds, card)) return ''

  const current = selectedIds
    .map((id) => TRAIT_CARDS.find((item) => item.id === id))
    .find((item) => item?.stat === card.stat)
  const remaining =
    7 - traitSummary(selectedIds.filter((id) => id !== current?.id)).total

  if (card.points > remaining) {
    if (remaining <= 0) return 'You already have 7 trait points.'
    return `This card is ${card.points} points. You only have ${remaining} left.`
  }

  return 'That combination would go over 7 trait points.'
}

function PointMeter({ total, ready, id, live = false, compact = false }) {
  const label =
    total === 7
      ? 'Trait points: 7 of 7.'
      : `Trait points: ${total} of 7.`

  return (
    <div
      id={id}
      className={
        compact
          ? ready
            ? 'point-meter is-compact ready'
            : 'point-meter is-compact'
          : ready
            ? 'point-meter ready'
            : 'point-meter'
      }
      aria-live={live ? 'polite' : undefined}
    >
      <p className="visually-hidden">{label}</p>
      <div className="point-dots" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            className={index < total ? 'point-dot is-filled' : 'point-dot'}
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

function validate(values, summary) {
  const errors = {}
  const nameErrors = values.studentNames.map((member, index) => {
    if (member.name.trim()) return ''
    return index === 0
      ? 'Enter your full name.'
      : "Enter this group member's full name."
  })

  if (nameErrors.some(Boolean)) errors.studentNames = nameErrors
  if (!values.period) errors.period = 'Choose your block.'
  if (!values.speciesName.trim()) errors.speciesName = 'Name your species.'
  if (!values.archetype) errors.archetype = 'Choose one strategy archetype.'
  if (!values.adaptation) errors.adaptation = 'Choose one adaptation.'

  if (summary.overCap) {
    errors.traitCards = 'No stat can get more than +5 from cards.'
  } else if (summary.total > 7) {
    errors.traitCards = `Trait cards can total at most 7 points. You have ${summary.total}.`
  }

  if (!values.story.trim()) errors.story = "Write your creature's story."

  return errors
}

function errorsForStep(stepIndex, values, summary) {
  const all = validate(values, summary)
  const allowed = STEPS[stepIndex].keys
  const next = {}

  if (allowed.includes('studentName') && all.studentNames) {
    next.studentNames = all.studentNames
  }

  for (const key of allowed) {
    if (key !== 'studentName' && all[key]) next[key] = all[key]
  }

  return next
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0
}

function focusFirstError(errors) {
  if (errors.studentNames?.some(Boolean)) {
    const index = errors.studentNames.findIndex(Boolean)
    document.getElementById(`student-name-${index}`)?.focus()
    return
  }

  const key = FIELD_ORDER.find((field) => errors[field])
  if (!key) return

  const id =
    key === 'archetype'
      ? 'archetype-0'
      : key === 'traitCards'
        ? `trait-${FIRST_TRAIT_ID}`
        : key
  document.getElementById(id)?.focus()
}

function labelFor(list, id, fallback) {
  return list.find((item) => item.id === id)?.name ?? fallback
}

function readRoute(hash = window.location.hash) {
  const raw = hash.replace(/^#\/?/, '')
  const [page, block = ''] = raw.split('/')
  if (page === 'creatures') {
    return {
      view: 'roster',
      block: BLOCKS.includes(block) ? block : '',
    }
  }
  if (page === 'arena-lab' || page === 'lab') {
    return { view: 'lab', block: '' }
  }
  if (page === 'draft') {
    return { view: 'draft', block: '' }
  }
  return { view: 'design', block: '' }
}

function SiteNav({ view, onNavigate }) {
  function go(event, hash) {
    event.preventDefault()
    if (window.location.hash !== hash) {
      window.location.hash = hash
    }
    onNavigate(readRoute(hash))
  }

  return (
    <nav className="site-bar" aria-label="Site">
      <a className="site-brand" href="#design" onClick={(event) => go(event, '#design')}>
        Evolutionary Arena
      </a>
      <div className="site-links">
        <a
          className="site-link-quiet"
          href="#arena-lab"
          aria-current={view === 'lab' ? 'page' : undefined}
          onClick={(event) => go(event, '#arena-lab')}
        >
          Lab
        </a>
        <a
          className="site-link-quiet"
          href="#draft"
          aria-current={view === 'draft' ? 'page' : undefined}
          onClick={(event) => go(event, '#draft')}
        >
          Draft
        </a>
        <a
          className="site-link"
          href="#creatures"
          aria-current={view === 'roster' ? 'page' : undefined}
          onClick={(event) => go(event, '#creatures')}
        >
          View Creatures
        </a>
      </div>
    </nav>
  )
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(null)
  const pendingMemberFocus = useRef(null)
  const skipStepFocus = useRef(true)
  const summary = traitSummary(form.traitCards)
  const budgetReady = summary.total === 7 && !summary.overCap
  const current = STEPS[step]
  const lastStep = step === STEPS.length - 1
  const hasHand = Boolean(
    form.archetype || form.adaptation || form.traitCards.length > 0,
  )
  const [dockOpen, setDockOpen] = useState(false)

  useEffect(() => {
    function onHashChange() {
      setRoute(readRoute())
    }
    onHashChange()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route.view, route.block])

  useEffect(() => {
    if (!hasHand) return undefined
    const frame = requestAnimationFrame(() => setDockOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [hasHand])

  useEffect(() => {
    if (pendingMemberFocus.current == null) return
    document.getElementById(`student-name-${pendingMemberFocus.current}`)?.focus()
    pendingMemberFocus.current = null
  }, [form.studentNames])

  useEffect(() => {
    if (skipStepFocus.current) {
      skipStepFocus.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.getElementById('step-heading')?.focus()
  }, [step])

  function update(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }))
    setErrors((currentErrors) => {
      if (!currentErrors[key]) return currentErrors
      const next = { ...currentErrors }
      delete next[key]
      return next
    })
  }

  function selectTraitCard(id) {
    setForm((currentForm) => {
      if (currentForm.traitCards.includes(id)) {
        return {
          ...currentForm,
          traitCards: currentForm.traitCards.filter((item) => item !== id),
        }
      }

      const card = TRAIT_CARDS.find((item) => item.id === id)
      if (!card || !canAddTraitCard(currentForm.traitCards, card)) {
        return currentForm
      }

      return {
        ...currentForm,
        traitCards: nextTraitSelection(currentForm.traitCards, card),
      }
    })
    setErrors((currentErrors) => {
      if (!currentErrors.traitCards) return currentErrors
      const next = { ...currentErrors }
      delete next.traitCards
      return next
    })
  }

  function updateName(id, value) {
    setForm((currentForm) => ({
      ...currentForm,
      studentNames: currentForm.studentNames.map((member) =>
        member.id === id ? { ...member, name: value } : member,
      ),
    }))
    setErrors((currentErrors) => {
      if (!currentErrors.studentNames) return currentErrors
      const index = form.studentNames.findIndex((member) => member.id === id)
      const studentNames = currentErrors.studentNames.map((message, itemIndex) =>
        itemIndex === index ? '' : message,
      )
      const next = { ...currentErrors, studentNames }
      if (studentNames.every((message) => !message)) delete next.studentNames
      return next
    })
  }

  function addMember() {
    pendingMemberFocus.current = form.studentNames.length
    setForm((currentForm) => ({
      ...currentForm,
      studentNames: [...currentForm.studentNames, createMember()],
    }))
  }

  function removeMember(id) {
    setForm((currentForm) => ({
      ...currentForm,
      studentNames: currentForm.studentNames.filter((member) => member.id !== id),
    }))
    setErrors((currentErrors) => {
      if (!currentErrors.studentNames) return currentErrors
      const next = { ...currentErrors }
      delete next.studentNames
      return next
    })
  }

  function goNext() {
    const nextErrors = errorsForStep(step, form, summary)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      focusFirstError(nextErrors)
      return false
    }
    setStep((currentStep) => currentStep + 1)
    return true
  }

  function goBack() {
    setErrors({})
    setStep((currentStep) => Math.max(0, currentStep - 1))
  }

  function goToStep(index) {
    if (index >= step) return
    setErrors({})
    setStep(index)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!lastStep) {
      goNext()
      return
    }

    const nextErrors = validate(form, summary)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      const firstStep = STEPS.findIndex((_, index) =>
        hasErrors(errorsForStep(index, form, summary)),
      )
      if (firstStep >= 0 && firstStep !== step) setStep(firstStep)
      focusFirstError(nextErrors)
      return
    }

    setSubmitted({
      studentNames: form.studentNames.map((member) => member.name.trim()),
      period: form.period,
      speciesName: form.speciesName.trim(),
      archetype: form.archetype,
      size: summary.stats.size,
      efficiency: summary.stats.efficiency,
      agility: summary.stats.agility,
      adaptation: form.adaptation,
      traitCards: [...form.traitCards],
      story: form.story.trim(),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  let content
  if (route.view === 'lab') {
    content = <ArenaLab />
  } else if (route.view === 'draft') {
    content = (
      <DraftBoard
        archetypes={ARCHETYPES}
        adaptations={ADAPTATIONS}
        attributes={ATTRIBUTES}
        traitCards={TRAIT_CARDS}
      />
    )
  } else if (route.view === 'roster') {
    content = <CreatureRoster selectedBlock={route.block} />
  } else if (submitted) {
    content = (
      <main className="page">
        <CreatureProfile
          creature={submitted}
          onEdit={() => {
            skipStepFocus.current = true
            setSubmitted(null)
            setStep(0)
          }}
          onHome={() => {
            skipStepFocus.current = true
            setSubmitted(null)
            setForm(blankForm())
            setErrors({})
            setStep(0)
            setDockOpen(false)
          }}
        />
      </main>
    )
  } else {
    content = (
    <main className={hasHand ? 'page has-dock' : 'page'}>
      <header className="intro">
        <p className="eyebrow">Evolutionary Arena</p>
        <h1>Design your creature</h1>
        <p>
          Enter the creature your group drafted. Pick your strategy card and
          adaptation card, check off your trait cards, and tell your creature's
          story. It will face the creatures designed by your classmates.
        </p>
      </header>

      <form className="sheet" onSubmit={handleSubmit} noValidate>
        <nav className="stepper" aria-label="Form steps">
          <ol>
            {STEPS.map((item, index) => {
              const done = index < step
              const active = index === step
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={
                      active ? 'step is-active' : done ? 'step is-done' : 'step'
                    }
                    aria-current={active ? 'step' : undefined}
                    disabled={index > step}
                    onClick={() => goToStep(index)}
                  >
                    <span className="step-index">{index + 1}</span>
                    <span className="step-label">{item.short}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="step-meta">
            Step {step + 1} of {STEPS.length}
          </p>
        </nav>

        {hasErrors(errors) && (
          <p className="form-alert" role="alert">
            Finish the highlighted fields before continuing.
          </p>
        )}

        {current.id === 'identity' && (
          <section className="section" aria-labelledby="step-heading">
            <h2 id="step-heading" tabIndex={-1}>
              {current.title}
            </h2>
            <IdentityFields
              form={form}
              errors={errors}
              update={update}
              updateName={updateName}
              addMember={addMember}
              removeMember={removeMember}
            />
          </section>
        )}

        {current.id === 'strategy' && (
          <section className="section" aria-labelledby="step-heading">
            <fieldset className="choices">
              <legend id="step-heading" tabIndex={-1}>
                {current.title}
              </legend>
              <p className="hint" id="archetype-hint">
                Select the strategy card in your group's hand.
              </p>
              <div className="draft-grid">
                {ARCHETYPES.map((archetype, index) => {
                  const checked = form.archetype === archetype.name
                  return (
                    <label
                      className={
                        checked
                          ? 'draft-card strategy is-selected'
                          : 'draft-card strategy'
                      }
                      key={archetype.name}
                    >
                      <input
                        id={index === 0 ? 'archetype-0' : undefined}
                        className="visually-hidden"
                        type="radio"
                        name="archetype"
                        value={archetype.name}
                        checked={checked}
                        aria-invalid={errors.archetype ? 'true' : undefined}
                        aria-describedby={
                          errors.archetype ? 'archetype-error' : undefined
                        }
                        onChange={() => update('archetype', archetype.name)}
                      />
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
                    </label>
                  )
                })}
              </div>
              {errors.archetype && (
                <small id="archetype-error" className="error">
                  {errors.archetype}
                </small>
              )}
            </fieldset>
          </section>
        )}

        {current.id === 'adaptation' && (
          <section className="section" aria-labelledby="step-heading">
            <fieldset className="choices">
              <legend id="step-heading" tabIndex={-1}>
                {current.title}
              </legend>
              <p className="hint" id="adaptation-hint">
                Select the adaptation card in your group's hand.
              </p>
              <div className="draft-grid">
                {ADAPTATIONS.map((adaptation, index) => {
                  const checked = form.adaptation === adaptation.id
                  return (
                    <label
                      className={
                        checked
                          ? 'draft-card adaptation is-selected'
                          : 'draft-card adaptation'
                      }
                      key={adaptation.id}
                    >
                      <input
                        id={index === 0 ? 'adaptation' : undefined}
                        className="visually-hidden"
                        type="radio"
                        name="adaptation"
                        value={adaptation.id}
                        checked={checked}
                        aria-invalid={errors.adaptation ? 'true' : undefined}
                        aria-describedby={
                          errors.adaptation ? 'adaptation-error' : undefined
                        }
                        onChange={() => update('adaptation', adaptation.id)}
                      />
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
                    </label>
                  )
                })}
              </div>
              {errors.adaptation && (
                <small id="adaptation-error" className="error">
                  {errors.adaptation}
                </small>
              )}
            </fieldset>
          </section>
        )}

        {current.id === 'traits' && (
          <section className="section" aria-labelledby="step-heading">
            <h2 id="step-heading" tabIndex={-1}>
              {current.title}
            </h2>
            <p className="hint">
              Choose up to one Size card, one Efficiency card, and one Agility
              card. Each stat starts at 1 and adds the points from that card.
              You can use up to 7 trait points. Leftover points are fine.
            </p>
            <PointMeter
              id="budget-status"
              total={summary.total}
              ready={budgetReady}
              live
            />
            <div className="trait-groups">
              {ATTRIBUTES.map((attribute) => (
                <fieldset className="trait-group" key={attribute.key}>
                  <legend>
                    {attribute.label}{' '}
                    <abbr title={attribute.label}>({attribute.code})</abbr>
                  </legend>
                  <div className="draft-grid">
                    {cardsForStat(attribute.key).map((card) => {
                      const checked = form.traitCards.includes(card.id)
                      const reason = blockReason(card, form.traitCards)
                      const blocked = Boolean(reason)
                      const cardClass = [
                        'draft-card',
                        'trait',
                        attribute.band,
                        checked ? 'is-selected' : '',
                        blocked ? 'is-blocked' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                      return (
                        <label className={cardClass} key={card.id}>
                          <input
                            id={`trait-${card.id}`}
                            className="visually-hidden"
                            type="radio"
                            name={`trait-${attribute.key}`}
                            value={card.id}
                            checked={checked}
                            disabled={blocked}
                            aria-invalid={errors.traitCards ? 'true' : undefined}
                            aria-describedby={
                              [
                                'budget-status',
                                errors.traitCards ? 'traitCards-error' : '',
                                blocked ? `trait-block-${card.id}` : '',
                              ]
                                .filter(Boolean)
                                .join(' ')
                            }
                            onClick={() => {
                              if (checked) selectTraitCard(card.id)
                            }}
                            onChange={() => {
                              if (!checked) selectTraitCard(card.id)
                            }}
                          />
                          {blocked && (
                            <span
                              id={`trait-block-${card.id}`}
                              className="visually-hidden"
                            >
                              {reason}
                            </span>
                          )}
                          <span className="draft-band">
                            {attribute.label} trait
                          </span>
                          <span className="draft-points">
                            <span className="num">+{card.points}</span>
                            <span className="word">{attribute.short}</span>
                          </span>
                          <span className="draft-title">{card.animal}</span>
                          <span className="draft-body">{card.fact}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            <div className="stats">
              {ATTRIBUTES.map((attribute) => (
                <div className="scale-field" key={attribute.key}>
                  <p className="scale-label">
                    {attribute.label}{' '}
                    <abbr title={attribute.label}>({attribute.code})</abbr>
                  </p>
                  <div
                    className="scale is-display"
                    role="img"
                    aria-label={`${attribute.label} score ${summary.stats[attribute.key]} of 6`}
                  >
                    {STAT_VALUES.map((value) => {
                      const filled = Number(value) <= summary.stats[attribute.key]
                      return (
                        <div
                          className={filled ? 'scale-dot is-filled' : 'scale-dot'}
                          key={value}
                        >
                          <span className="dot" aria-hidden="true" />
                          <span className="dot-number">{value}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="scale-ends">
                    <p>
                      <strong>Low score</strong>
                      {attribute.low}
                    </p>
                    <p>
                      <strong>High score</strong>
                      {attribute.high}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {errors.traitCards && (
              <small id="traitCards-error" className="error">
                {errors.traitCards}
              </small>
            )}
          </section>
        )}

        {current.id === 'story' && (
          <section className="section" aria-labelledby="step-heading">
            <h2 id="step-heading" tabIndex={-1}>
              {current.title}
            </h2>
            <p className="hint">
              You've drafted the cards. Name the fused creature and tell its
              origin story.
            </p>
            <div className="fields">
              <label className="field" htmlFor="speciesName">
                <span>Species / creature name</span>
                <input
                  id="speciesName"
                  name="speciesName"
                  type="text"
                  value={form.speciesName}
                  aria-invalid={errors.speciesName ? 'true' : undefined}
                  aria-describedby={
                    errors.speciesName ? 'speciesName-error' : undefined
                  }
                  onChange={(event) => update('speciesName', event.target.value)}
                />
                {errors.speciesName && (
                  <small id="speciesName-error" className="error">
                    {errors.speciesName}
                  </small>
                )}
              </label>

              <label className="field" htmlFor="story">
                <span>Origin story</span>
                <small className="hint" id="story-hint">
                  Describe your fused creature: what it looks like, which
                  animals it comes from, and why its strategy makes sense for it.
                </small>
                <textarea
                  id="story"
                  name="story"
                  rows={6}
                  maxLength={STORY_LIMIT}
                  value={form.story}
                  aria-invalid={errors.story ? 'true' : undefined}
                  aria-describedby={
                    errors.story
                      ? 'story-hint story-count story-error'
                      : 'story-hint story-count'
                  }
                  onChange={(event) => update('story', event.target.value)}
                />
              </label>
            </div>
            <p id="story-count" className="char-count">
              {form.story.length} / {STORY_LIMIT}
            </p>
            {errors.story && (
              <small id="story-error" className="error">
                {errors.story}
              </small>
            )}
          </section>
        )}

        <div className="step-actions">
          {current.id === 'traits' && (
            <PointMeter total={summary.total} ready={budgetReady} />
          )}
          <div className="actions">
            {step > 0 && (
              <button type="button" className="secondary" onClick={goBack}>
                Back
              </button>
            )}
            <button type="submit">
              {lastStep ? 'Finalize creature' : 'Continue'}
            </button>
          </div>
        </div>
      </form>

      <CreatureDock open={dockOpen} form={form} summary={summary} />
    </main>
    )
  }

  return (
    <>
      <SiteNav view={route.view} onNavigate={setRoute} />
      {content}
    </>
  )
}

function CreatureDock({ open, form, summary }) {
  const strategy = ARCHETYPES.find((item) => item.name === form.archetype)
  const adaptation = ADAPTATIONS.find((item) => item.id === form.adaptation)
  const traits = form.traitCards
    .map((id) => TRAIT_CARDS.find((card) => card.id === id))
    .filter(Boolean)
  const named = form.speciesName.trim()

  return (
    <aside
      className={open ? 'creature-dock is-open' : 'creature-dock'}
      aria-label="My Creature"
      inert={!open}
    >
      <h2>My Creature</h2>
      <p className="dock-species">{named || 'Not named yet'}</p>

      <div className="dock-portrait" aria-hidden="true">
        ?
      </div>

      <ul className="dock-hand">
        <li className={strategy ? 'dock-slot strategy is-filled' : 'dock-slot'}>
          <span className="dock-kind">Strategy</span>
          {strategy ? (
            <>
              <strong>{strategy.name}</strong>
              <small>{strategy.animal}</small>
            </>
          ) : (
            <span className="dock-empty">Waiting for a card</span>
          )}
        </li>
        <li className={adaptation ? 'dock-slot adaptation is-filled' : 'dock-slot'}>
          <span className="dock-kind">Adaptation</span>
          {adaptation ? (
            <>
              <strong>{adaptation.name}</strong>
              <small>{adaptation.animal}</small>
            </>
          ) : (
            <span className="dock-empty">Waiting for a card</span>
          )}
        </li>
        <li className={traits.length ? 'dock-slot traits is-filled' : 'dock-slot'}>
          <span className="dock-kind">Trait cards</span>
          {traits.length ? (
            <ul className="dock-traits">
              {traits.map((card) => (
                <li key={card.id}>
                  +{card.points} {card.animal}
                </li>
              ))}
            </ul>
          ) : (
            <span className="dock-empty">Waiting for cards</span>
          )}
        </li>
      </ul>

      <PointMeter
        total={summary.total}
        ready={summary.total === 7 && !summary.overCap}
        compact
      />

      <div className="dock-stats" aria-label="Computed stats">
        {ATTRIBUTES.map((attribute) => (
          <div key={attribute.key}>
            <strong>{summary.stats[attribute.key]}</strong>
            <span>{attribute.short}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

function IdentityFields({ form, errors, update, updateName, addMember, removeMember }) {
  return (
    <div className="fields">
      <fieldset className="field members">
        <legend>Student full name</legend>
        <div className="member-list">
          {form.studentNames.map((member, index) => {
            const nameError = errors.studentNames?.[index]
            return (
              <div className="member-field" key={member.id}>
                <div className="member-row">
                  <input
                    id={`student-name-${index}`}
                    name={index === 0 ? 'studentName' : `groupMember-${member.id}`}
                    type="text"
                    autoComplete={index === 0 ? 'name' : 'off'}
                    aria-label={
                      index === 0
                        ? 'Student full name'
                        : `Group member ${index + 1}`
                    }
                    value={member.name}
                    aria-invalid={nameError ? 'true' : undefined}
                    aria-describedby={
                      nameError ? `student-name-${index}-error` : undefined
                    }
                    onChange={(event) => updateName(member.id, event.target.value)}
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      className="icon-button remove"
                      aria-label={`Remove group member ${index + 1}`}
                      onClick={() => removeMember(member.id)}
                    >
                      <RemoveIcon />
                    </button>
                  )}
                </div>
                {nameError && (
                  <small id={`student-name-${index}-error`} className="error">
                    {nameError}
                  </small>
                )}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className="icon-button add-member"
          aria-label="Add a group member"
          onClick={addMember}
        >
          <PlusIcon />
        </button>
      </fieldset>

      <label className="field" htmlFor="period">
        <span>Block</span>
        <select
          id="period"
          name="period"
          value={form.period}
          aria-invalid={errors.period ? 'true' : undefined}
          aria-describedby={errors.period ? 'period-error' : undefined}
          onChange={(event) => update('period', event.target.value)}
        >
          <option value="">Select a block</option>
          {BLOCKS.map((block) => (
            <option key={block} value={block}>
              Block {block}
            </option>
          ))}
        </select>
        {errors.period && (
          <small id="period-error" className="error">
            {errors.period}
          </small>
        )}
      </label>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Portrait({ size = 'default' }) {
  return (
    <div
      className={size === 'small' ? 'portrait is-small' : 'portrait'}
      role="img"
      aria-label="Portrait placeholder"
    >
      ?
    </div>
  )
}

function CreatureRoster({ selectedBlock }) {
  const [creatures, setCreatures] = useState([])
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    let cancelled = false

    loadCreatures().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setCreatures([])
        setMessage(result.message)
        setStatus('error')
        return
      }
      setCreatures(result.creatures)
      setMessage('')
      setStatus('ready')
    })

    return () => {
      cancelled = true
    }
  }, [])

  const counts = Object.fromEntries(BLOCKS.map((block) => [block, 0]))
  for (const creature of creatures) {
    if (counts[creature.period] != null) counts[creature.period] += 1
  }

  const shown = selectedBlock
    ? creatures.filter((creature) => creature.period === selectedBlock)
    : []

  return (
    <main className="page roster">
      <header className="intro">
        <p className="eyebrow">Class roster</p>
        <h1>Submitted creatures</h1>
        <p>
          Choose a block to see every creature that class has entered into the
          arena.
        </p>
      </header>

      <section className="sheet roster-sheet">
        <h2 id="block-heading">Choose a block</h2>
        <ul className="block-picker" aria-labelledby="block-heading">
          {BLOCKS.map((block) => {
            const selected = selectedBlock === block
            const count = counts[block]
            return (
              <li key={block}>
                <a
                  className={selected ? 'block-chip is-selected' : 'block-chip'}
                  href={`#creatures/${block}`}
                  aria-current={selected ? 'page' : undefined}
                >
                  <span>Block {block}</span>
                  <small>
                    {status === 'ready'
                      ? `${count} ${count === 1 ? 'creature' : 'creatures'}`
                      : ' '}
                  </small>
                </a>
              </li>
            )
          })}
        </ul>

        {status === 'loading' && (
          <p className="hint roster-empty">Loading creatures...</p>
        )}
        {status === 'error' && (
          <p className="form-alert roster-empty" role="alert">
            {message}
          </p>
        )}
        {status === 'ready' && !selectedBlock && (
          <p className="hint roster-empty">
            Pick a block above to see its creatures.
          </p>
        )}
        {status === 'ready' && selectedBlock && shown.length === 0 && (
          <p className="hint roster-empty">
            No creatures have been submitted for Block {selectedBlock} yet.
          </p>
        )}

        {status === 'ready' && shown.length > 0 && (
          <ul className="creature-list">
            {shown.map((creature) => {
              const adaptation = ADAPTATIONS.find(
                (item) => item.id === creature.adaptation,
              )
              return (
                <li key={creature.id}>
                  <article className="creature-card">
                    <button
                      type="button"
                      className="remove-creature"
                      aria-label={`Remove ${creature.speciesName}`}
                      onClick={() => setPendingDelete(creature)}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M3 8h10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <Portrait size="small" />
                    <div>
                      <h3>{creature.speciesName}</h3>
                      <p className="receipt-lead">
                        {creature.studentNames.join(', ')}
                      </p>
                      <p className="roster-meta">
                        <span>{creature.archetype}</span>
                        <span>
                          {labelFor(
                            ADAPTATIONS,
                            creature.adaptation,
                            adaptation?.name,
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="stat-grid roster-stats">
                      <div className="stat-tile">
                        <strong>{creature.size}</strong>
                        <span>Size</span>
                      </div>
                      <div className="stat-tile">
                        <strong>{creature.efficiency}</strong>
                        <span>Efficiency</span>
                      </div>
                      <div className="stat-tile">
                        <strong>{creature.agility}</strong>
                        <span>Agility</span>
                      </div>
                    </div>
                    {creature.story && (
                      <p className="profile-story roster-story">
                        {creature.story}
                      </p>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {pendingDelete && (
        <AdminPinModal
          creature={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={(id) => {
            setCreatures((current) =>
              current.filter((creature) => creature.id !== id),
            )
            setPendingDelete(null)
          }}
        />
      )}
    </main>
  )
}

function AdminPinModal({ creature, onCancel, onDeleted }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  async function handleSubmit(event) {
    event.preventDefault()
    if (pin !== ADMIN_PIN) {
      setError('That PIN is not correct.')
      return
    }

    setBusy(true)
    setError('')
    const result = await deleteCreature(creature.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onDeleted(creature.id)
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        aria-describedby="pin-copy"
      >
        <h2 id="pin-title">Remove this creature?</h2>
        <p id="pin-copy">
          Enter the admin PIN to delete {creature.speciesName} from the class
          list.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field" htmlFor="admin-pin">
            <span>Admin PIN</span>
            <input
              ref={inputRef}
              id="admin-pin"
              name="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'pin-error' : undefined}
              onChange={(event) => {
                setPin(event.target.value)
                setError('')
              }}
            />
          </label>
          {error && (
            <small id="pin-error" className="error">
              {error}
            </small>
          )}
          <div className="actions">
            <button type="submit" className="danger" disabled={busy}>
              {busy ? 'Deleting...' : 'Delete creature'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreatureProfile({ creature, onEdit, onHome }) {
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaveMessage('')
    const result = await saveCreature(creature)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      return
    }
    setSaveMessage(result.message)
  }

  return (
    <article className="sheet profile">
      <CreatureProfileCard creature={creature} />

      <div className="actions">
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit creature'}
        </button>
        <button type="button" className="secondary" onClick={onEdit} disabled={saving}>
          Edit creature
        </button>
      </div>
      {saveMessage && (
        <p className="save-note" role="status">
          {saveMessage}
        </p>
      )}
      {saved && <SuccessModal onHome={onHome} />}
    </article>
  )
}

function SuccessModal({ onHome }) {
  const buttonRef = useRef(null)

  useEffect(() => {
    buttonRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="modal-backdrop">
      <div
        className="modal is-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        aria-describedby="save-copy"
      >
        <h2 id="save-title">Success!</h2>
        <p id="save-copy">Creature has been submitted.</p>
        <div className="actions">
          <button ref={buttonRef} type="button" onClick={onHome}>
            Return home
          </button>
        </div>
      </div>
    </div>
  )
}
