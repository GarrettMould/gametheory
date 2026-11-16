// The endless-world machinery shared by every terrain: land is built in square chunks around the
// player and thrown away behind them. Each terrain supplies `build(cx, cz)`, which returns
// { group, obstacles: [{ x, z, r }], places: [{ type, x, z, radius }], foods: [{ key, x, z, strip() }],
// dispose() } for the chunk at that grid position. Places and foods are optional.
export function createChunks({ parent, size, loadRadius, build }) {
  const chunks = new Map()
  const eaten = new Set() // food already eaten, so it stays eaten when its chunk is rebuilt
  /** Run `visit` on the chunk under (x, z) and its eight neighbours until it returns something. */
  function around(x, z, visit) {
    const pcx = Math.floor(x / size)
    const pcz = Math.floor(z / size)
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const chunk = chunks.get(keyOf(pcx + dx, pcz + dz))
        const found = chunk && visit(chunk)
        if (found) return found
      }
    }
    return null
  }
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
          for (const food of chunk.foods || []) if (eaten.has(food.key)) food.strip()
          chunks.set(keyOf(cx, cz), { places: [], foods: [], ...chunk, cx, cz })
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

    /** The place (carcass, watering hole...) the point is standing in, or null. */
    placeAt(x, z) {
      return around(x, z, (chunk) =>
        chunk.places.find((place) => Math.hypot(place.x - x, place.z - z) < place.radius),
      )
    },

    /** Eat the food within `reach` of the point, if there is any left. Returns true if something was eaten. */
    eatAt(x, z, reach) {
      const food = around(x, z, (chunk) =>
        chunk.foods.find(
          (item) => !eaten.has(item.key) && Math.hypot(item.x - x, item.z - z) < reach,
        ),
      )
      if (!food) return false
      eaten.add(food.key)
      food.strip()
      return true
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
