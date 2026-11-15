// The endless-world machinery shared by every terrain: land is built in square chunks around the
// player and thrown away behind them. Each terrain supplies `build(cx, cz)`, which returns
// { group, obstacles: [{ x, z, r }], dispose() } for the chunk at that grid position.
export function createChunks({ parent, size, loadRadius, build }) {
  const chunks = new Map()
  const dropRadius = loadRadius + size
  const keyOf = (cx, cz) => `${cx},${cz}`
  const distanceTo = (cx, cz, px, pz) =>
    Math.hypot((cx + 0.5) * size - px, (cz + 0.5) * size - pz)

  return {
    /** Keep the land around (px, pz) built. The first call builds everything in view; later calls add one chunk at a time. */
    update(px, pz) {
      const pcx = Math.floor(px / size)
      const pcz = Math.floor(pz / size)
      const span = Math.ceil(loadRadius / size) + 1
      const missing = []
      for (let dz = -span; dz <= span; dz += 1) {
        for (let dx = -span; dx <= span; dx += 1) {
          const cx = pcx + dx
          const cz = pcz + dz
          if (chunks.has(keyOf(cx, cz))) continue
          const distance = distanceTo(cx, cz, px, pz)
          if (distance < loadRadius) missing.push({ cx, cz, distance })
        }
      }
      if (missing.length) {
        missing.sort((a, b) => a.distance - b.distance)
        const batch = chunks.size === 0 ? missing : missing.slice(0, 1)
        for (const { cx, cz } of batch) {
          const chunk = build(cx, cz)
          chunks.set(keyOf(cx, cz), { ...chunk, cx, cz })
          parent.add(chunk.group)
        }
      }
      for (const [key, chunk] of chunks) {
        if (distanceTo(chunk.cx, chunk.cz, px, pz) > dropRadius) {
          parent.remove(chunk.group)
          chunk.dispose()
          chunks.delete(key)
        }
      }
    },

    /** Push a circle at (x, z) out of any obstacle it overlaps. Returns [x, z]. */
    collide(x, z, radius) {
      const pcx = Math.floor(x / size)
      const pcz = Math.floor(z / size)
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const chunk = chunks.get(keyOf(pcx + dx, pcz + dz))
          if (!chunk) continue
          for (const o of chunk.obstacles) {
            const ox = x - o.x
            const oz = z - o.z
            const distance = Math.hypot(ox, oz)
            const reach = o.r + radius
            if (distance < reach && distance > 0.0001) {
              x = o.x + (ox / distance) * reach
              z = o.z + (oz / distance) * reach
            }
          }
        }
      }
      return [x, z]
    },

    /** Remove and free every chunk. */
    clear() {
      for (const chunk of chunks.values()) {
        parent.remove(chunk.group)
        chunk.dispose()
      }
      chunks.clear()
    },

    count: () => chunks.size,
  }
}
