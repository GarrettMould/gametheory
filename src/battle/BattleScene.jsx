import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { disposeObject, makeEnvMap } from '../creaturesupdate/kit.js'
import { buildCreature } from '../creaturesupdate/registry.js'
import CreatureModel from './CreatureModel.jsx'
import { pickSpecies, populationOf } from './challenge.js'
import { createJungleWorld } from './jungleWorld.js'
import { createRoamWorld } from './roamWorld.js'
import { toBattleCreature } from './toBattleCreature.js'

const CREATURE_SCALE = 0.4
const CREATURE_RADIUS = 1.3
const PLAYER_RADIUS = 0.7
const TURN_RATE = 2.3 // radians per second while A or D is held
const BACKWARD_PACE = 0.55 // walking backward is slower than forward
const WADING_PACE = 0.6 // so is crossing a stream
const JUMP_SPEED = 6.5 // upward speed at take-off; with GRAVITY that is a hop a little over 1 unit high
const GRAVITY = 18
const LOOK_SPEED = 0.0025 // radians of view per pixel the pointer moves
const SWIPE_SPEED = 0.002 // radians of view per pixel of two-finger swipe
const LOOK_LIMIT = 1.2 // how far up or down the view can tilt, in radians
// The player sees through the creature's eyes, so bigger creatures look from higher up.
// Indexed by the size stat (1-6), matching how the models themselves scale with size.
const EYE_HEIGHT_BY_SIZE = [0.9, 0.9, 1.2, 1.6, 2.1, 2.5, 3]

const HERD_SIZE = 16 // animals kept wandering around the player
// New animals appear out in the haze and are removed once well out of sight. These are fractions of
// how far the terrain lets you see, which differs between the open savanna and the jungle.
const SPAWN_NEAR = 0.8
const SPAWN_FAR = 0.98
const VANISH_AT = 1.1
const TERRAINS = { savanna: createRoamWorld, jungle: createJungleWorld }
const NOTICE_RANGE = 8 // an animal this close stops and watches the player
const CHALLENGE_RANGE = 5.5 // and this close it can be challenged
const CROWD_RANGE = 3.5 // closer than this is too close: the animal may force a challenge itself
const CALM_AFTER_CHALLENGE = 6 // seconds after any challenge during which nobody forces another
// Chance per second that a crowded animal forces a challenge, by strategy: the ones that cheat or
// probe are the attacking types, the ones that always cooperate almost never start anything.
const ATTACK_CHANCE = {
  'All Cheat': 0.5,
  Detective: 0.3,
  Grudger: 0.15,
  Copycat: 0.12,
  'All Cooperate': 0.03,
}

const MOVE_KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
}

const STILL = { forward: false, back: false, left: false, right: false, jump: false }
const between = (a, b) => a + (b - a) * Math.random()
/** The signed shortest turn from one heading to another. */
const turnToward = (from, to) =>
  THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
const isTyping = (event) =>
  ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)

/** Tracks which movement keys are held. Returns a ref so reading it never re-renders. */
function useMoveKeys() {
  const keys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
  })

  useEffect(() => {
    const held = keys.current
    function set(event, down) {
      const action = MOVE_KEYS[event.code]
      if (!action) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event)) return
      // Stop arrows scrolling the page and Space re-pressing whichever button was clicked last.
      if (event.code.startsWith('Arrow') || event.code === 'Space') {
        event.preventDefault()
      }
      held[action] = down
    }
    function release() {
      for (const action of Object.keys(held)) held[action] = false
    }
    const onDown = (event) => set(event, true)
    const onUp = (event) => set(event, false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
    }
  }, [])

  return keys
}

/**
 * Builds each species' detailed model once and hands out cheap copies that share its shapes,
 * so the world can hold many of the same animal.
 */
function createModelBank() {
  const originals = new Map()
  return {
    /** A new copy of this creature's model, or null if it has no detailed model. */
    copy(creature) {
      if (!originals.has(creature.id)) {
        originals.set(creature.id, buildCreature(toBattleCreature(creature)))
      }
      return originals.get(creature.id)?.clone(true) ?? null
    },
    dispose() {
      for (const original of originals.values()) disposeObject(original)
      originals.clear()
    },
  }
}

/** The player: unseen, because the camera is its eyes. Walks, turns, jumps. */
function Player({ creature, world }) {
  const body = useRef({ heading: 0, pitch: 0, stride: 0, lift: 0, rise: 0 }) // lift: height above the ground mid-jump
  const canvas = useThree((state) => state.gl.domElement)
  const speed = 4.5 + (Number(creature?.agility) || 3) * 0.8
  const size = Math.min(6, Math.max(1, Math.round(Number(creature?.size) || 3)))
  const eyeHeight = EYE_HEIGHT_BY_SIZE[size]

  // Looking around. While the view holds the pointer, moving the mouse or a finger on the trackpad
  // turns the view side to side and tilts it up and down (Esc gives the pointer back).
  // The view takes the pointer by itself when the arena opens. Browsers only allow that right after
  // the user does something, so if it is refused here it is taken on their first key press instead.
  // Once they have pressed Esc, only clicking the view takes it again.
  // A two-finger swipe over the view also looks around, whether or not the pointer is held.
  useEffect(() => {
    const me = body.current
    function look(dx, dy, speed) {
      if (world.busy.current) return // the view is held on the opponent during a challenge
      me.heading -= dx * speed
      me.pitch = THREE.MathUtils.clamp(me.pitch - dy * speed, -LOOK_LIMIT, LOOK_LIMIT)
    }
    let everHeld = false
    function capture() {
      if (document.pointerLockElement === canvas) return
      try {
        canvas.requestPointerLock?.()?.catch?.(() => {})
      } catch {
        // refused: the browser wants a click or key press first
      }
    }
    function onClick() {
      capture()
    }
    function onFirstKeys() {
      if (!everHeld) capture()
    }
    function onHeldChange() {
      if (document.pointerLockElement === canvas) everHeld = true
    }
    capture()
    function onMove(event) {
      if (document.pointerLockElement !== canvas) return
      look(event.movementX, event.movementY, LOOK_SPEED)
    }
    function onWheel(event) {
      event.preventDefault()
      look(event.deltaX, event.deltaY, SWIPE_SPEED)
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('mousemove', onMove)
    document.addEventListener('pointerlockchange', onHeldChange)
    window.addEventListener('keydown', onFirstKeys)
    return () => {
      document.removeEventListener('pointerlockchange', onHeldChange)
      window.removeEventListener('keydown', onFirstKeys)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
      document.removeEventListener('mousemove', onMove)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
    }
  }, [canvas, world])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const { keys, terrain, herd, position } = world
    const me = body.current
    // During a challenge the player stands still and turns to face the opponent.
    const rival = world.busy.current ? world.rival.current : null
    const held = world.busy.current ? STILL : keys.current
    if (rival) {
      const want = Math.atan2(-(rival.z - position.z), rival.x - position.x)
      const ease = 1 - Math.exp(-5 * delta)
      me.heading += turnToward(me.heading, want) * ease
      me.pitch -= me.pitch * ease
    }

    // A and D turn the creature; W and S walk it along the way it faces.
    me.heading += ((held.left ? 1 : 0) - (held.right ? 1 : 0)) * TURN_RATE * delta
    const ahead = (held.forward ? 1 : 0) - (held.back ? 1 : 0)
    const facingX = Math.cos(me.heading)
    const facingZ = -Math.sin(me.heading)

    let x = position.x
    let z = position.z
    if (ahead !== 0) {
      const pace =
        speed *
        (ahead < 0 ? -BACKWARD_PACE : 1) *
        (terrain.inWater(x, z) && me.lift === 0 ? WADING_PACE : 1)
      x += facingX * pace * delta
      z += facingZ * pace * delta
      const clear = terrain.collide(x, z, PLAYER_RADIUS)
      x = clear[0]
      z = clear[1]
      for (const animal of herd.current) {
        const dx = x - animal.x
        const dz = z - animal.z
        const distance = Math.hypot(dx, dz)
        const reach = CREATURE_RADIUS + PLAYER_RADIUS
        if (distance < reach && distance > 0.0001) {
          x = animal.x + (dx / distance) * reach
          z = animal.z + (dz / distance) * reach
        }
      }
      if (me.lift === 0) me.stride += delta * Math.abs(pace) * 1.6
    }

    // Space jumps, but only from the ground.
    if (held.jump && me.lift === 0) me.rise = JUMP_SPEED
    if (me.lift > 0 || me.rise > 0) {
      me.lift += me.rise * delta
      me.rise -= GRAVITY * delta
      if (me.lift <= 0) {
        me.lift = 0
        me.rise = 0
      }
    }

    const floor = terrain.groundHeight(x, z)
    position.set(x, floor + me.lift, z)
    terrain.update(x, z)
    terrain.animate(state.clock.elapsedTime, x, z)

    // First person: the camera is the creature's eyes.
    const walking = ahead !== 0 && me.lift === 0
    const bob = walking ? Math.abs(Math.sin(me.stride)) * 0.05 : 0
    const eyeY = floor + me.lift + eyeHeight + bob
    state.camera.position.set(x, eyeY, z)
    const level = Math.cos(me.pitch)
    state.camera.lookAt(
      x + facingX * level,
      eyeY + Math.sin(me.pitch),
      z + facingZ * level,
    )
  })

  return null
}

/** Moves one wandering animal forward by `delta` seconds: watch the player, stand about, or amble somewhere. */
function stepAnimal(animal, world, delta, time) {
  const player = world.position
  const toPlayerX = player.x - animal.x
  const toPlayerZ = player.z - animal.z
  animal.walking = false

  if (animal.fighting) {
    // Mid-challenge: square up to the player.
    const want = Math.atan2(-toPlayerZ, toPlayerX)
    animal.heading += turnToward(animal.heading, want) * (1 - Math.exp(-8 * delta))
    return
  }

  if (Math.hypot(toPlayerX, toPlayerZ) < NOTICE_RANGE && !animal.spent) {
    // Stop and watch whoever has come close.
    const want = Math.atan2(-toPlayerZ, toPlayerX)
    animal.heading += turnToward(animal.heading, want) * (1 - Math.exp(-4 * delta))
    animal.pause = Math.max(animal.pause, 1)
    return
  }

  if (animal.pause > 0) {
    // Stand a while, glancing around, then pick somewhere to go.
    animal.pause -= delta
    animal.heading += Math.sin(time * 0.6 + animal.seed) * 0.15 * delta
    if (animal.pause <= 0) {
      const angle = between(0, Math.PI * 2)
      const reach = between(8, 24)
      animal.targetX = animal.x + Math.cos(angle) * reach
      animal.targetZ = animal.z + Math.sin(angle) * reach
      animal.patience = reach / animal.speed + 4
    }
    return
  }

  // Amble to the chosen spot, turning to face it before setting off.
  const dx = animal.targetX - animal.x
  const dz = animal.targetZ - animal.z
  const off = turnToward(animal.heading, Math.atan2(-dz, dx))
  animal.heading += Math.sign(off) * Math.min(Math.abs(off), 2.2 * delta)
  animal.patience -= delta
  if (Math.abs(off) < 0.7) {
    const pace = animal.speed * (world.terrain.inWater(animal.x, animal.z) ? WADING_PACE : 1)
    let [x, z] = world.terrain.collide(
      animal.x + Math.cos(animal.heading) * pace * delta,
      animal.z - Math.sin(animal.heading) * pace * delta,
      CREATURE_RADIUS,
    )
    const gap = Math.hypot(x - player.x, z - player.z)
    const reach = CREATURE_RADIUS + PLAYER_RADIUS
    if (gap < reach && gap > 0.0001) {
      x = player.x + ((x - player.x) / gap) * reach
      z = player.z + ((z - player.z) / gap) * reach
    }
    animal.x = x
    animal.z = z
    animal.stride += delta * pace * 2.2
    animal.walking = true
  }
  if (Math.hypot(dx, dz) < 1 || animal.patience <= 0) {
    animal.pause = between(1.5, 6)
  }
}

/** Draws one wandering animal. `animal` is its live record, moved by stepAnimal. */
function Animal({ animal, world }) {
  const group = useRef()
  const model = useMemo(
    () => world.models.copy(animal.creature),
    [world.models, animal.creature],
  )

  useFrame((state, rawDelta) => {
    const node = group.current
    if (!node) return
    stepAnimal(animal, world, Math.min(rawDelta, 0.1), state.clock.elapsedTime)
    const bob = animal.fighting
      ? Math.abs(Math.sin(state.clock.elapsedTime * 7 + animal.seed)) * 0.28 // hopping about mid-challenge
      : animal.walking
        ? Math.abs(Math.sin(animal.stride)) * 0.06
        : 0
    node.position.set(
      animal.x,
      world.terrain.groundHeight(animal.x, animal.z) + bob,
      animal.z,
    )
    node.rotation.y = animal.heading // creature models face +X
  })

  return (
    <group ref={group}>
      {model ? (
        <primitive object={model} scale={CREATURE_SCALE} />
      ) : (
        <CreatureModel creature={animal.creature} side="left" />
      )}
    </group>
  )
}

/**
 * Keeps a herd of animals around the player. Which species turn up follows the population numbers:
 * a species that is shrinking is picked less often, one that is growing more often.
 */
function Herd({ creatures, playerId, populations, world, busy, onNearby, onChallenge }) {
  const [animals, setAnimals] = useState([])
  const timing = useRef({ nextCheck: 0, nextKey: 1, filled: false, calmUntil: 0 })
  const nearest = useRef(null)
  const live = useRef({ creatures, playerId, populations, onNearby, onChallenge })

  useEffect(() => {
    live.current = { creatures, playerId, populations, onNearby, onChallenge }
  })
  useEffect(() => {
    world.herd.current = animals
  }, [world, animals])

  // A challenge has ended: the opponent stops squaring up, and everyone leaves the player be for a bit.
  useEffect(() => {
    world.busy.current = busy
    if (busy) return
    const rival = world.rival.current
    if (rival) rival.fighting = false
    world.rival.current = null
    timing.current.calmUntil = performance.now() / 1000 + CALM_AFTER_CHALLENGE
  }, [busy, world])

  // When the herd goes away (the player switched creature), nobody is nearby any more.
  useEffect(() => () => live.current.onNearby(null), [])

  // Each animal can be challenged once. Afterwards it loses interest and wanders off.
  function begin(animal, forced) {
    animal.spent = true
    animal.fighting = true
    animal.pause = 0.4
    world.rival.current = animal
    world.busy.current = true
    live.current.onChallenge(animal.creature, forced)
  }
  const beginRef = useRef(begin)
  useEffect(() => {
    beginRef.current = begin
  })

  useEffect(() => {
    function onKey(event) {
      if (event.code !== 'KeyE' || event.repeat || isTyping(event)) return
      const animal = nearest.current
      if (!animal || world.busy.current) return
      nearest.current = null
      live.current.onNearby(null)
      beginRef.current(animal, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [world])

  useFrame((state, rawDelta) => {
    const player = world.position
    const { creatures: all, playerId: me, populations: counts } = live.current
    const delta = Math.min(rawDelta, 0.1)
    const calm =
      world.busy.current || performance.now() / 1000 < timing.current.calmUntil

    // Who, if anyone, is close enough to challenge? And is anyone being crowded into attacking?
    let closest = null
    let closestDistance = CHALLENGE_RANGE
    let attacker = null
    for (const animal of animals) {
      if (animal.spent) continue
      const distance = Math.hypot(animal.x - player.x, animal.z - player.z)
      if (distance < closestDistance) {
        closest = animal
        closestDistance = distance
      }
      if (!calm && !attacker && distance < CROWD_RANGE) {
        const chance = ATTACK_CHANCE[animal.creature.archetype] ?? ATTACK_CHANCE.Copycat
        if (Math.random() < chance * delta) attacker = animal
      }
    }
    if (attacker) {
      if (closest === attacker) closest = null
      begin(attacker, true)
    }
    if (closest !== nearest.current) {
      nearest.current = closest
      live.current.onNearby(closest ? closest.creature : null)
    }

    // A few times a second: drop animals left far behind, and bring in a new one if the herd is short.
    const now = state.clock.elapsedTime
    const pace = timing.current
    if (now < pace.nextCheck) return
    pace.nextCheck = now + (pace.filled ? 0.5 : 0.05)

    const sight = world.terrain.fogFar
    // Animals of a species that has died out or been eliminated go too.
    const kept = animals.filter(
      (animal) =>
        populationOf(counts, animal.creature.id) > 0 &&
        Math.hypot(animal.x - player.x, animal.z - player.z) < VANISH_AT * sight,
    )
    let next = kept.length === animals.length ? animals : kept
    if (kept.length >= HERD_SIZE) {
      pace.filled = true
    } else {
      const others = all.filter(
        (creature) => creature.id !== me && populationOf(counts, creature.id) > 0,
      )
      const creature = pickSpecies(others, counts)
      if (creature) {
        // The first herd is scattered all around; after that, newcomers arrive from the haze.
        const distance = pace.filled
          ? between(SPAWN_NEAR * sight, SPAWN_FAR * sight)
          : between(14, SPAWN_FAR * sight)
        const angle = between(0, Math.PI * 2)
        const [x, z] = world.terrain.collide(
          player.x + Math.cos(angle) * distance,
          player.z + Math.sin(angle) * distance,
          CREATURE_RADIUS,
        )
        next = [
          ...kept,
          {
            key: pace.nextKey,
            creature,
            x,
            z,
            heading: between(0, Math.PI * 2),
            speed: 1.1 + (Number(creature.agility) || 3) * 0.3,
            pause: between(0, 4),
            patience: 0,
            targetX: x,
            targetZ: z,
            stride: 0,
            seed: between(0, 10),
            walking: false,
            fighting: false,
            spent: false,
          },
        ]
        pace.nextKey += 1
      }
    }
    if (next !== animals) setAnimals(next)
  })

  return animals.map((animal) => (
    <Animal key={animal.key} animal={animal} world={world} />
  ))
}

/** Keeps the sun's shadow box over the player, so shadows work wherever they roam. */
function SunFollow({ world }) {
  const { terrain } = world
  const sun = useMemo(() => {
    let found = null
    terrain.group.traverse((node) => {
      if (node.isDirectionalLight && node.castShadow) found = node
    })
    if (found) {
      const box = found.shadow.camera
      box.left = -16
      box.right = 16
      box.top = 16
      box.bottom = -12
      box.far = 130 // far enough to take in a jungle canopy overhead
      box.updateProjectionMatrix()
    }
    return found
  }, [terrain])

  useFrame(() => {
    if (!sun) return
    const at = world.position
    sun.target.position.set(at.x + 0.6, at.y + 2.5, at.z)
    sun.position.copy(terrain.sunDirection).multiplyScalar(60).add(sun.target.position)
  })

  return null
}

function Arena({
  creatures,
  playerId,
  populations,
  busy,
  run,
  terrainKind,
  onNearby,
  onChallenge,
}) {
  const { scene, gl } = useThree()
  const keys = useMoveKeys()
  const herd = useRef([])
  const busyRef = useRef(false) // true while a challenge is being played
  const rival = useRef(null) // the animal being challenged
  const terrain = useMemo(
    () => (TERRAINS[terrainKind] || createRoamWorld)(),
    [terrainKind],
  )
  const models = useMemo(() => createModelBank(), [])
  const [position] = useState(() => new THREE.Vector3())

  useEffect(() => {
    const previousFog = scene.fog
    const previousEnvironment = scene.environment
    const reflections = makeEnvMap(gl, terrain)
    scene.fog = terrain.fog
    scene.environment = reflections
    return () => {
      scene.fog = previousFog
      scene.environment = previousEnvironment
      reflections.dispose()
    }
  }, [scene, gl, terrain])

  useEffect(
    () => () => {
      terrain.dispose()
      models.dispose()
    },
    [terrain, models],
  )

  // Everything the per-frame code reads, bundled so movement never re-renders React.
  const world = useMemo(
    () => ({ keys, herd, position, terrain, models, busy: busyRef, rival }),
    [keys, position, terrain, models],
  )
  const player = creatures.find((creature) => creature.id === playerId) || null

  return (
    <>
      <primitive object={terrain.group} />
      <Player creature={player} world={world} />
      <SunFollow world={world} />
      {/* keyed by player, game and terrain: changing any of them starts the herd afresh */}
      <Herd
        key={`${playerId}:${run}:${terrainKind}`}
        creatures={creatures}
        playerId={playerId}
        populations={populations}
        world={world}
        busy={busy}
        onNearby={onNearby}
        onChallenge={onChallenge}
      />
    </>
  )
}

export default function BattleScene({
  creatures,
  playerId,
  populations,
  busy,
  run,
  terrainKind = 'savanna',
  onNearby,
  onChallenge,
}) {
  const camera = useMemo(
    () => ({ position: [0, 1.6, 0], fov: 62, near: 0.05, far: 700 }),
    [],
  )

  return (
    <Canvas
      className="battle-canvas"
      shadows
      camera={camera}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Arena
          creatures={creatures}
          playerId={playerId}
          populations={populations}
          busy={busy}
          run={run}
          terrainKind={terrainKind}
          onNearby={onNearby}
          onChallenge={onChallenge}
        />
      </Suspense>
    </Canvas>
  )
}
