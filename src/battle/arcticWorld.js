// The arctic: an endless snowfield at dusk. Drifts of deep snow slow you down, frozen lakes send
// you sliding, pines and shards of ice break up the white, snow falls, an aurora hangs to the north,
// and every so often a blizzard closes in and cuts how far anyone can see. It is cold: hunger bites
// faster here (see HUNGER_BY_TERRAIN in challenge.js).
//
// Same interface as the other terrains, plus pace(), slippery() and visibility().
import * as THREE from 'three'
import { V3, makeRng, canvasTexture, fbm, smoothstep, skyDome, sunRig } from '../creaturesupdate/kit.js'
import { createChunks } from './chunks.js'
import { createPlaceKit } from './places.js'
import { chunkSeed, groundGeometry, lumpyGeometry, scatter } from './terrainKit.js'

const FOG_FAR = 85
const CHUNK = 48
const CELLS = 32
const LOAD_RADIUS = FOG_FAR + CHUNK * 0.75
const ICE_LEVEL = -0.25 // frozen lakes lie flat at this height
const DEEP_SNOW_PACE = 0.7 // walking speed in a drift of deep snow
const FLAKES = 900
const SNOW_BOX = 56 // snow falls in a box this wide around the player
const SNOW_TOP = 24
const BLIZZARD_EVERY = 75 // seconds from the start of one blizzard to the start of the next
const BLIZZARD_LASTS = 22

/* Lakes: broad patches picked out by slow noise, never right where the player starts. */
const lake = (x, z) =>
  smoothstep(0.56, 0.61, fbm(x * 0.007 + 90, z * 0.007 + 13, 3)) * smoothstep(22, 55, Math.hypot(x, z))
const deepSnow = (x, z) => fbm(x * 0.09 + 33, z * 0.09 + 5, 2) > 0.66 && lake(x, z) < 0.2

function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  let h = (fbm(x * 0.04 + 5, z * 0.04 + 8, 4) - 0.45) * 3.4 * smoothstep(7, 26, r)
  h += (fbm(x * 0.011, z * 0.011 + 70, 3) - 0.5) * 9 * smoothstep(40, 120, r)
  const frozen = lake(x, z)
  return h * (1 - frozen) + ICE_LEVEL * frozen
}

export function createArcticWorld() {
  const rnd = makeRng(7719)
  const rr = rnd.range
  const group = new THREE.Group()
  group.name = 'arctic-world'
  const sunDirection = new V3(7, 5, -4).normalize() // low in the sky

  const sky = skyDome(
    [[0, '#0d1838'], [0.28, '#243f73'], [0.44, '#7f9cc4'], [0.5, '#c9d6e6'], [0.53, '#aebdd0'], [1, '#7f8fa6']],
    320,
  )
  group.add(sky)
  group.add(
    sunRig({
      direction: sunDirection,
      sunColor: 0xffe2c2,
      sunIntensity: 4.2,
      skyColor: 0xcfdcf5,
      groundColor: 0x9fb2cc,
      skyIntensity: 1.5,
      rimColor: 0x9fc0ff,
      rimIntensity: 1.2,
    }),
  )

  const grain = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#f4f4f4'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 5000; i += 1) {
      const v = Math.floor(rr(205, 255))
      g.fillStyle = `rgba(${v},${v},${v},.5)`
      g.fillRect(rr(0, 256), rr(0, 256), rr(1, 2.5), rr(1, 2.5))
    }
  })
  grain.wrapS = THREE.RepeatWrapping
  grain.wrapT = THREE.RepeatWrapping
  const mats = {
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.85, envMapIntensity: 0.35 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 0.95, envMapIntensity: 0.2 }),
    needle: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.9, flatShading: true, envMapIntensity: 0.2 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.9, flatShading: true, envMapIntensity: 0.3 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xa8d8ee, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.86, flatShading: true }),
    tuft: new THREE.MeshStandardMaterial({ color: 0xb8a67a, roughness: 0.9, envMapIntensity: 0.2 }),
    flake: new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }),
    aurora: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6).translate(0, 0.5, 0)
  const tierGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0)
  const shardGeo = new THREE.OctahedronGeometry(1, 0).scale(0.45, 1, 0.45).translate(0, 0.8, 0)
  const moundGeos = [lumpyGeometry(1, 2, 0.35), lumpyGeometry(2, 2, 0.35)]
  const tuftGeo = new THREE.ConeGeometry(0.02, 1, 3).translate(0, 0.5, 0)
  const placeKit = createPlaceKit()

  const snowLight = new THREE.Color(0xf4f7fb)
  const snowShade = new THREE.Color(0xdbe6f1)
  const iceLight = new THREE.Color(0xb5dcee)
  const iceDeep = new THREE.Color(0x86bdd8)
  const tmp = new THREE.Color()

  function buildChunk(cx, cz) {
    const cr = makeRng(chunkSeed(cx, cz, 0x51c3a7e)).range
    const x0 = cx * CHUNK
    const z0 = cz * CHUNK
    const chunk = new THREE.Group()
    const obstacles = []
    const owned = []
    const keep = (mesh) => mesh && owned.push(mesh)

    const groundGeo = groundGeometry({
      x0,
      z0,
      size: CHUNK,
      cells: CELLS,
      height: groundHeight,
      paint(x, z, h, color) {
        color.copy(snowLight).lerp(snowShade, smoothstep(0.35, 0.7, fbm(x * 0.08, z * 0.08 + 20, 3)))
        tmp.copy(iceLight).lerp(iceDeep, smoothstep(0.3, 0.7, fbm(x * 0.05 + 9, z * 0.05, 2)))
        color.lerp(tmp, lake(x, z))
      },
    })
    const ground = new THREE.Mesh(groundGeo, mats.ground)
    ground.receiveShadow = true
    chunk.add(ground)

    const onLand = (x, z) => lake(x, z) < 0.05

    // dry grass poking through the snow
    keep(
      scatter(chunk, tuftGeo, mats.tuft, 260, (put) => {
        for (let i = 0; i < 260; i += 1) {
          const x = x0 + cr(0, CHUNK)
          const z = z0 + cr(0, CHUNK)
          if (!onLand(x, z)) continue
          put(x, groundHeight(x, z) - 0.05, z, cr(-0.3, 0.3), cr(0, 6.28), cr(-0.3, 0.3), 1.5, cr(0.25, 0.6), 1.5)
        }
      }),
    )

    // pines: a trunk, three tiers of needles, and a cap of snow on each tier
    const pines = []
    const pineCount = Math.floor(cr(0, 4.6))
    for (let k = 0; k < pineCount; k += 1) {
      const x = x0 + cr(2, CHUNK - 2)
      const z = z0 + cr(2, CHUNK - 2)
      if (!onLand(x, z) || Math.hypot(x, z) < 8) continue
      pines.push({ x, z, y: groundHeight(x, z), tall: cr(5, 9), wide: cr(1.5, 2.3) })
      obstacles.push({ x, z, r: 0.7 })
    }
    keep(
      scatter(chunk, trunkGeo, mats.bark, pines.length, (put) => {
        for (const p of pines) put(p.x, p.y - 0.2, p.z, 0, 0, 0, 1.3, p.tall * 0.4, 1.3)
      }, { shadow: true }),
    )
    const tiers = (put, snowy) => {
      for (const p of pines) {
        for (let t = 0; t < 3; t += 1) {
          const base = p.y + p.tall * (0.22 + t * 0.24)
          const wide = p.wide * (1 - t * 0.27)
          const tall = p.tall * 0.36
          if (snowy) put(p.x, base + tall * 0.42, p.z, 0, t, 0, wide * 0.62, tall * 0.6, wide * 0.62)
          else put(p.x, base, p.z, 0, t, 0, wide, tall, wide)
        }
      }
    }
    keep(scatter(chunk, tierGeo, mats.needle, pines.length * 3, (put) => tiers(put, false), { shadow: true }))
    keep(scatter(chunk, tierGeo, mats.snow, pines.length * 3, (put) => tiers(put, true)))

    // shards of ice standing in clusters, and rounded mounds of snow
    const shards = []
    if (cr(0, 1) < 0.5) {
      const x = x0 + cr(6, CHUNK - 6)
      const z = z0 + cr(6, CHUNK - 6)
      if (Math.hypot(x, z) > 10) {
        const count = 3 + Math.floor(cr(0, 4))
        for (let k = 0; k < count; k += 1) {
          const sx = x + cr(-2.4, 2.4)
          const sz = z + cr(-2.4, 2.4)
          shards.push({ x: sx, z: sz, y: groundHeight(sx, sz), tall: cr(1.6, 4.6), lean: cr(-0.25, 0.25) })
        }
        obstacles.push({ x, z, r: 2.6 })
      }
    }
    keep(
      scatter(chunk, shardGeo, mats.ice, shards.length, (put) => {
        for (const s of shards) put(s.x, s.y - 0.3, s.z, s.lean, cr(0, 6.28), s.lean, s.tall * 0.55, s.tall, s.tall * 0.55)
      }, { shadow: true }),
    )
    const moundCount = Math.floor(cr(0, 3.5))
    for (let k = 0; k < moundCount; k += 1) {
      const x = x0 + cr(0, CHUNK)
      const z = z0 + cr(0, CHUNK)
      const s = cr(0.7, 2)
      if (!onLand(x, z) || Math.hypot(x, z) < s * 1.3 + 4) continue
      const mound = new THREE.Mesh(moundGeos[k % moundGeos.length], mats.snow)
      mound.position.set(x, groundHeight(x, z) + s * 0.1, z)
      mound.scale.set(s * 1.4, s * 0.6, s * 1.1)
      mound.rotation.y = cr(0, 6.28)
      mound.castShadow = true
      mound.receiveShadow = true
      chunk.add(mound)
      obstacles.push({ x, z, r: s * 1.1 })
    }

    const found = placeKit.populate(chunk, { cx, cz, x0, z0, size: CHUNK, cr, groundHeight, clear: onLand })
    return {
      group: chunk,
      obstacles,
      places: found.places,
      foods: found.foods,
      dispose() {
        groundGeo.dispose()
        owned.forEach((mesh) => mesh.dispose())
        found.dispose()
      },
    }
  }

  const chunks = createChunks({ parent: group, size: CHUNK, loadRadius: LOAD_RADIUS, build: buildChunk })

  /* falling snow: a box of flakes that travels with the player */
  const flakeBase = new Float32Array(FLAKES * 3)
  for (let i = 0; i < FLAKES; i += 1) {
    flakeBase[i * 3] = rr(-SNOW_BOX / 2, SNOW_BOX / 2)
    flakeBase[i * 3 + 1] = rr(0, SNOW_TOP)
    flakeBase[i * 3 + 2] = rr(-SNOW_BOX / 2, SNOW_BOX / 2)
  }
  const flakeGeo = new THREE.BufferGeometry()
  flakeGeo.setAttribute('position', new THREE.Float32BufferAttribute(flakeBase.slice(), 3))
  const flakes = new THREE.Points(flakeGeo, mats.flake)
  flakes.frustumCulled = false
  group.add(flakes)

  /* aurora: three pale curtains high to the north */
  const curtains = [0, 1, 2].map((k) => {
    const geo = new THREE.PlaneGeometry(300, 46, 60, 4)
    const p = geo.attributes.position
    const tint = []
    const green = new THREE.Color(0x4dffb0)
    const violet = new THREE.Color(0x9a6bff)
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i)
      const up = p.getY(i) / 46 + 0.5
      p.setZ(i, Math.sin(x * 0.03 + k * 2) * 16 + Math.sin(x * 0.011 + k) * 22)
      tmp.copy(green).lerp(violet, up).multiplyScalar(Math.sin(up * Math.PI) * (0.6 + 0.4 * Math.sin(x * 0.07 + k)))
      tint.push(tmp.r, tmp.g, tmp.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3))
    const curtain = new THREE.Mesh(geo, mats.aurora)
    curtain.frustumCulled = false
    group.add(curtain)
    return curtain
  })

  const fog = new THREE.Fog(0xc4d0e0, 18, FOG_FAR)
  let storm = 0 // 0 clear, 1 the thick of a blizzard

  function update(px, pz) {
    sky.position.set(px, 0, pz)
    flakes.position.set(px, groundHeight(px, pz) - 1, pz)
    curtains.forEach((curtain, k) => curtain.position.set(px + (k - 1) * 60, 95 + k * 14, pz - 210 - k * 25))
    chunks.update(px, pz)
  }

  function animate(t) {
    // a blizzard builds, holds and clears
    const into = t % BLIZZARD_EVERY
    storm = smoothstep(0, 5, into - (BLIZZARD_EVERY - BLIZZARD_LASTS)) * (1 - smoothstep(BLIZZARD_EVERY - 4, BLIZZARD_EVERY, into))
    fog.near = 18 - 14 * storm
    fog.far = FOG_FAR - (FOG_FAR - 24) * storm
    mats.flake.opacity = 0.85
    mats.flake.size = 0.22 + 0.2 * storm

    const p = flakeGeo.attributes.position
    const fall = 1.6 + 5 * storm
    const drift = 0.6 + 7 * storm
    for (let i = 0; i < FLAKES; i += 1) {
      const speed = fall * (0.7 + (i % 7) * 0.09)
      const y = (((flakeBase[i * 3 + 1] - t * speed) % SNOW_TOP) + SNOW_TOP) % SNOW_TOP
      const x = ((((flakeBase[i * 3] + t * drift + Math.sin(t * 0.7 + i) * 0.5 + SNOW_BOX / 2) % SNOW_BOX) + SNOW_BOX) % SNOW_BOX) - SNOW_BOX / 2
      p.setXYZ(i, x, y, flakeBase[i * 3 + 2])
    }
    p.needsUpdate = true
    curtains.forEach((curtain, k) => {
      curtain.rotation.y = Math.sin(t * 0.05 + k) * 0.08
      mats.aurora.opacity = 0.34 + 0.1 * Math.sin(t * 0.3) - 0.3 * storm
    })
  }

  function dispose() {
    chunks.clear()
    placeKit.dispose()
    for (const geo of [trunkGeo, tierGeo, shardGeo, tuftGeo, flakeGeo, ...moundGeos, sky.geometry, ...curtains.map((c) => c.geometry)]) geo.dispose()
    for (const mat of [...Object.values(mats), sky.material]) {
      mat.map?.dispose()
      mat.dispose()
    }
  }

  return {
    kind: 'arctic',
    group,
    sky,
    sunDirection,
    fog,
    fogFar: FOG_FAR,
    groundHeight,
    inWater: () => false,
    /** Walking speed here, as a share of normal: deep snow is slow going. */
    pace: (x, z) => (deepSnow(x, z) ? DEEP_SNOW_PACE : 1),
    /** True on a frozen lake, where you keep sliding. */
    slippery: (x, z) => lake(x, z) > 0.6,
    /** How far animals can see right now, as a share of normal: a blizzard hides you. */
    visibility: () => 1 - 0.7 * storm,
    update,
    animate,
    collide: chunks.collide,
    placeAt: chunks.placeAt,
    eatAt: chunks.eatAt,
    dispose,
    chunkCount: chunks.count,
  }
}
