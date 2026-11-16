import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { disposeObject, makeEnvMap } from '../creaturesupdate/kit.js'
import { buildCreature } from '../creaturesupdate/registry.js'
import CreatureModel from './CreatureModel.jsx'
import { aggressionOf, pickSpecies, populationOf, strategyOf } from './challenge.js'
import { createArcticWorld } from './arcticWorld.js'
import { createJungleWorld } from './jungleWorld.js'
import { createRoamWorld } from './roamWorld.js'
import { toBattleCreature } from './toBattleCreature.js'
import { createWetlandWorld } from './wetlandWorld.js'

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
const TERRAINS = {
  savanna: createRoamWorld,
  jungle: createJungleWorld,
  arctic: createArcticWorld,
  wetland: createWetlandWorld,
}
const ICE_GRIP = 1.3 // how quickly you can change speed or direction on ice (elsewhere it is instant)
const PACK_SIZE = 2 // how many of your own kind travel with you if your power-up is Pack
const ARMOR_REST = 20 // seconds an animal stays away after bouncing off your armor
const NOTICE_RANGE = 8 // an animal this close stops and watches the player
const CHALLENGE_RANGE = 5.5 // and this close it can be challenged
const CALM_AFTER_CHALLENGE = 6 // seconds after any challenge during which nobody chases or catches the player
// Aggressive animals hunt. How far off one spots the player, how long it keeps up the chase and how
// fast it runs all grow with its aggression (see aggressionOf) and its Agility.
const SPOT_RANGE = 10 // an animal with any aggression spots the player this close...
const SPOT_RANGE_GAIN = 18 // ...and a fully aggressive one from this much farther
const CATCH_RANGE = 2.6 // a chaser this close has caught the player: a forced challenge
const LOSE_RANGE = 36 // a chaser left this far behind gives up
const DANGER_RANGE = 30 // the danger meter starts to fill when a chaser is this close
const GREEN_LEVEL = 0.3 // the meter is in the green below this
const SHAKE_OFF_SECONDS = 3 // keep the meter in the green this long and the chaser gives up
/** How full the danger meter is for a chaser at this distance: 0 far away, 1 about to catch you. */
const dangerLevel = (distance) =>
  Math.min(1, Math.max(0, 1 - (distance - CATCH_RANGE) / (DANGER_RANGE - CATCH_RANGE)))
const CHASE_REST = 10 // seconds before an animal that gave up will chase again
const BOUT_SECONDS = 7 // now and then two animals play each other for this long
const TAG_RANGE = 30 // an animal this close shows its name over its head
const REVEAL_RANGE = 10 // and this close, its strategy too
const EAT_REACH = 1.8 // walking this close to a berry bush eats it

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
  KeyV: 'view',
}

const STILL = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  view: false,
}
const OUTSIDE = new THREE.Vector3() // scratch: where the third-person camera sits
/** Walking speed at a spot, as a share of normal: slower in water, deep snow and the like. */
const paceAt = (terrain, x, z) =>
  terrain.pace ? terrain.pace(x, z) : terrain.inWater(x, z) ? WADING_PACE : 1
/** What is underfoot, for the sound of a footstep. */
function surfaceAt(terrain, x, z) {
  if (terrain.inWater(x, z)) return 'water'
  if (terrain.slippery?.(x, z)) return 'ice'
  return terrain.kind === 'arctic' ? 'snow' : 'ground'
}
/**
 * How easily animals can see the player right now, as a share of normal. A blizzard cuts it for
 * everyone. Reeds and tall grass halve it. Camouflage cuts it everywhere, and in cover hides you
 * completely.
 */
function spotScale(world) {
  const { terrain, position } = world
  const camouflaged = world.power.current === 'camouflage'
  const inCover =
    Boolean(terrain.cover?.(position.x, position.z)) || world.place.current?.type === 'tallgrass'
  return (
    (terrain.visibility?.() ?? 1) *
    (camouflaged ? 0.6 : 1) *
    (inCover ? (camouflaged ? 0 : 0.5) : 1)
  )
}
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
    view: false,
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
  const body = useRef({ heading: 0, pitch: 0, stride: 0, steps: 0, vx: 0, vz: 0, lift: 0, rise: 0, outside: 0, orbit: 0 }) // lift: height above the ground mid-jump
  const figure = useRef()
  // The player's own model. Only ever drawn while V is held, to look at yourself from outside.
  const model = useMemo(
    () => (creature ? world.models.copy(creature) : null),
    [world.models, creature],
  )
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

    // Holding V steps outside for a look at yourself. You cannot walk, turn or jump while it is
    // held, so the game can only be played from the creature's own eyes.
    const viewing = held.view
    me.outside += ((viewing ? 1 : 0) - me.outside) * (1 - Math.exp(-10 * delta))
    me.orbit = viewing ? me.orbit + delta * 0.45 : 0

    // A and D turn the creature; W and S walk it along the way it faces.
    if (!viewing) {
      me.heading += ((held.left ? 1 : 0) - (held.right ? 1 : 0)) * TURN_RATE * delta
    }
    const ahead = viewing ? 0 : (held.forward ? 1 : 0) - (held.back ? 1 : 0)
    const facingX = Math.cos(me.heading)
    const facingZ = -Math.sin(me.heading)

    // What the player is asking for, as a velocity. On firm ground they get it at once; on ice
    // the creature keeps sliding the way it was going and only slowly comes round.
    let x = position.x
    let z = position.z
    const grounded = me.lift === 0
    const pace =
      ahead === 0
        ? 0
        : speed * (ahead < 0 ? -BACKWARD_PACE : 1) * (grounded ? paceAt(terrain, x, z) : 1)
    const onIce = grounded && Boolean(terrain.slippery?.(x, z))
    const grip = 1 - Math.exp(-(onIce ? ICE_GRIP : 60) * delta)
    me.vx += (facingX * pace - me.vx) * grip
    me.vz += (facingZ * pace - me.vz) * grip
    const going = Math.hypot(me.vx, me.vz)
    if (going > 0.05) {
      let nextX = x + me.vx * delta
      let nextZ = z + me.vz * delta
      const clear = terrain.collide(nextX, nextZ, PLAYER_RADIUS)
      nextX = clear[0]
      nextZ = clear[1]
      for (const animal of herd.current) {
        if (animal.follower) continue // your own pack gets out of your way
        const dx = nextX - animal.x
        const dz = nextZ - animal.z
        const distance = Math.hypot(dx, dz)
        const reach = CREATURE_RADIUS + PLAYER_RADIUS
        if (distance < reach && distance > 0.0001) {
          nextX = animal.x + (dx / distance) * reach
          nextZ = animal.z + (dz / distance) * reach
        }
      }
      if (terrain.canWalk && !terrain.canWalk(x, z, nextX, nextZ)) {
        // a cliff face: no way up here
        me.vx = 0
        me.vz = 0
      } else {
        x = nextX
        z = nextZ
        if (grounded) {
          me.stride += delta * going * 1.6
          // one footfall each half stride
          const steps = Math.floor(me.stride / Math.PI)
          if (steps !== me.steps) {
            me.steps = steps
            if (ahead !== 0) world.events.current.onStep(surfaceAt(terrain, x, z))
          }
        }
      }
    }

    // Space jumps, but only from the ground.
    if (held.jump && !viewing && me.lift === 0) me.rise = JUMP_SPEED
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

    // Walking into a berry bush eats it; standing in a place (carcass, watering hole...) is reported
    // so a challenge there plays that place's game.
    if (terrain.eatAt(x, z, EAT_REACH)) world.events.current.onEat()
    const place = terrain.placeAt(x, z)
    if (place !== world.place.current) {
      world.place.current = place
      world.events.current.onPlace(place ? place.type : null)
    }

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

    // Third person while V is held: the camera pulls out behind the creature and drifts around it.
    const node = figure.current
    if (node) {
      node.visible = me.outside > 0.5
      node.position.set(x, floor + me.lift, z)
      node.rotation.y = me.heading // creature models face +X
    }
    if (me.outside > 0.01) {
      const around = me.heading + Math.PI + me.orbit
      const back = 4 + size * 1.1
      const camX = x + Math.cos(around) * back
      const camZ = z - Math.sin(around) * back
      const camY = Math.max(
        floor + me.lift + eyeHeight * 0.9 + 1.2,
        terrain.groundHeight(camX, camZ) + 0.8,
      )
      state.camera.position.lerp(OUTSIDE.set(camX, camY, camZ), me.outside)
      state.camera.lookAt(x, floor + me.lift + eyeHeight * 0.6, z)
    }
  })

  return (
    <group ref={figure} visible={false}>
      {model ? (
        <primitive object={model} scale={CREATURE_SCALE} />
      ) : creature ? (
        <CreatureModel creature={creature} side="left" />
      ) : null}
    </group>
  )
}

/** Turn an animal toward a point and, once roughly facing it, move it there at `pace`. */
function travel(animal, world, toX, toZ, pace, turnRate, delta) {
  const player = world.position
  const off = turnToward(animal.heading, Math.atan2(-(toZ - animal.z), toX - animal.x))
  animal.heading += Math.sign(off) * Math.min(Math.abs(off), turnRate * delta)
  if (Math.abs(off) > 0.9) return
  const speed = pace * paceAt(world.terrain, animal.x, animal.z)
  let [x, z] = world.terrain.collide(
    animal.x + Math.cos(animal.heading) * speed * delta,
    animal.z - Math.sin(animal.heading) * speed * delta,
    CREATURE_RADIUS,
  )
  const gap = Math.hypot(x - player.x, z - player.z)
  const reach = CREATURE_RADIUS + PLAYER_RADIUS
  if (gap < reach && gap > 0.0001) {
    x = player.x + ((x - player.x) / gap) * reach
    z = player.z + ((z - player.z) / gap) * reach
  }
  if (world.terrain.canWalk && !world.terrain.canWalk(animal.x, animal.z, x, z)) {
    animal.patience = 0 // a cliff face: give up on this way and pick another
    return
  }
  animal.x = x
  animal.z = z
  animal.stride += delta * speed * 2.2
  animal.walking = true
}

/**
 * Moves one animal forward by `delta` seconds. In order of priority it: squares up during a
 * challenge, plays another animal, chases the player, stops to watch the player, stands about,
 * or ambles somewhere (aggressive ones tend to amble toward the player).
 */
function stepAnimal(animal, world, delta, time) {
  const player = world.position
  const toPlayerX = player.x - animal.x
  const toPlayerZ = player.z - animal.z
  const distance = Math.hypot(toPlayerX, toPlayerZ)
  const facePlayer = Math.atan2(-toPlayerZ, toPlayerX)
  animal.walking = false

  if (animal.fighting) {
    // Mid-challenge: square up to the player.
    animal.heading += turnToward(animal.heading, facePlayer) * (1 - Math.exp(-8 * delta))
    return
  }

  if (animal.follower) {
    // One of the player's own pack: keep close, without crowding.
    if (distance > 5) travel(animal, world, player.x, player.z, animal.chaseSpeed * 1.5, 5, delta)
    else animal.heading += turnToward(animal.heading, facePlayer + Math.PI) * (1 - Math.exp(-2 * delta))
    return
  }

  if (animal.bout) {
    // Playing another animal: close in, then face each other.
    const other = animal.bout
    if (Math.hypot(other.x - animal.x, other.z - animal.z) > 4.5) {
      travel(animal, world, other.x, other.z, animal.speed * 1.6, 3, delta)
    } else {
      const want = Math.atan2(-(other.z - animal.z), other.x - animal.x)
      animal.heading += turnToward(animal.heading, want) * (1 - Math.exp(-6 * delta))
    }
    return
  }

  const free = !animal.spent && !world.busy.current
  const calm = performance.now() / 1000 < world.calm.current
  const seen = spotScale(world) // 0 means the player cannot be seen at all
  if (animal.chasing) {
    // Time spent far enough back that the player's danger meter is in the green.
    animal.shaken = dangerLevel(distance) < GREEN_LEVEL ? animal.shaken + delta : 0
    if (
      !free ||
      seen === 0 ||
      time > animal.chaseUntil ||
      distance > LOSE_RANGE ||
      animal.shaken >= SHAKE_OFF_SECONDS
    ) {
      // Shaken off, out of sight, or out of puff.
      animal.chasing = false
      animal.restUntil = time + CHASE_REST
      animal.pause = 1.5
    } else {
      travel(animal, world, player.x, player.z, animal.chaseSpeed, 4.5, delta)
      return
    }
  } else if (
    free &&
    !calm &&
    animal.aggression > 0 &&
    time > animal.restUntil &&
    distance < (SPOT_RANGE + SPOT_RANGE_GAIN * animal.aggression) * seen
  ) {
    // Spotted the player. The more aggressive, the likelier it gives chase. Only one hunts at a
    // time, so the player is kept on their toes without being mobbed. A player travelling with
    // their pack is a less tempting target.
    const someoneElseHunting = world.herd.current.some((other) => other.chasing)
    const nerve = animal.aggression * (world.power.current === 'pack' ? 0.5 : 1)
    if (!someoneElseHunting && Math.random() < nerve) {
      animal.chasing = true
      animal.shaken = 0
      animal.chaseUntil = time + 8 + 8 * animal.aggression
      return
    }
    animal.restUntil = time + 6
  }

  if (distance < NOTICE_RANGE && !animal.spent) {
    // Stop and watch whoever has come close.
    animal.heading += turnToward(animal.heading, facePlayer) * (1 - Math.exp(-4 * delta))
    animal.pause = Math.max(animal.pause, 1)
    return
  }

  if (animal.pause > 0) {
    // Stand a while, glancing around, then pick somewhere to go.
    animal.pause -= delta
    animal.heading += Math.sin(time * 0.6 + animal.seed) * 0.15 * delta
    if (animal.pause <= 0) {
      // Aggressive animals drift toward the player, so trouble finds you wherever you are.
      const seeking = free && Math.random() < animal.aggression * 0.8
      const angle = seeking
        ? Math.atan2(toPlayerZ, toPlayerX) + between(-0.5, 0.5)
        : between(0, Math.PI * 2)
      const reach = seeking ? Math.min(distance, between(14, 28)) : between(8, 24)
      animal.targetX = animal.x + Math.cos(angle) * reach
      animal.targetZ = animal.z + Math.sin(angle) * reach
      animal.patience = reach / animal.speed + 4
    }
    return
  }

  // Amble to the chosen spot.
  travel(animal, world, animal.targetX, animal.targetZ, animal.speed, 2.2, delta)
  animal.patience -= delta
  const left = Math.hypot(animal.targetX - animal.x, animal.targetZ - animal.z)
  if (left < 1 || animal.patience <= 0) animal.pause = between(1.5, 6)
}

/**
 * Draws one wandering animal and the tag over its head: just its name, with its strategy added
 * once the player comes close. `animal` is its live record, moved by stepAnimal.
 */
function Animal({ animal, world }) {
  const group = useRef()
  const tag = useRef()
  const strategy = useRef()
  const model = useMemo(
    () => world.models.copy(animal.creature),
    [world.models, animal.creature],
  )
  const size = Math.min(6, Math.max(1, Math.round(Number(animal.creature.size) || 3)))

  useFrame((state, rawDelta) => {
    const node = group.current
    if (!node) return
    const time = state.clock.elapsedTime
    stepAnimal(animal, world, Math.min(rawDelta, 0.1), time)
    const sparring = animal.fighting || (animal.bout && !animal.walking)
    const bob = sparring
      ? Math.abs(Math.sin(time * 7 + animal.seed)) * 0.28 // hopping about mid-game
      : animal.walking
        ? Math.abs(Math.sin(animal.stride)) * (animal.chasing ? 0.12 : 0.06)
        : 0
    node.position.set(
      animal.x,
      world.terrain.groundHeight(animal.x, animal.z) + bob,
      animal.z,
    )
    node.rotation.y = animal.heading // creature models face +X

    const label = tag.current
    if (label) {
      const player = world.position
      const away = Math.hypot(animal.x - player.x, animal.z - player.z)
      label.hidden = away > TAG_RANGE || world.busy.current || Boolean(animal.follower)
      if (strategy.current) strategy.current.hidden = away > REVEAL_RANGE
    }
  })

  return (
    <group ref={group}>
      {model ? (
        <primitive object={model} scale={CREATURE_SCALE} />
      ) : (
        <CreatureModel creature={animal.creature} side="left" />
      )}
      <Html
        position={[0, EYE_HEIGHT_BY_SIZE[size] + 1.2, 0]}
        center
        zIndexRange={[1, 0]}
        pointerEvents="none"
      >
        <div ref={tag} className="animal-tag" hidden>
          <strong>{animal.creature.speciesName}</strong>
          <span ref={strategy} hidden>
            {strategyOf(animal.creature)}
          </span>
        </div>
      </Html>
    </group>
  )
}

/**
 * Keeps a herd of animals around the player. Which species turn up follows the population numbers:
 * a species that is shrinking is picked less often, one that is growing more often.
 */
function Herd({
  creatures,
  playerId,
  populations,
  world,
  busy,
  onNearby,
  onChallenge,
  onHunted,
  onDanger,
  onArmor,
}) {
  const [animals, setAnimals] = useState([])
  const timing = useRef({ nextCheck: 0, nextKey: 1, filled: false })
  const nearest = useRef(null)
  const hunter = useRef(null) // the animal chasing the player, if any
  const bouts = useRef([]) // games going on between two animals: { a, b, until }
  const live = useRef({
    creatures,
    playerId,
    populations,
    onNearby,
    onChallenge,
    onHunted,
    onDanger,
    onArmor,
  })

  useEffect(() => {
    live.current = {
    creatures,
    playerId,
    populations,
    onNearby,
    onChallenge,
    onHunted,
    onDanger,
    onArmor,
  }
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
    world.calm.current = performance.now() / 1000 + CALM_AFTER_CHALLENGE
  }, [busy, world])

  // When the herd goes away (the player switched creature), nobody is nearby or hunting any more.
  useEffect(
    () => () => {
      live.current.onNearby(null)
      live.current.onHunted(null)
      live.current.onDanger(0)
    },
    [],
  )

  // Each animal can be challenged once. Afterwards it loses interest and wanders off.
  function begin(animal, forced) {
    animal.spent = true
    animal.fighting = true
    animal.chasing = false
    animal.pause = 0.4
    world.rival.current = animal
    world.busy.current = true
    live.current.onChallenge(animal.creature, forced, world.place.current?.type ?? null)
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

  useFrame((state) => {
    const player = world.position
    const { creatures: all, playerId: me, populations: counts } = live.current
    const now = state.clock.elapsedTime
    const calm =
      world.busy.current || performance.now() / 1000 < world.calm.current

    // Who is close enough to challenge? Who is chasing, and has a chaser caught up?
    let closest = null
    let closestDistance = CHALLENGE_RANGE
    let chaser = null
    let chaserDistance = Infinity
    for (const animal of animals) {
      if (animal.spent) continue
      const distance = Math.hypot(animal.x - player.x, animal.z - player.z)
      if (distance < closestDistance) {
        closest = animal
        closestDistance = distance
      }
      if (animal.chasing && distance < chaserDistance) {
        chaser = animal
        chaserDistance = distance
      }
    }
    if (chaser && !calm && chaserDistance < CATCH_RANGE) {
      if (world.armor.current > 0) {
        // Armor: the catch glances off, and the hunter thinks better of it for a while.
        world.armor.current -= 1
        chaser.chasing = false
        chaser.restUntil = now + ARMOR_REST
        chaser.pause = 2
        world.calm.current = performance.now() / 1000 + 4
        live.current.onArmor(chaser.creature)
      } else {
        if (closest === chaser) closest = null
        begin(chaser, true)
      }
      chaser = null
    }
    if (closest !== nearest.current) {
      nearest.current = closest
      live.current.onNearby(closest ? closest.creature : null)
    }
    if (chaser !== hunter.current) {
      hunter.current = chaser
      live.current.onHunted(chaser ? chaser.creature : null)
      if (!chaser) live.current.onDanger(0)
    }
    if (chaser) {
      live.current.onDanger(dangerLevel(chaserDistance))
    }

    // Games between two animals end on time, or early if either gets pulled away.
    bouts.current = bouts.current.filter((bout) => {
      const { a, b } = bout
      const over =
        now > bout.until ||
        a.chasing || b.chasing || a.fighting || b.fighting ||
        !animals.includes(a) || !animals.includes(b)
      if (over) {
        a.bout = null
        b.bout = null
        a.pause = between(1, 3)
        b.pause = between(1, 3)
        return false
      }
      return true
    })

    // A few times a second: drop animals left far behind, and bring in a new one if the herd is short.
    const pace = timing.current
    if (now < pace.nextCheck) return
    pace.nextCheck = now + (pace.filled ? 0.5 : 0.05)

    // Sometimes two idle animals of different species near each other start a game.
    if (bouts.current.length === 0 && pace.filled && Math.random() < 0.25) {
      const idle = animals.filter(
        (animal) =>
          !animal.spent && !animal.chasing && !animal.fighting && !animal.bout &&
          Math.hypot(animal.x - player.x, animal.z - player.z) < 45,
      )
      search: for (const a of idle) {
        for (const b of idle) {
          if (a === b || a.creature.id === b.creature.id) continue
          if (Math.hypot(a.x - b.x, a.z - b.z) > 18) continue
          a.bout = b
          b.bout = a
          bouts.current.push({ a, b, until: now + BOUT_SECONDS })
          break search
        }
      }
    }

    const sight = world.terrain.fogFar
    // Animals of a species that has died out or been eliminated go too.
    const kept = animals.filter(
      (animal) =>
        populationOf(counts, animal.creature.id) > 0 &&
        (!animal.follower || world.power.current === 'pack') &&
        Math.hypot(animal.x - player.x, animal.z - player.z) < VANISH_AT * sight,
    )
    let next = kept.length === animals.length ? animals : kept

    // Pack: a couple of the player's own kind travel with them.
    const mine = all.find((creature) => creature.id === me)
    const pack = kept.filter((animal) => animal.follower).length
    if (world.power.current === 'pack' && mine && pack < PACK_SIZE) {
      const angle = between(0, Math.PI * 2)
      next = [
        ...kept,
        {
          key: pace.nextKey,
          creature: mine,
          x: player.x + Math.cos(angle) * 6,
          z: player.z + Math.sin(angle) * 6,
          heading: between(0, Math.PI * 2),
          speed: 2,
          chaseSpeed: 4.5 + (Number(mine.agility) || 3) * 0.8,
          aggression: 0,
          chasing: false,
          shaken: 0,
          chaseUntil: 0,
          restUntil: 0,
          bout: null,
          pause: 0,
          patience: 0,
          targetX: player.x,
          targetZ: player.z,
          stride: 0,
          seed: between(0, 10),
          walking: false,
          fighting: false,
          spent: true, // cannot be challenged
          follower: true,
        },
      ]
      pace.nextKey += 1
      setAnimals(next)
      return
    }

    if (kept.length - pack >= HERD_SIZE) {
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
            chaseSpeed: 3.6 + (Number(creature.agility) || 3) * 0.75,
            aggression: aggressionOf(creature),
            chasing: false,
            shaken: 0,
            chaseUntil: 0,
            restUntil: now + between(2, 6),
            bout: null,
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
    <Animal
      key={animal.key}
      animal={animal}
      world={world}
    />
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
  onHunted,
  onDanger,
  onArmor,
  onEat,
  onPlace,
  onStep,
  power,
  armor,
}) {
  const { scene, gl } = useThree()
  const keys = useMoveKeys()
  const herd = useRef([])
  const busyRef = useRef(false) // true while a challenge is being played
  const rival = useRef(null) // the animal being challenged
  const calm = useRef(0) // nobody chases or catches the player before this time (seconds)
  const place = useRef(null) // the place the player is standing in, if any
  const events = useRef({ onEat, onPlace, onStep })
  const powerRef = useRef(power) // the player's power-up: 'armor', 'reserves', 'pack' or 'camouflage'
  const armorRef = useRef(armor) // catches the player's armor can still turn away this round
  useEffect(() => {
    events.current = { onEat, onPlace, onStep }
    powerRef.current = power
    armorRef.current = armor
  })
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
    () => ({
      keys,
      herd,
      position,
      terrain,
      models,
      busy: busyRef,
      rival,
      calm,
      place,
      events,
      power: powerRef,
      armor: armorRef,
    }),
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
        onHunted={onHunted}
        onDanger={onDanger}
        onArmor={onArmor}
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
  ...rest // the on... callbacks, passed straight through
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
          {...rest}
        />
      </Suspense>
    </Canvas>
  )
}
