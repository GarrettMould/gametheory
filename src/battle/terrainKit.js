// Building blocks shared by the newer terrains (arctic, wetland): the ground mesh for one chunk,
// many copies of a shape in one draw call, and lumpy rock shapes.
import * as THREE from 'three'
import { V3, fbm } from '../creaturesupdate/kit.js'

const color = new THREE.Color()
const matrix = new THREE.Matrix4()
const turn = new THREE.Quaternion()
const euler = new THREE.Euler()
const at = new V3()
const scale = new V3()

/**
 * The ground for one square chunk. `height(x, z)` gives the terrain height and `paint(x, z, h, color)`
 * sets the colour at a point. Heights are sampled one row past each edge so the shading matches
 * the neighbouring chunks.
 */
export function groundGeometry({ x0, z0, size, cells, height, paint }) {
  const step = size / cells
  const side = cells + 3
  const heights = new Float32Array(side * side)
  for (let j = 0; j < side; j += 1) {
    for (let i = 0; i < side; i += 1) {
      heights[j * side + i] = height(x0 + (i - 1) * step, z0 + (j - 1) * step)
    }
  }
  const positions = []
  const normals = []
  const colors = []
  const uvs = []
  for (let j = 0; j <= cells; j += 1) {
    for (let i = 0; i <= cells; i += 1) {
      const x = x0 + i * step
      const z = z0 + j * step
      const here = (j + 1) * side + (i + 1)
      positions.push(x, heights[here], z)
      const nx = heights[here - 1] - heights[here + 1]
      const nz = heights[here - side] - heights[here + side]
      const nl = Math.hypot(nx, 2 * step, nz)
      normals.push(nx / nl, (2 * step) / nl, nz / nl)
      uvs.push(x * 0.3, z * 0.3)
      paint(x, z, heights[here], color)
      colors.push(color.r, color.g, color.b)
    }
  }
  const index = []
  for (let j = 0; j < cells; j += 1) {
    for (let i = 0; i < cells; i += 1) {
      const a = j * (cells + 1) + i
      const b = a + cells + 1
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  return geo
}

/**
 * Many copies of one shape in a single draw call, added to `chunk`. `fill(put)` places them:
 * put(x, y, z, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, color?). Returns the mesh (or null if
 * there is nothing to place); the caller frees it with mesh.dispose().
 */
export function scatter(chunk, geometry, material, most, fill, { shadow = false } = {}) {
  if (most <= 0) return null
  const mesh = new THREE.InstancedMesh(geometry, material, most)
  let used = 0
  fill((px, py, pz, rx, ry, rz, sx, sy, sz, tint) => {
    if (used >= most) return
    euler.set(rx, ry, rz)
    turn.setFromEuler(euler)
    matrix.compose(at.set(px, py, pz), turn, scale.set(sx, sy, sz))
    mesh.setMatrixAt(used, matrix)
    if (tint) mesh.setColorAt(used, tint)
    used += 1
  })
  mesh.count = used
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  mesh.computeBoundingSphere()
  chunk.add(mesh)
  return mesh
}

/** A rounded lump: a sphere pushed in and out by noise. `variant` gives different lumps. */
export function lumpyGeometry(variant = 0, detail = 2, rough = 0.5) {
  const geo = new THREE.IcosahedronGeometry(1, detail)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i += 1) {
    const v = new V3().fromBufferAttribute(p, i)
    v.multiplyScalar(1 - rough / 2 + rough * fbm(v.x * 1.5 + variant * 5.3, v.y * 1.5 + v.z * 1.5 + variant * 2.9, 2))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

export const chunkSeed = (cx, cz, salt) =>
  (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ salt) | 0
