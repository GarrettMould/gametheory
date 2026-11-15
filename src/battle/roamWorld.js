// The roaming world: an endless savanna. Streams cross it every so often, boulders are big enough to hide a
// creature, and acacias dot the plain. Built from the shared kit, so the creature library stays untouched.
//
// The land is made in square chunks around the player. Everything in a chunk comes from its grid position,
// so walking away and coming back finds the same rocks and trees.
//
//   const world = createRoamWorld()
//   world.group                   add to the scene
//   world.update(x, z)            call every frame with the player's position; loads and unloads chunks
//   world.animate(t)              call every frame with the time; moves anything that moves
//   world.collide(x, z, radius)   -> [x, z] pushed out of any tree or rock
//   world.groundHeight(x, z)      terrain height, including stream beds
//   world.inWater(x, z)           true where a creature would be wading
//   world.fogFar                  nothing is visible past this distance
import * as THREE from 'three'
import {
  V3,
  makeRng,
  canvasTexture,
  fbm,
  smoothstep,
  taperedTube,
  skyDome,
  sunRig,
  shadowed,
} from '../creaturesupdate/kit.js'
import { createChunks } from './chunks.js'

export const FOG_FAR = 90 // nothing is visible past this, so things can appear and vanish beyond it
const CHUNK = 48 // side of one square of land
const CELLS = 32 // ground quads along one side of a chunk
const LOAD_RADIUS = FOG_FAR + CHUNK * 0.75 // chunks whose centre is this close get built
const GRASS_PER_CHUNK = 2000
const WATER_LEVEL = -0.3
const STREAM_HALF = 3.2 // half the width of a stream
const STREAM_DEPTH = 0.75
const STREAM_GAP = 170 // streams run west to east, about this far apart going north or south
const STREAM_REACH = 170 // how far east and west of the player the water is drawn

/* Streams: number k wanders around z = 26 + k * STREAM_GAP, each with its own bends. */
const streamIndex = (z) => Math.round((z - 26) / STREAM_GAP)
const streamZ = (x, k) =>
  26 + k * STREAM_GAP + 15 * Math.sin(x * 0.033 + 0.6 + k * 1.7) + 6 * Math.sin(x * 0.081 + 2.1 + k * 2.9)
const streamSlope = (x, k) =>
  15 * 0.033 * Math.cos(x * 0.033 + 0.6 + k * 1.7) + 6 * 0.081 * Math.cos(x * 0.081 + 2.1 + k * 2.9)
/** Distance from a point to the middle of the nearest stream. */
export function streamDistance(x, z) {
  const k = streamIndex(z)
  return Math.abs(z - streamZ(x, k)) / Math.hypot(1, streamSlope(x, k))
}

/** True where a creature would be standing in the water. */
export const inStream = (x, z) => streamDistance(x, z) < STREAM_HALF

/** Flat where the player starts, rolling beyond that, with broad low hills and level stream banks. */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  const d = streamDistance(x, z)
  let h = (fbm(x * 0.045 + 3, z * 0.045, 4) - 0.45) * 2.6 * smoothstep(7, 26, r)
  h += (fbm(x * 0.012 + 50, z * 0.012 + 9, 3) - 0.5) * 7 * smoothstep(40, 120, r)
  h *= smoothstep(STREAM_HALF + 1, STREAM_HALF + 22, d)
  h -= STREAM_DEPTH * (1 - smoothstep(STREAM_HALF * 0.35, STREAM_HALF + 0.8, d))
  return h
}

const chunkSeed = (cx, cz) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x5bd1e995) | 0

export function createRoamWorld() {
  const rnd = makeRng(9021)
  const rr = rnd.range
  const group = new THREE.Group()
  group.name = 'roam-world'
  const sunDirection = new V3(6, 11, 4).normalize()

  const sky = skyDome(
    [[0, '#2a67ab'], [0.32, '#6ea5d6'], [0.46, '#c4dbe6'], [0.5, '#ece4c6'], [0.53, '#b9a777'], [1, '#6f6240']],
    320,
  )
  group.add(sky)
  group.add(
    sunRig({
      direction: sunDirection,
      sunColor: 0xfff0d6,
      sunIntensity: 6.6,
      skyColor: 0xcfe2f5,
      groundColor: 0x8a7446,
      skyIntensity: 1.1,
      rimColor: 0xbfd6ff,
      rimIntensity: 1.6,
    }),
  )

  /* materials and shapes shared by every chunk */
  const soil = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#e4e4e4'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 7000; i += 1) {
      const v = Math.floor(rr(140, 255))
      g.fillStyle = `rgba(${v},${v},${v},.55)`
      g.fillRect(rr(0, 256), rr(0, 256), rr(1, 2.4), rr(1, 2.4))
    }
  })
  soil.wrapS = THREE.RepeatWrapping
  soil.wrapT = THREE.RepeatWrapping
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: soil, roughness: 1, envMapIntensity: 0.2 })
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, envMapIntensity: 0.2 })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3f7f93,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  })
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.2 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f6b2e, roughness: 0.95, flatShading: true, envMapIntensity: 0.2 })
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x857a6a, roughness: 0.95, flatShading: true, envMapIntensity: 0.2 })

  const bladeGeo = new THREE.ConeGeometry(0.022, 1, 3)
  bladeGeo.translate(0, 0.5, 0)

  const blobGeo = new THREE.IcosahedronGeometry(1, 2)
  {
    const bp = blobGeo.attributes.position
    for (let i = 0; i < bp.count; i += 1) {
      const v = new V3().fromBufferAttribute(bp, i)
      v.multiplyScalar(0.86 + 0.28 * fbm(v.x * 2 + 5, v.y * 2 + v.z * 2, 2))
      bp.setXYZ(i, v.x, v.y, v.z)
    }
    blobGeo.computeVertexNormals()
  }
  /* acacia: bent trunk, spreading branches, flat-topped canopy. A few are built once and reused. */
  function buildAcacia(H, spread) {
    const t = new THREE.Group()
    const lean = new V3(rr(-0.8, 0.8), 0, rr(-0.8, 0.8))
    const top = new V3(lean.x, H * 0.62, lean.z)
    const trunk = new THREE.CatmullRomCurve3([new V3(0, -0.6, 0), new V3(lean.x * 0.25, H * 0.3, lean.z * 0.25), top])
    t.add(shadowed(new THREE.Mesh(taperedTube(trunk, 12, 10, (u) => 0.42 - 0.2 * u).geo, barkMat)))
    const n = 6 + Math.floor(rr(0, 3))
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * 6.28 + rr(-0.3, 0.3)
      const d = k === 0 ? 0 : rr(0.45, 1) * spread
      const c = new V3(top.x + Math.cos(a) * d, H + rr(-0.35, 0.3), top.z + Math.sin(a) * d)
      const mid = top.clone().lerp(c, 0.55)
      mid.y = top.y + (c.y - top.y) * 0.8
      t.add(shadowed(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([top, mid, c]), 8, 7, (u) => 0.17 - 0.11 * u).geo, barkMat)))
      const blob = new THREE.Mesh(blobGeo, leafMat)
      blob.position.copy(c)
      blob.rotation.y = rr(0, 6.28)
      const s = rr(0.55, 0.8) * spread
      blob.scale.set(s, rr(0.5, 0.75), s)
      t.add(shadowed(blob))
    }
    return t
  }
  const acacias = [0, 1, 2, 3].map(() => buildAcacia(rr(9, 11.5), rr(5, 6.2)))

  const rockGeos = [0, 1, 2, 3].map((k) => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i += 1) {
      const v = new V3().fromBufferAttribute(p, i)
      v.multiplyScalar(0.75 + 0.5 * fbm(v.x * 1.5 + k * 7.3, v.y * 1.5 + v.z * 1.5 + k * 3.1, 2))
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })

  const straw = new THREE.Color(0xc2a45c)
  const olive = new THREE.Color(0x8e8a45)
  const dirt = new THREE.Color(0x9b7648)
  const bank = new THREE.Color(0x76883f)
  const mud = new THREE.Color(0x6a5a3e)
  const tmp = new THREE.Color()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()

  function buildChunk(cx, cz) {
    const crnd = makeRng(chunkSeed(cx, cz))
    const cr = crnd.range
    const x0 = cx * CHUNK
    const z0 = cz * CHUNK
    const step = CHUNK / CELLS
    const chunk = new THREE.Group()
    const obstacles = []

    /* ground. Heights are sampled one row past each edge so the shading matches the neighbouring chunks. */
    const side = CELLS + 3
    const heights = new Float32Array(side * side)
    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        heights[j * side + i] = groundHeight(x0 + (i - 1) * step, z0 + (j - 1) * step)
      }
    }
    const positions = []
    const normals = []
    const colors = []
    const uvs = []
    for (let j = 0; j <= CELLS; j += 1) {
      for (let i = 0; i <= CELLS; i += 1) {
        const x = x0 + i * step
        const z = z0 + j * step
        const at = (j + 1) * side + (i + 1)
        positions.push(x, heights[at], z)
        const nx = heights[at - 1] - heights[at + 1]
        const nz = heights[at - side] - heights[at + side]
        const nl = Math.hypot(nx, 2 * step, nz)
        normals.push(nx / nl, (2 * step) / nl, nz / nl)
        uvs.push(x * 0.3, z * 0.3)
        const d = streamDistance(x, z)
        tmp.copy(straw).lerp(olive, smoothstep(0.42, 0.7, fbm(x * 0.06, z * 0.06 + 20, 3)))
        tmp.lerp(dirt, smoothstep(0.6, 0.78, fbm(x * 0.13 + 40, z * 0.13, 3)))
        tmp.lerp(bank, 0.75 * (1 - smoothstep(STREAM_HALF, STREAM_HALF + 9, d)))
        tmp.lerp(mud, 1 - smoothstep(STREAM_HALF * 0.5, STREAM_HALF + 0.6, d))
        colors.push(tmp.r, tmp.g, tmp.b)
      }
    }
    const index = []
    for (let j = 0; j < CELLS; j += 1) {
      for (let i = 0; i < CELLS; i += 1) {
        const a = j * (CELLS + 1) + i
        const b = a + CELLS + 1
        index.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
    const groundGeo = new THREE.BufferGeometry()
    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    groundGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    groundGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    groundGeo.setIndex(index)
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.receiveShadow = true
    chunk.add(ground)

    /* grass: dry on the plain, taller and greener along the banks, none in the water */
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_PER_CHUNK)
    let blades = 0
    for (let i = 0; i < GRASS_PER_CHUNK; i += 1) {
      const x = x0 + cr(0, CHUNK)
      const z = z0 + cr(0, CHUNK)
      const d = streamDistance(x, z)
      const r = Math.hypot(x, z)
      if (d < STREAM_HALF + 0.5 || r < 1.6) continue
      const clump = i % 5 === 0
      const lush = 1 - smoothstep(STREAM_HALF, STREAM_HALF + 8, d)
      const near = smoothstep(1.6, 6, r)
      e.set(cr(-0.28, 0.28), cr(0, 6.28), cr(-0.28, 0.28))
      q.setFromEuler(e)
      m.compose(
        new V3(x, groundHeight(x, z) - 0.03, z),
        q,
        new V3(clump ? 1.8 : 1, cr(0.2, 0.45) + near * cr(0.1, 0.7) + lush * cr(0.3, 0.9), clump ? 1.8 : 1),
      )
      grass.setMatrixAt(blades, m)
      tmp.setHSL(cr(0.105, 0.16) + lush * 0.08, cr(0.4, 0.6), cr(0.36, 0.56) - lush * 0.08)
      grass.setColorAt(blades, tmp)
      blades += 1
    }
    grass.count = blades
    grass.receiveShadow = true
    grass.computeBoundingSphere()
    chunk.add(grass)

    const clearOfStart = (x, z, gap) => Math.hypot(x, z) > gap

    /* trees */
    const treeCount = Math.floor(cr(0, 3.2))
    for (let k = 0; k < treeCount; k += 1) {
      const x = x0 + cr(3, CHUNK - 3)
      const z = z0 + cr(3, CHUNK - 3)
      if (streamDistance(x, z) < 6.5 || !clearOfStart(x, z, 9)) continue
      const tree = acacias[Math.floor(cr(0, acacias.length))].clone(true)
      tree.position.set(x, groundHeight(x, z), z)
      tree.rotation.y = cr(0, 6.28)
      tree.scale.setScalar(cr(0.85, 1.15))
      chunk.add(tree)
      obstacles.push({ x, z, r: 0.9 })
    }

    /* rocks */
    function rock(x, z, s, tall = 0.75) {
      if (!clearOfStart(x, z, s * 1.3 + 4)) return
      const mesh = shadowed(new THREE.Mesh(rockGeos[Math.floor(cr(0, rockGeos.length))], rockMat))
      mesh.position.set(x, groundHeight(x, z) + s * tall * 0.3, z)
      mesh.scale.set(s * 1.3, s * tall, s)
      mesh.rotation.y = cr(0, 6.28)
      chunk.add(mesh)
      obstacles.push({ x, z, r: s * 1.15 })
    }
    // a cluster of boulders tall enough to hide whatever is standing behind it
    if (crnd() < 0.6) {
      const x = x0 + cr(8, CHUNK - 8)
      const z = z0 + cr(8, CHUNK - 8)
      const s = cr(2.3, 3)
      if (streamDistance(x, z) > STREAM_HALF + s * 1.4) {
        const a = cr(0, 6.28)
        const ux = Math.cos(a)
        const uz = Math.sin(a)
        rock(x, z, s, cr(1.25, 1.5))
        rock(x + ux * cr(3, 3.8), z + uz * cr(3, 3.8), cr(1.3, 1.9), cr(0.9, 1.2))
        if (crnd() < 0.5) rock(x - ux * cr(3, 3.6), z - uz * cr(3, 3.6), cr(0.9, 1.4), cr(0.8, 1))
      }
    }
    // loose rocks, on the plain and in the shallows
    const loose = Math.floor(cr(0, 4))
    for (let k = 0; k < loose; k += 1) rock(x0 + cr(0, CHUNK), z0 + cr(0, CHUNK), cr(0.4, 1.3))

    return {
      group: chunk,
      obstacles,
      dispose() {
        groundGeo.dispose()
        grass.dispose()
      },
    }
  }

  /* water: one ribbon per nearby stream, redrawn as the player travels */
  const water = new THREE.Group()
  group.add(water)
  let waterKey = ''
  function drawWater(px, pz) {
    const k0 = streamIndex(pz)
    const mid = Math.round(px / 40) * 40
    const key = `${k0}:${mid}`
    if (key === waterKey) return
    waterKey = key
    for (const old of [...water.children]) {
      water.remove(old)
      old.geometry.dispose()
    }
    const half = STREAM_HALF + 1.4
    for (const k of [k0 - 1, k0, k0 + 1]) {
      const positions = []
      const index = []
      let row = 0
      for (let x = mid - STREAM_REACH; x <= mid + STREAM_REACH; x += 2, row += 1) {
        const slope = streamSlope(x, k)
        const len = Math.hypot(1, slope)
        const nx = -slope / len
        const nz = 1 / len
        const z = streamZ(x, k)
        positions.push(x + nx * half, WATER_LEVEL, z + nz * half, x - nx * half, WATER_LEVEL, z - nz * half)
        if (row > 0) {
          const a = (row - 1) * 2
          index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setIndex(index)
      geo.computeVertexNormals()
      const ribbon = new THREE.Mesh(geo, waterMat)
      ribbon.receiveShadow = true
      water.add(ribbon)
    }
  }

  const chunks = createChunks({ parent: group, size: CHUNK, loadRadius: LOAD_RADIUS, build: buildChunk })

  /** Call every frame with the player's position: keeps the land, water and sky around them. */
  function update(px, pz) {
    sky.position.set(px, 0, pz)
    drawWater(px, pz)
    chunks.update(px, pz)
  }

  /** Free everything, including the shapes the chunks share. */
  function dispose() {
    chunks.clear()
    for (const ribbon of [...water.children]) {
      water.remove(ribbon)
      ribbon.geometry.dispose()
    }
    waterKey = ''
    for (const tree of acacias) tree.traverse((node) => node.geometry?.dispose())
    for (const geo of [bladeGeo, blobGeo, ...rockGeos, sky.geometry]) geo.dispose()
    for (const mat of [groundMat, grassMat, waterMat, barkMat, leafMat, rockMat, sky.material]) {
      mat.map?.dispose()
      mat.dispose()
    }
  }

  return {
    kind: 'savanna',
    group,
    sky,
    sunDirection,
    fog: new THREE.Fog(0xd9d3b6, 22, FOG_FAR),
    fogFar: FOG_FAR,
    groundHeight,
    inWater: inStream,
    update,
    animate() {},
    collide: chunks.collide,
    dispose,
    chunkCount: chunks.count,
  }
}
