// Things to find in the world, shared by every terrain.
//
// Places decide the game: a challenge that happens at one is always that place's game.
//   carcass        -> Food Sharing
//   watering hole  -> Territory
//   tall grass     -> Ambush
//   stag herd      -> Pack Hunting
// Berry bushes are food: walk into one to eat it.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PLACES = {
  carcass: { name: 'a carcass', game: 'food', radius: 7 },
  waterhole: { name: 'a watering hole', game: 'territory', radius: 9 },
  tallgrass: { name: 'tall grass', game: 'ambush', radius: 8 },
  herd: { name: 'a stag herd', game: 'pack', radius: 9 },
}
const PLACE_TYPES = Object.keys(PLACES)
const PLACE_CHANCE = 0.3 // share of chunks that hold a place
const BUSH_CHANCE = 0.4 // share of chunks that hold a berry bush
const TALL_BLADES = 420

const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, envMapIntensity: 0.2, ...extra })

/** Shapes and materials for places and food, built once per world. */
export function createPlaceKit() {
  const mats = {
    flesh: std(0x6b2f25),
    bone: std(0xe9e2d2, { roughness: 0.7 }),
    mud: std(0x6a543a),
    pond: std(0x3f7f93, { roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.85 }),
    reed: std(0xffffff, { side: THREE.DoubleSide }),
    hide: std(0x9a7448),
    bush: std(0x3f6a2c, { flatShading: true }),
    berry: std(0xc8283a, { roughness: 0.5 }),
  }
  const moved = (geo, x, y, z) => geo.translate(x, y, z)
  const merge = (parts) => {
    const merged = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)))
    parts.forEach((part) => part.dispose())
    return merged
  }

  // carcass: a slumped body with a row of ribs standing out of it
  const bodyGeo = new THREE.SphereGeometry(1, 12, 8).scale(1.7, 0.45, 0.95).translate(0, 0.3, 0)
  const ribsGeo = merge(
    [-0.9, -0.45, 0, 0.45, 0.9].map((x, i) =>
      moved(new THREE.TorusGeometry(0.62 - Math.abs(i - 2) * 0.07, 0.05, 5, 10, Math.PI).rotateY(Math.PI / 2), x, 0.35, 0),
    ).concat(moved(new THREE.SphereGeometry(0.3, 8, 6).scale(1.5, 0.9, 0.9), 2, 0.3, 0.1)),
  )

  // watering hole: a muddy rim around still water
  const rimGeo = new THREE.CircleGeometry(5.6, 28).rotateX(-Math.PI / 2)
  const pondGeo = new THREE.CircleGeometry(4.3, 28).rotateX(-Math.PI / 2)

  // tall grass: one long blade, used hundreds of times
  const tallGeo = new THREE.ConeGeometry(0.05, 1, 3).translate(0, 0.5, 0)

  // stag: body, legs, neck, head and a pair of antlers, facing +X
  const box = (w, h, d, x, y, z) => moved(new THREE.BoxGeometry(w, h, d), x, y, z)
  const stagGeo = merge([
    box(1.5, 0.7, 0.55, 0, 1.25, 0),
    box(0.14, 0.95, 0.14, 0.55, 0.47, 0.18),
    box(0.14, 0.95, 0.14, 0.55, 0.47, -0.18),
    box(0.14, 0.95, 0.14, -0.55, 0.47, 0.18),
    box(0.14, 0.95, 0.14, -0.55, 0.47, -0.18),
    moved(new THREE.BoxGeometry(0.3, 0.8, 0.3).rotateZ(-0.6), 0.9, 1.75, 0),
    box(0.55, 0.3, 0.3, 1.3, 2.1, 0),
  ])
  const antlerGeo = merge([
    moved(new THREE.ConeGeometry(0.04, 0.8, 5).rotateX(0.5), 1.15, 2.6, 0.22),
    moved(new THREE.ConeGeometry(0.04, 0.8, 5).rotateX(-0.5), 1.15, 2.6, -0.22),
    moved(new THREE.ConeGeometry(0.03, 0.4, 5).rotateZ(-0.9), 1.3, 2.75, 0.3),
    moved(new THREE.ConeGeometry(0.03, 0.4, 5).rotateZ(-0.9), 1.3, 2.75, -0.3),
  ])

  // berry bush: a lump of leaves studded with berries
  const bushGeo = new THREE.IcosahedronGeometry(0.75, 1).scale(1, 0.8, 1).translate(0, 0.55, 0)
  const berriesGeo = merge(
    Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4
      const up = 0.35 + (i % 3) * 0.28
      return moved(new THREE.IcosahedronGeometry(0.11, 0), Math.cos(a) * 0.68, up, Math.sin(a) * 0.68)
    }),
  )

  const geos = [bodyGeo, ribsGeo, rimGeo, pondGeo, tallGeo, stagGeo, antlerGeo, bushGeo, berriesGeo]
  const mesh = (geo, mat, shadow = true) => {
    const made = new THREE.Mesh(geo, mat)
    made.castShadow = shadow
    made.receiveShadow = true
    return made
  }
  const tmp = new THREE.Color()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()

  /**
   * Add this chunk's place and food, if it has any. `cr` is the chunk's own random range function,
   * so the same chunk always gets the same things. `clear(x, z)` says whether a spot is usable
   * (not water, not a cliff). Returns { places, foods, dispose }.
   */
  function populate(chunk, { cx, cz, x0, z0, size, cr, groundHeight, clear }) {
    const places = []
    const foods = []
    const owned = []
    const nearStart = (x, z, gap) => Math.hypot(x, z) < gap

    if (cr(0, 1) < PLACE_CHANCE) {
      const type = PLACE_TYPES[Math.floor(cr(0, PLACE_TYPES.length))]
      const x = x0 + cr(11, size - 11)
      const z = z0 + cr(11, size - 11)
      const y = groundHeight(x, z)
      // only on ground that is clear and fairly level, so a pond does not hang off a slope
      const level = [[4, 0], [-4, 0], [0, 4], [0, -4]].every(
        ([dx, dz]) => clear(x + dx, z + dz) && Math.abs(groundHeight(x + dx, z + dz) - y) < 0.55,
      )
      if (level && clear(x, z) && !nearStart(x, z, 14)) {
        const spot = new THREE.Group()
        spot.position.set(x, y, z)
        spot.rotation.y = cr(0, 6.28)
        if (type === 'carcass') {
          spot.add(mesh(bodyGeo, mats.flesh), mesh(ribsGeo, mats.bone))
        } else if (type === 'waterhole') {
          const rim = mesh(rimGeo, mats.mud, false)
          rim.position.y = 0.1
          const pond = mesh(pondGeo, mats.pond, false)
          pond.position.y = 0.16
          spot.add(rim, pond)
        } else if (type === 'herd') {
          for (let k = 0; k < 4; k += 1) {
            const a = (k / 4) * 6.28 + cr(-0.5, 0.5)
            const out = cr(2, 4.5)
            const stag = new THREE.Group()
            stag.add(mesh(stagGeo, mats.hide), mesh(antlerGeo, mats.bone))
            const sx = Math.cos(a) * out
            const sz = Math.sin(a) * out
            // each stag stands on the ground under it; undo the group's turn to find that spot
            const cos = Math.cos(spot.rotation.y)
            const sin = Math.sin(spot.rotation.y)
            stag.position.set(sx, groundHeight(x + sx * cos + sz * sin, z - sx * sin + sz * cos) - y, sz)
            stag.rotation.y = cr(0, 6.28)
            stag.scale.setScalar(cr(0.85, 1.1))
            spot.add(stag)
          }
        } else {
          // tall grass: placed in world space so every blade meets the ground
          spot.rotation.y = 0
          const blades = new THREE.InstancedMesh(tallGeo, mats.reed, TALL_BLADES)
          for (let i = 0; i < TALL_BLADES; i += 1) {
            const a = cr(0, 6.28)
            const out = Math.sqrt(cr(0, 1)) * 6.5
            const bx = Math.cos(a) * out
            const bz = Math.sin(a) * out
            e.set(cr(-0.2, 0.2), cr(0, 6.28), cr(-0.2, 0.2))
            q.setFromEuler(e)
            m.compose(
              new THREE.Vector3(bx, groundHeight(x + bx, z + bz) - y - 0.05, bz),
              q,
              new THREE.Vector3(1.6, cr(1.7, 3), 1.6),
            )
            blades.setMatrixAt(i, m)
            blades.setColorAt(i, tmp.setHSL(cr(0.13, 0.22), cr(0.45, 0.65), cr(0.34, 0.5)))
          }
          blades.receiveShadow = true
          blades.computeBoundingSphere()
          spot.add(blades)
          owned.push(blades)
        }
        chunk.add(spot)
        places.push({ type, x, z, radius: PLACES[type].radius })
      }
    }

    if (cr(0, 1) < BUSH_CHANCE) {
      const x = x0 + cr(3, size - 3)
      const z = z0 + cr(3, size - 3)
      if (clear(x, z) && !nearStart(x, z, 6)) {
        const bush = new THREE.Group()
        const berries = mesh(berriesGeo, mats.berry)
        bush.add(mesh(bushGeo, mats.bush), berries)
        bush.position.set(x, groundHeight(x, z) - 0.05, z)
        bush.rotation.y = cr(0, 6.28)
        bush.scale.setScalar(cr(0.9, 1.3))
        chunk.add(bush)
        foods.push({
          key: `${cx},${cz}`,
          x,
          z,
          /** Picked clean: the bush stays, the berries go. */
          strip() {
            berries.visible = false
          },
        })
      }
    }

    return {
      places,
      foods,
      dispose() {
        for (const made of owned) made.dispose()
      },
    }
  }

  return {
    populate,
    dispose() {
      geos.forEach((geo) => geo.dispose())
      Object.values(mats).forEach((mat) => mat.dispose())
    },
  }
}
