// The wetland: an endless marsh under an overcast sky. Most of it is shallow water you have to wade,
// broken by low islands. Reed beds stand thick along the shallows and hide whoever is inside them,
// mangroves stand on stilt roots, and lily pads dot the open water.
//
// Same interface as the other terrains, plus pace() and cover().
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { V3, makeRng, canvasTexture, fbm, smoothstep, skyDome, sunRig } from '../creaturesupdate/kit.js'
import { createChunks } from './chunks.js'
import { createPlaceKit } from './places.js'
import { chunkSeed, groundGeometry, lumpyGeometry, scatter } from './terrainKit.js'

const FOG_FAR = 66
const CHUNK = 48
const CELLS = 32
const LOAD_RADIUS = FOG_FAR + CHUNK * 0.75
const WADE_DEPTH = 0.75 // the water is never deeper than this, so all of it can be waded
const WADING_PACE = 0.6
const REEDS_PER_CHUNK = 1500
const PADS_PER_CHUNK = 70
const GRASS_PER_CHUNK = 900

/** Islands where this is above zero, water where it is below. The player starts on an island. */
function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  const land = (fbm(x * 0.035 + 11, z * 0.035 + 4, 4) - 0.52) * 4.2
  const h = 0.5 + (land - 0.5) * smoothstep(6, 22, r)
  return Math.max(h, -WADE_DEPTH)
}
const inWater = (x, z) => groundHeight(x, z) < -0.12
/** Reed beds: thick stands along the shallows. Standing in one hides you. */
function inReeds(x, z) {
  const h = groundHeight(x, z)
  return h > -0.6 && h < 0.25 && fbm(x * 0.06 + 70, z * 0.06 + 31, 3) > 0.6 && Math.hypot(x, z) > 9
}

export function createWetlandWorld() {
  const rnd = makeRng(3391)
  const rr = rnd.range
  const group = new THREE.Group()
  group.name = 'wetland-world'
  const sunDirection = new V3(4, 10, 6).normalize()

  const sky = skyDome(
    [[0, '#7f95a3'], [0.3, '#a6b6bd'], [0.46, '#c3ccc6'], [0.5, '#b4bfae'], [0.54, '#8a977e'], [1, '#5c6850']],
    320,
  )
  group.add(sky)
  group.add(
    sunRig({
      direction: sunDirection,
      sunColor: 0xf3ecd8,
      sunIntensity: 3.6,
      skyColor: 0xd5dfd8,
      groundColor: 0x55633f,
      skyIntensity: 1.5,
      rimColor: 0xc9d8cf,
      rimIntensity: 0.9,
    }),
  )

  const silt = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#dedede'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 8000; i += 1) {
      const v = Math.floor(rr(130, 255))
      g.fillStyle = `rgba(${v},${v},${v},.55)`
      g.fillRect(rr(0, 256), rr(0, 256), rr(1, 3), rr(1, 3))
    }
  })
  silt.wrapS = THREE.RepeatWrapping
  silt.wrapT = THREE.RepeatWrapping
  const mats = {
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, map: silt, roughness: 1, envMapIntensity: 0.2 }),
    water: new THREE.MeshStandardMaterial({ color: 0x4f6f5a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.74, depthWrite: false }),
    plant: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.2 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5a4c3c, roughness: 0.95, envMapIntensity: 0.2 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, envMapIntensity: 0.2 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x6f7565, roughness: 0.95, flatShading: true, envMapIntensity: 0.2 }),
  }
  const reedGeo = new THREE.ConeGeometry(0.04, 1, 3).translate(0, 0.5, 0)
  const bladeGeo = new THREE.ConeGeometry(0.03, 1, 3).translate(0, 0.5, 0)
  const padGeo = new THREE.CircleGeometry(1, 10, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2)
  // mangrove: a trunk standing on a ring of arched stilt roots
  const mangroveGeo = (() => {
    const parts = [new THREE.CylinderGeometry(0.22, 0.3, 2.6, 7).translate(0, 2.5, 0)]
    for (let k = 0; k < 7; k += 1) {
      const root = new THREE.TorusGeometry(0.75, 0.07, 5, 8, Math.PI * 0.62)
      root.rotateZ(Math.PI * 0.4).translate(0.72, 0.62, 0).rotateY((k / 7) * Math.PI * 2 + (k % 2) * 0.25)
      parts.push(root)
    }
    const merged = mergeGeometries(parts.map((part) => part.toNonIndexed()))
    parts.forEach((part) => part.dispose())
    merged.computeVertexNormals()
    return merged
  })()
  const crownGeo = lumpyGeometry(3, 2, 0.4)
  const rockGeo = lumpyGeometry(5, 2, 0.5)
  const placeKit = createPlaceKit()

  const marsh = new THREE.Color(0x66803c)
  const sedge = new THREE.Color(0x86904a)
  const mud = new THREE.Color(0x5b4b34)
  const bed = new THREE.Color(0x3a4530)
  const tmp = new THREE.Color()

  function buildChunk(cx, cz) {
    const cr = makeRng(chunkSeed(cx, cz, 0x3a9d11f)).range
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
        color.copy(marsh).lerp(sedge, smoothstep(0.4, 0.7, fbm(x * 0.07, z * 0.07 + 20, 3)))
        color.lerp(mud, 1 - smoothstep(0.02, 0.5, h))
        color.lerp(bed, 1 - smoothstep(-0.6, -0.1, h))
      },
    })
    const ground = new THREE.Mesh(groundGeo, mats.ground)
    ground.receiveShadow = true
    chunk.add(ground)

    // grass on the islands
    keep(
      scatter(chunk, bladeGeo, mats.plant, GRASS_PER_CHUNK, (put) => {
        for (let i = 0; i < GRASS_PER_CHUNK; i += 1) {
          const x = x0 + cr(0, CHUNK)
          const z = z0 + cr(0, CHUNK)
          const h = groundHeight(x, z)
          if (h < 0.08 || Math.hypot(x, z) < 1.5) continue
          tmp.setHSL(cr(0.2, 0.3), cr(0.4, 0.6), cr(0.25, 0.4))
          put(x, h - 0.03, z, cr(-0.3, 0.3), cr(0, 6.28), cr(-0.3, 0.3), 1.4, cr(0.25, 0.8), 1.4, tmp)
        }
      }),
    )
    // reed beds: tall and thick enough to stand inside
    keep(
      scatter(chunk, reedGeo, mats.plant, REEDS_PER_CHUNK, (put) => {
        for (let i = 0; i < REEDS_PER_CHUNK * 3 && i >= 0; i += 1) {
          const x = x0 + cr(0, CHUNK)
          const z = z0 + cr(0, CHUNK)
          if (!inReeds(x, z)) continue
          tmp.setHSL(cr(0.13, 0.24), cr(0.35, 0.55), cr(0.3, 0.45))
          put(x, Math.max(groundHeight(x, z), -0.75) - 0.05, z, cr(-0.12, 0.12), cr(0, 6.28), cr(-0.12, 0.12), 1.5, cr(2, 3.4), 1.5, tmp)
        }
      }),
    )
    // lily pads on open water
    keep(
      scatter(chunk, padGeo, mats.plant, PADS_PER_CHUNK, (put) => {
        for (let i = 0; i < PADS_PER_CHUNK; i += 1) {
          const x = x0 + cr(0, CHUNK)
          const z = z0 + cr(0, CHUNK)
          if (groundHeight(x, z) > -0.3 || inReeds(x, z)) continue
          const s = cr(0.25, 0.6)
          tmp.setHSL(cr(0.26, 0.34), cr(0.4, 0.6), cr(0.26, 0.38))
          put(x, 0.03, z, 0, cr(0, 6.28), 0, s, 1, s, tmp)
        }
      }),
    )

    // mangroves at the water's edge
    const trees = []
    const treeCount = 2 + Math.floor(cr(0, 4))
    for (let k = 0; k < treeCount; k += 1) {
      const x = x0 + cr(2, CHUNK - 2)
      const z = z0 + cr(2, CHUNK - 2)
      const h = groundHeight(x, z)
      if (h < -0.5 || h > 0.6 || Math.hypot(x, z) < 8) continue
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue
      trees.push({ x, z, y: h, s: cr(1.1, 1.8) })
      obstacles.push({ x, z, r: 1.2 })
    }
    keep(
      scatter(chunk, mangroveGeo, mats.bark, trees.length, (put) => {
        for (const t of trees) put(t.x, t.y - 0.15, t.z, 0, cr(0, 6.28), 0, t.s, t.s, t.s)
      }, { shadow: true }),
    )
    keep(
      scatter(chunk, crownGeo, mats.leaf, trees.length * 3, (put) => {
        for (const t of trees) {
          for (let b = 0; b < 3; b += 1) {
            const a = b * 2.1 + cr(0, 1)
            const out = b === 0 ? 0 : cr(1, 1.9) * t.s
            const s = cr(1.5, 2.3) * t.s
            tmp.setHSL(cr(0.24, 0.31), cr(0.35, 0.5), cr(0.22, 0.32))
            put(t.x + Math.cos(a) * out, t.y + (3.6 + cr(-0.3, 0.5)) * t.s, t.z + Math.sin(a) * out, 0, cr(0, 6.28), 0, s, s * 0.6, s, tmp)
          }
        }
      }, { shadow: true }),
    )

    // a few half-sunk rocks
    const rockCount = Math.floor(cr(0, 2.6))
    for (let k = 0; k < rockCount; k += 1) {
      const x = x0 + cr(0, CHUNK)
      const z = z0 + cr(0, CHUNK)
      const s = cr(0.5, 1.5)
      if (Math.hypot(x, z) < s * 1.3 + 4) continue
      const rock = new THREE.Mesh(rockGeo, mats.rock)
      rock.position.set(x, Math.max(groundHeight(x, z), -0.4) + s * 0.15, z)
      rock.scale.set(s * 1.3, s * 0.7, s)
      rock.rotation.y = cr(0, 6.28)
      rock.castShadow = true
      rock.receiveShadow = true
      chunk.add(rock)
      obstacles.push({ x, z, r: s * 1.15 })
    }

    const found = placeKit.populate(chunk, {
      cx,
      cz,
      x0,
      z0,
      size: CHUNK,
      cr,
      groundHeight,
      clear: (x, z) => groundHeight(x, z) > 0.15,
    })
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

  // one sheet of water at y = 0 that travels with the player
  const waterGeo = new THREE.PlaneGeometry(520, 520).rotateX(-Math.PI / 2)
  const water = new THREE.Mesh(waterGeo, mats.water)
  water.receiveShadow = true
  water.renderOrder = 1
  group.add(water)

  function update(px, pz) {
    sky.position.set(px, 0, pz)
    water.position.set(px, 0, pz)
    chunks.update(px, pz)
  }

  function dispose() {
    chunks.clear()
    placeKit.dispose()
    for (const geo of [reedGeo, bladeGeo, padGeo, mangroveGeo, crownGeo, rockGeo, waterGeo, sky.geometry]) geo.dispose()
    for (const mat of [...Object.values(mats), sky.material]) {
      mat.map?.dispose()
      mat.dispose()
    }
  }

  return {
    kind: 'wetland',
    group,
    sky,
    sunDirection,
    fog: new THREE.Fog(0xa9b5a2, 10, FOG_FAR),
    fogFar: FOG_FAR,
    groundHeight,
    inWater,
    /** Walking speed here, as a share of normal: wading is slow. */
    pace: (x, z) => (inWater(x, z) ? WADING_PACE : 1),
    /** True inside a reed bed, where nobody can see you. */
    cover: inReeds,
    update,
    animate() {},
    collide: chunks.collide,
    placeAt: chunks.placeAt,
    eatAt: chunks.eatAt,
    dispose,
    chunkCount: chunks.count,
  }
}
