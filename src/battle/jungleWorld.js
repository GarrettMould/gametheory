// The jungle: an endless rainforest. Tall buttressed trees hold a canopy overhead with vines hanging
// from it, ferns cover the floor, a wide river winds through, and the land is stepped into terraces,
// so wherever the river meets a cliff it drops as a waterfall. Flocks of parakeets fly under the canopy.
//
// Same interface as the savanna in roamWorld.js, so the arena can swap one for the other.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  V3,
  makeRng,
  canvasTexture,
  fbm,
  smoothstep,
  skyDome,
  sunRig,
} from '../creaturesupdate/kit.js'
import { createChunks } from './chunks.js'

const FOG_FAR = 72 // the forest closes in sooner than the open plain
const CHUNK = 48
const CELLS = 32
const LOAD_RADIUS = FOG_FAR + CHUNK * 0.75
const WATER_LEVEL = -0.35 // the river surface, relative to the terrace it is on
const RIVER_HALF = 5.5 // half the width of the river
const RIVER_DEPTH = 0.9
const RIVER_GAP = 190 // rivers run west to east, about this far apart going north or south
const RIVER_REACH = 150 // how far east and west of the player the water is drawn
const CLIFF_HEIGHT = 9 // the drop between a high terrace and a low one
const TERRACE = 260 // one high terrace plus one low one, going east
const UNDERGROWTH_PER_CHUNK = 1500
const FERNS_PER_CHUNK = 46
const FLOCKS = 4
const BIRDS_PER_FLOCK = 7

/* Rivers: number k wanders around z = 30 + k * RIVER_GAP, each with its own bends. */
const riverIndex = (z) => Math.round((z - 30) / RIVER_GAP)
const riverZ = (x, k) =>
  30 + k * RIVER_GAP + 17 * Math.sin(x * 0.027 + 0.4 + k * 1.9) + 6 * Math.sin(x * 0.071 + 1.3 + k * 2.3)
const riverSlope = (x, k) =>
  17 * 0.027 * Math.cos(x * 0.027 + 0.4 + k * 1.9) + 6 * 0.071 * Math.cos(x * 0.071 + 1.3 + k * 2.3)
function riverDistance(x, z) {
  const k = riverIndex(z)
  return Math.abs(z - riverZ(x, k)) / Math.hypot(1, riverSlope(x, k))
}
const inWater = (x, z) => riverDistance(x, z) < RIVER_HALF

/*
 * Terraces: going east the land alternates between a high shelf and a low one, with a cliff between.
 * The cliff lines wobble north to south. The player starts in the middle of a high shelf.
 */
const cliffCoord = (x, z) => x + 14 * Math.sin(z * 0.021) + TERRACE / 4
const shelf = (x, z) =>
  smoothstep(-0.07, 0.07, Math.sin((cliffCoord(x, z) * Math.PI * 2) / TERRACE)) // 1 on a high shelf, 0 on a low one
const terrace = (x, z) => CLIFF_HEIGHT * shelf(x, z)
const onCliff = (x, z) => {
  const s = shelf(x, z)
  return 4 * s * (1 - s) // 0 on the flat, 1 halfway down a cliff
}

/** Terrain height: terraces, rolling ground on top, level banks and a carved bed along the rivers. */
function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  const d = riverDistance(x, z)
  let h = (fbm(x * 0.05 + 7, z * 0.05 + 3, 4) - 0.45) * 3.2 * smoothstep(6, 24, r)
  h += (fbm(x * 0.014 + 20, z * 0.014 + 40, 3) - 0.5) * 6 * smoothstep(40, 120, r)
  h *= smoothstep(RIVER_HALF + 1, RIVER_HALF + 20, d)
  h -= RIVER_DEPTH * (1 - smoothstep(RIVER_HALF * 0.4, RIVER_HALF + 1, d))
  return h + terrace(x, z)
}

const chunkSeed = (cx, cz) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x2f6b1c3d) | 0

export function createJungleWorld() {
  const rnd = makeRng(4417)
  const rr = rnd.range
  const group = new THREE.Group()
  group.name = 'jungle-world'
  const sunDirection = new V3(5, 12, 3).normalize()

  const sky = skyDome(
    [[0, '#3b79a8'], [0.3, '#86b3c9'], [0.45, '#bfd3c4'], [0.5, '#a9bfa0'], [0.54, '#6f8a62'], [1, '#3f5238']],
    320,
  )
  group.add(sky)
  group.add(
    sunRig({
      direction: sunDirection,
      sunColor: 0xfff3d0,
      sunIntensity: 5.2,
      skyColor: 0xcfe6d2,
      groundColor: 0x3f5a2c,
      skyIntensity: 1.25,
      rimColor: 0xbfe0c8,
      rimIntensity: 1.1,
    }),
  )

  /* ---- materials and shapes shared by every chunk ---- */
  const litter = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#dcdcdc'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 9000; i += 1) {
      const v = Math.floor(rr(120, 255))
      g.fillStyle = `rgba(${v},${v},${v},.6)`
      g.fillRect(rr(0, 256), rr(0, 256), rr(1, 3.2), rr(1, 3.2))
    }
  })
  litter.wrapS = THREE.RepeatWrapping
  litter.wrapT = THREE.RepeatWrapping
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: litter, roughness: 1, envMapIntensity: 0.15 })
  const plantMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.15 })
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.95, envMapIntensity: 0.15 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, envMapIntensity: 0.15 })
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.9, envMapIntensity: 0.15 })
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d7462, roughness: 0.95, flatShading: true, envMapIntensity: 0.15 })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3d7466,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  })

  // undergrowth: one broad blade
  const bladeGeo = new THREE.ConeGeometry(0.05, 1, 3)
  bladeGeo.translate(0, 0.5, 0)

  // fern: fronds arching out from a centre
  const fernGeo = (() => {
    const fronds = []
    const count = 8
    for (let k = 0; k < count; k += 1) {
      const frond = new THREE.PlaneGeometry(0.42, 1, 1, 5)
      const p = frond.attributes.position
      for (let i = 0; i < p.count; i += 1) {
        const t = p.getY(i) + 0.5 // 0 at the stem, 1 at the tip
        const side = p.getX(i) * (1 - t * 0.85) // taper toward the tip
        p.setXYZ(i, side, Math.sin(t * Math.PI * 0.62) * 0.85, t * 1.35)
      }
      frond.rotateY((k / count) * Math.PI * 2 + (k % 2) * 0.2)
      fronds.push(frond)
    }
    const merged = mergeGeometries(fronds)
    merged.computeVertexNormals()
    fronds.forEach((frond) => frond.dispose())
    return merged
  })()

  // trunk: one unit tall, flaring into buttress roots at the base
  const trunkGeo = (() => {
    const g = new THREE.CylinderGeometry(0.55, 1, 1, 10, 8, true)
    g.translate(0, 0.5, 0)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i += 1) {
      const y = p.getY(i)
      const angle = Math.atan2(p.getZ(i), p.getX(i))
      const low = Math.pow(1 - y, 5)
      const flare = 1 + low * (1.3 + 0.9 * Math.cos(angle * 5))
      p.setX(i, p.getX(i) * flare)
      p.setZ(i, p.getZ(i) * flare)
    }
    g.computeVertexNormals()
    return g
  })()

  // canopy: one lumpy mass of leaves, used many times over
  const crownGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i += 1) {
      const v = new V3().fromBufferAttribute(p, i)
      v.multiplyScalar(0.82 + 0.36 * fbm(v.x * 2 + 5, v.y * 2 + v.z * 2, 2))
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })()

  // vine: one unit long, hanging from its top end with a slight wander
  const vineGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new V3(0, 0, 0),
      new V3(0.05, -0.3, 0.03),
      new V3(-0.04, -0.65, -0.03),
      new V3(0.02, -1, 0.02),
    ]),
    10,
    0.05,
    5,
  )

  const rockGeos = [0, 1, 2].map((k) => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i += 1) {
      const v = new V3().fromBufferAttribute(p, i)
      v.multiplyScalar(0.75 + 0.5 * fbm(v.x * 1.5 + k * 5.1, v.y * 1.5 + v.z * 1.5 + k * 2.7, 2))
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })

  const floorGreen = new THREE.Color(0x4f6a2f)
  const moss = new THREE.Color(0x3a5a2a)
  const leafLitter = new THREE.Color(0x6b5632)
  const mud = new THREE.Color(0x5a4c35)
  const cliffRock = new THREE.Color(0x726d5e)
  const tmp = new THREE.Color()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const at = new V3()
  const size = new V3()

  function buildChunk(cx, cz) {
    const crnd = makeRng(chunkSeed(cx, cz))
    const cr = crnd.range
    const x0 = cx * CHUNK
    const z0 = cz * CHUNK
    const step = CHUNK / CELLS
    const chunk = new THREE.Group()
    const obstacles = []
    const owned = [] // things this chunk alone holds and must free

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
        const here = (j + 1) * side + (i + 1)
        positions.push(x, heights[here], z)
        const nx = heights[here - 1] - heights[here + 1]
        const nz = heights[here - side] - heights[here + side]
        const nl = Math.hypot(nx, 2 * step, nz)
        normals.push(nx / nl, (2 * step) / nl, nz / nl)
        uvs.push(x * 0.3, z * 0.3)
        const d = riverDistance(x, z)
        tmp.copy(floorGreen).lerp(moss, smoothstep(0.4, 0.7, fbm(x * 0.07, z * 0.07 + 20, 3)))
        tmp.lerp(leafLitter, smoothstep(0.52, 0.74, fbm(x * 0.12 + 40, z * 0.12, 3)))
        tmp.lerp(mud, 1 - smoothstep(RIVER_HALF * 0.6, RIVER_HALF + 1.2, d))
        tmp.lerp(cliffRock, smoothstep(0.08, 0.6, onCliff(x, z)))
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

    /** One draw call for many copies of a shape. `fill(put)` places them; put(position, euler, scale, color). */
    function scatter(geometry, material, most, fill, { shadow = false } = {}) {
      if (most <= 0) return
      const mesh = new THREE.InstancedMesh(geometry, material, most)
      let used = 0
      fill((px, py, pz, rx, ry, rz, sx, sy, sz, color) => {
        if (used >= most) return
        e.set(rx, ry, rz)
        q.setFromEuler(e)
        m.compose(at.set(px, py, pz), q, size.set(sx, sy, sz))
        mesh.setMatrixAt(used, m)
        if (color) mesh.setColorAt(used, color)
        used += 1
      })
      mesh.count = used
      mesh.castShadow = shadow
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      chunk.add(mesh)
      owned.push(mesh)
    }

    /* forest floor: blades of undergrowth and clumps of fern, none in the river or on the cliffs */
    scatter(bladeGeo, plantMat, UNDERGROWTH_PER_CHUNK, (put) => {
      for (let i = 0; i < UNDERGROWTH_PER_CHUNK; i += 1) {
        const x = x0 + cr(0, CHUNK)
        const z = z0 + cr(0, CHUNK)
        if (riverDistance(x, z) < RIVER_HALF + 0.4 || Math.hypot(x, z) < 1.5 || onCliff(x, z) > 0.3) continue
        const wide = i % 4 === 0 ? 2.4 : 1.3
        tmp.setHSL(cr(0.24, 0.34), cr(0.45, 0.7), cr(0.2, 0.36))
        put(x, groundHeight(x, z) - 0.03, z, cr(-0.3, 0.3), cr(0, 6.28), cr(-0.3, 0.3), wide, cr(0.3, 1), wide, tmp)
      }
    })
    scatter(fernGeo, plantMat, FERNS_PER_CHUNK, (put) => {
      for (let i = 0; i < FERNS_PER_CHUNK; i += 1) {
        const x = x0 + cr(0, CHUNK)
        const z = z0 + cr(0, CHUNK)
        if (riverDistance(x, z) < RIVER_HALF + 0.8 || Math.hypot(x, z) < 3 || onCliff(x, z) > 0.3) continue
        const s = cr(0.8, 1.9)
        tmp.setHSL(cr(0.27, 0.36), cr(0.5, 0.75), cr(0.22, 0.38))
        put(x, groundHeight(x, z), z, 0, cr(0, 6.28), 0, s, s * cr(0.8, 1.2), s, tmp)
      }
    })

    /* trees: where each stands, how tall, how thick */
    const trees = []
    const treeCount = 7 + Math.floor(cr(0, 5))
    for (let k = 0; k < treeCount; k += 1) {
      const x = x0 + cr(2, CHUNK - 2)
      const z = z0 + cr(2, CHUNK - 2)
      if (riverDistance(x, z) < RIVER_HALF + 3.5 || Math.hypot(x, z) < 8 || onCliff(x, z) > 0.15) continue
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 7)) continue
      const tree = { x, z, y: groundHeight(x, z), height: cr(13, 20), girth: cr(0.5, 0.95) }
      trees.push(tree)
      obstacles.push({ x, z, r: tree.girth * 1.35 })
    }
    scatter(
      trunkGeo,
      barkMat,
      trees.length,
      (put) => {
        for (const tree of trees) {
          put(tree.x, tree.y - 0.4, tree.z, 0, cr(0, 6.28), 0, tree.girth, tree.height + 0.4, tree.girth)
        }
      },
      { shadow: true },
    )

    /* canopy: each tree carries one broad crown and a ring of smaller ones, overlapping its neighbours */
    const hangs = [] // places a vine can hang from
    scatter(
      crownGeo,
      leafMat,
      trees.length * 7,
      (put) => {
        for (const tree of trees) {
          const top = tree.y + tree.height
          tmp.setHSL(cr(0.27, 0.35), cr(0.45, 0.65), cr(0.18, 0.3))
          const spread = cr(6, 8.5)
          put(tree.x, top, tree.z, 0, cr(0, 6.28), 0, spread, cr(2.6, 3.6), spread, tmp)
          const ring = 4 + Math.floor(cr(0, 3))
          for (let k = 0; k < ring; k += 1) {
            const a = (k / ring) * 6.28 + cr(-0.4, 0.4)
            const out = cr(3.5, 6.5)
            const bx = tree.x + Math.cos(a) * out
            const bz = tree.z + Math.sin(a) * out
            const by = top + cr(-2.4, 1.6)
            const s = cr(3.4, 5.4)
            const sy = cr(1.8, 2.7)
            tmp.setHSL(cr(0.26, 0.36), cr(0.45, 0.7), cr(0.17, 0.32))
            put(bx, by, bz, 0, cr(0, 6.28), 0, s, sy, s, tmp)
            hangs.push({ x: bx + cr(-1.5, 1.5), z: bz + cr(-1.5, 1.5), y: by - sy * 0.6, floor: tree.y })
          }
        }
      },
      { shadow: true },
    )

    /* vines: hanging from the canopy, some nearly to the ground */
    scatter(vineGeo, vineMat, hangs.length, (put) => {
      for (const hang of hangs) {
        if (crnd() < 0.3) continue
        const room = hang.y - Math.max(hang.floor, groundHeight(hang.x, hang.z)) - 0.6
        if (room < 2) continue
        const length = Math.min(room, cr(4, 13))
        const thick = cr(0.9, 1.8)
        put(hang.x, hang.y, hang.z, 0, cr(0, 6.28), 0, thick, length, thick)
      }
    })

    /* mossy boulders */
    const rockCount = Math.floor(cr(0, 3.4))
    for (let k = 0; k < rockCount; k += 1) {
      const x = x0 + cr(0, CHUNK)
      const z = z0 + cr(0, CHUNK)
      const s = cr(0.5, 1.9)
      if (Math.hypot(x, z) < s * 1.3 + 4) continue
      const mesh = new THREE.Mesh(rockGeos[Math.floor(cr(0, rockGeos.length))], rockMat)
      mesh.position.set(x, groundHeight(x, z) + s * 0.2, z)
      mesh.scale.set(s * 1.3, s * 0.8, s)
      mesh.rotation.y = cr(0, 6.28)
      mesh.castShadow = true
      mesh.receiveShadow = true
      chunk.add(mesh)
      obstacles.push({ x, z, r: s * 1.15 })
    }

    return {
      group: chunk,
      obstacles,
      dispose() {
        groundGeo.dispose()
        for (const mesh of owned) mesh.dispose()
      },
    }
  }

  const chunks = createChunks({ parent: group, size: CHUNK, loadRadius: LOAD_RADIUS, build: buildChunk })

  /* ---- river and waterfalls, redrawn as the player travels ---- */
  const streaks = canvasTexture(64, 256, (g) => {
    g.clearRect(0, 0, 64, 256)
    for (let i = 0; i < 90; i += 1) {
      const x = rr(0, 64)
      const y = rr(0, 256)
      const len = rr(30, 120)
      const grad = g.createLinearGradient(0, y, 0, y + len)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, `rgba(255,255,255,${rr(0.5, 0.95)})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(x, y, rr(1, 4), len)
    }
  })
  streaks.wrapS = THREE.RepeatWrapping
  streaks.wrapT = THREE.RepeatWrapping
  streaks.repeat.set(3, 1)
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xeaf6f4,
    map: streaks,
    transparent: true,
    opacity: 0.9,
    roughness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const fallBackMat = new THREE.MeshStandardMaterial({ color: 0x9fd0c8, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false })
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false })
  const mistMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true })
  const MIST = 70
  const MIST_RISE = 4.5

  const water = new THREE.Group()
  group.add(water)
  let waterKey = ''
  let mists = [] // { points, base: Float32Array }

  /** A waterfall where river k crosses the cliff line numbered n. */
  function addWaterfall(k, n) {
    // Where the river meets the cliff: solve cliffCoord(x, riverZ(x)) = n * TERRACE / 2.
    let x = (n * TERRACE) / 2 - TERRACE / 4
    for (let i = 0; i < 8; i += 1) {
      x = (n * TERRACE) / 2 - TERRACE / 4 - 14 * Math.sin(riverZ(x, k) * 0.021)
    }
    const z = riverZ(x, k)
    const down = n % 2 === 0 ? -1 : 1 // which way along x the water falls
    const slope = riverSlope(x, k)
    const turn = Math.atan(slope)
    const width = RIVER_HALF * 2 + 1.5
    const fall = new THREE.Group()
    fall.position.set(x, 0, z)
    fall.rotation.y = -turn // line up with the river, which runs roughly along x

    const sheetGeo = new THREE.PlaneGeometry(width, CLIFF_HEIGHT + 0.5, 8, 10)
    const sp = sheetGeo.attributes.position
    for (let i = 0; i < sp.count; i += 1) {
      const v = sp.getY(i) / (CLIFF_HEIGHT + 0.5) + 0.5 // 1 at the lip, 0 at the pool
      // the water leaves the lip and arcs out to land at the foot of the cliff
      const bulge = Math.pow(1 - v, 1.6) * 5.6 + Math.sin(sp.getX(i) * 1.7) * 0.18
      sp.setZ(i, bulge)
    }
    sheetGeo.computeVertexNormals()
    for (const [mat, lift] of [[fallBackMat, 0], [fallMat, 0.25]]) {
      const sheet = new THREE.Mesh(sheetGeo, mat)
      sheet.rotation.y = (down * Math.PI) / 2 // the sheet's front faces the low side
      sheet.position.set(down * (-2.6 + lift), WATER_LEVEL + (CLIFF_HEIGHT + 0.5) / 2 - 0.1, 0)
      fall.add(sheet)
    }

    const foam = new THREE.Mesh(new THREE.CircleGeometry(RIVER_HALF + 1.2, 24), foamMat)
    foam.rotation.x = -Math.PI / 2
    foam.scale.set(0.8, 1, 1)
    foam.position.set(down * 5, WATER_LEVEL + 0.04, 0)
    fall.add(foam)

    const base = new Float32Array(MIST * 3)
    for (let i = 0; i < MIST; i += 1) {
      base[i * 3] = down * rr(2.5, 8)
      base[i * 3 + 1] = rr(0, MIST_RISE)
      base[i * 3 + 2] = rr(-RIVER_HALF, RIVER_HALF)
    }
    const mistGeo = new THREE.BufferGeometry()
    mistGeo.setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3))
    const points = new THREE.Points(mistGeo, mistMat)
    points.position.y = WATER_LEVEL
    points.frustumCulled = false
    fall.add(points)
    mists.push({ points, base })

    water.add(fall)
  }

  function clearWater() {
    water.traverse((node) => {
      if (node.geometry) node.geometry.dispose()
    })
    water.clear()
    mists = []
  }

  function drawWater(px, pz) {
    const k0 = riverIndex(pz)
    const mid = Math.round(px / 40) * 40
    const key = `${k0}:${mid}`
    if (key === waterKey) return
    waterKey = key
    clearWater()
    const half = RIVER_HALF + 1.6
    for (const k of [k0 - 1, k0, k0 + 1]) {
      // The surface follows the terraces, so it steps down wherever the river meets a cliff.
      const positions = []
      const index = []
      let row = 0
      for (let x = mid - RIVER_REACH; x <= mid + RIVER_REACH; x += 1, row += 1) {
        const slope = riverSlope(x, k)
        const len = Math.hypot(1, slope)
        const nx = -slope / len
        const nz = 1 / len
        const z = riverZ(x, k)
        const y = terrace(x, z) + WATER_LEVEL
        positions.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half)
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

      const first = Math.ceil((mid - RIVER_REACH + TERRACE / 4 - 20) / (TERRACE / 2))
      const last = Math.floor((mid + RIVER_REACH + TERRACE / 4 + 20) / (TERRACE / 2))
      for (let n = first; n <= last; n += 1) addWaterfall(k, n)
    }
  }

  /* ---- parakeets: small flocks looping under the canopy ---- */
  const BIRDS = FLOCKS * BIRDS_PER_FLOCK
  const birdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true, side: THREE.DoubleSide, envMapIntensity: 0.2 })
  const bodyGeo = new THREE.ConeGeometry(0.1, 0.62, 6)
  bodyGeo.rotateZ(Math.PI / 2) // blunt head toward +X, tail tapering behind
  const wingShape = (sideSign) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0.16, 0, 0, -0.2, 0, 0, -0.06, 0, 0.5 * sideSign], 3),
    )
    g.computeVertexNormals()
    return g
  }
  const wingGeos = [wingShape(1), wingShape(-1)]
  const bodies = new THREE.InstancedMesh(bodyGeo, birdMat, BIRDS)
  const wings = wingGeos.map((geo) => new THREE.InstancedMesh(geo, birdMat, BIRDS))
  const plumage = [0x2fbf4a, 0x35c44a, 0x58d23c, 0xf2d024, 0x2d9fe0, 0xe8552d]
  for (const mesh of [bodies, ...wings]) {
    mesh.frustumCulled = false
    mesh.castShadow = true
    group.add(mesh)
  }
  const flocks = []
  for (let f = 0; f < FLOCKS; f += 1) {
    flocks.push({
      x: rr(-40, 40),
      z: rr(-40, 40),
      radius: rr(12, 24),
      height: rr(5, 10.5),
      speed: rr(0.28, 0.45) * (f % 2 ? -1 : 1),
      phase: rr(0, 6.28),
    })
    for (let b = 0; b < BIRDS_PER_FLOCK; b += 1) {
      const color = tmp.set(plumage[Math.floor(rr(0, plumage.length))])
      const i = f * BIRDS_PER_FLOCK + b
      bodies.setColorAt(i, color)
      wings.forEach((wing) => wing.setColorAt(i, color))
    }
  }
  const birdOffsets = Array.from({ length: BIRDS }, () => ({
    trail: rr(0, 0.5),
    aside: rr(-1.6, 1.6),
    lift: rr(-0.8, 0.8),
    beat: rr(0, 6.28),
  }))
  const flap = new THREE.Matrix4()
  const wingMatrix = new THREE.Matrix4()
  const one = new V3(1, 1, 1)

  function flyBirds(t, px, pz) {
    flocks.forEach((flock, f) => {
      // A flock left far behind turns up again somewhere ahead of the player.
      if (Math.hypot(flock.x - px, flock.z - pz) > FOG_FAR * 1.4) {
        const a = rr(0, 6.28)
        flock.x = px + Math.cos(a) * rr(20, 45)
        flock.z = pz + Math.sin(a) * rr(20, 45)
      }
      for (let b = 0; b < BIRDS_PER_FLOCK; b += 1) {
        const i = f * BIRDS_PER_FLOCK + b
        const bird = birdOffsets[i]
        const a = t * flock.speed + flock.phase - Math.sign(flock.speed) * bird.trail
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        // an oval loop; each bird sits a little behind and to one side of the leader
        const tx = -sin * Math.sign(flock.speed)
        const tz = 0.7 * cos * Math.sign(flock.speed)
        const tl = Math.hypot(tx, tz) || 1
        const x = flock.x + flock.radius * cos + (-tz / tl) * bird.aside
        const z = flock.z + flock.radius * 0.7 * sin + (tx / tl) * bird.aside
        const y = terrace(x, z) + flock.height + bird.lift + Math.sin(a * 2 + bird.beat) * 1.2
        e.set(0, Math.atan2(-tz, tx), 0)
        q.setFromEuler(e)
        m.compose(at.set(x, y, z), q, one)
        bodies.setMatrixAt(i, m)
        const beat = Math.sin(t * 17 + bird.beat) * 0.95
        wings.forEach((wing, w) => {
          flap.makeRotationX(w === 0 ? -beat : beat)
          wingMatrix.multiplyMatrices(m, flap)
          wing.setMatrixAt(i, wingMatrix)
        })
      }
    })
    bodies.instanceMatrix.needsUpdate = true
    wings.forEach((wing) => {
      wing.instanceMatrix.needsUpdate = true
    })
  }

  /** Call every frame with the player's position: keeps the land, water and sky around them. */
  function update(px, pz) {
    sky.position.set(px, 0, pz)
    drawWater(px, pz)
    chunks.update(px, pz)
  }

  /** Call every frame with the time and the player's position: falling water, mist and birds. */
  function animate(t, px = 0, pz = 0) {
    streaks.offset.y = (t * 0.55) % 1
    for (const { points, base } of mists) {
      const p = points.geometry.attributes.position
      for (let i = 0; i < MIST; i += 1) {
        p.setY(i, (base[i * 3 + 1] + t * (0.5 + (i % 5) * 0.12)) % MIST_RISE)
      }
      p.needsUpdate = true
    }
    flyBirds(t, px, pz)
  }

  function dispose() {
    chunks.clear()
    clearWater()
    waterKey = ''
    for (const mesh of [bodies, ...wings]) mesh.dispose()
    for (const geo of [bladeGeo, fernGeo, trunkGeo, crownGeo, vineGeo, bodyGeo, ...wingGeos, ...rockGeos, sky.geometry]) {
      geo.dispose()
    }
    for (const mat of [groundMat, plantMat, barkMat, leafMat, vineMat, rockMat, waterMat, fallMat, fallBackMat, foamMat, mistMat, birdMat, sky.material]) {
      mat.map?.dispose()
      mat.dispose()
    }
  }

  return {
    kind: 'jungle',
    group,
    sky,
    sunDirection,
    fog: new THREE.Fog(0x93aa8c, 12, FOG_FAR),
    fogFar: FOG_FAR,
    groundHeight,
    inWater,
    update,
    animate,
    collide: chunks.collide,
    dispose,
    chunkCount: chunks.count,
  }
}
