// One-off details that individual creatures ask for in designs.js.
// Every function takes x, the creature under construction:
//   x.root, x.front (neck+head group), x.hd (head; x.hd.g is built in head units), x.torso, x.neck, x.spine,
//   x.hF/x.wF (body radii), x.S, x.main / x.frontB (covering batches), x.rnd, x.feet, x.hips, x.tailTip, x.legR
import * as THREE from 'three';
import { V3, hsl, cover, FeatherBatch, stdMat, ellipsoid, shadowed, tubeMesh } from '../../kit.js';

const glow = (color, k = 2.2) => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: k, roughness: 0.3 });
const UP = new V3(0, 1, 0);

/** Extra angler lures on the head. spots: [x, z, height, forward lean] in head units. */
export function extraLures(x, spots, color = 0x7fe9ff) {
  const m = stdMat(0x2b2420, 0.5), gm = glow(color);
  for (const [bx, bz, h, lean] of spots) {
    const tip = new V3(bx + lean, 0.44 + h, bz * 1.6);
    tubeMesh(x.hd.g, [new V3(bx, 0.42, bz), new V3(bx + lean * 0.3, 0.44 + h * 0.75, bz * 1.3), tip], (t) => 0.03 - 0.017 * t, m, 14, 7);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), gm); b.position.copy(tip); x.hd.g.add(b);
  }
}
/** Rows of small glowing spots along the lower flanks. */
export function photophores(x, color = 0x7fe9ff, n = 11) {
  const gm = glow(color, 1.8), geo = new THREE.SphereGeometry(0.04 * x.S, 10, 8);
  for (const sg of [1, -1]) for (let i = 0; i < n; i++) {
    const s = x.torso.sample(0.16 + (i * 0.7) / n, sg * (1.85 + 0.12 * Math.sin(i * 1.7))); if (s.h < 0.2 * x.S) continue;
    const b = new THREE.Mesh(geo, gm); b.position.copy(s.p).addScaledVector(s.n, 0.05 * x.S); b.scale.setScalar(0.7 + 0.6 * ((i * 7) % 3) / 2); x.root.add(b);
  }
}
/** A flared collar around the neck. */
export function frill(x, color, { t = 0.78, len = 0.8, arc = 2.5, lift = 2.0, aspect = 0.55 } = {}) {
  for (let a = -arc; a <= arc; a += 0.17) {
    const s = x.neck.sample(t, a), l = len * x.S * x.rnd.range(0.85, 1.1);
    x.frontB.add(s.p, s.n, s.T.clone().negate(), l, l * aspect, color(a), lift);
  }
}
/** Long hair around the neck and over the shoulders. */
export function mane(x, color, { len = 0.62, count = 300, lift = 0.5, shoulders = true } = {}) {
  const style = { len, aspect: 0.26, lift };
  cover(x.frontB, x.neck, x.rnd, { count, t0: 0.05, t1: 0.88, style, S: x.S, color });
  if (shoulders) cover(x.main, x.torso, x.rnd, { count: Math.round(count * 0.7), t0: 0.76, t1: 0.96, style, S: x.S, color, filter: (c) => c.up > -0.3 });
}
/** A bare red wattle under the beak. */
export function wattle(x, color = 0xc0261c) {
  [[0.3, -0.42, 0, 0.09, 0.22, 0.07], [0.2, -0.36, 0.05, 0.06, 0.15, 0.05], [0.2, -0.36, -0.05, 0.06, 0.15, 0.05]].forEach(([px, py, pz, a, b, c]) => {
    const e = ellipsoid([a, b, c], color, { roughness: 0.55 }); e.position.set(px, py, pz); x.hd.g.add(e);
  });
}
/** Plumes rising from the crown. */
export function crestPlumes(x, color, { n = 7, len = 0.75, lift = 0.9, spread = 0.26, aspect = 0.22, sweep = -1 } = {}) {
  const b = new FeatherBatch(), c = x.hd.crown;
  for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : k / (n - 1) - 0.5, l = len * x.rnd.range(0.8, 1.15);
    b.add(new V3(c.x + 0.1 - Math.abs(u) * 0.1, c.y - 0.04, u * spread), UP, new V3(sweep, 0, u * 1.6), l, l * aspect, color(k), lift);
  }
  x.hd.g.add(b.build());
}
/** A sail along the back, held up by thin spines. */
export function sail(x, color, { h = 1.1, t0 = 0.18, t1 = 0.86, spine = 0x2a2f1e } = {}) {
  const pos = [], idx = [], N = 22, sm = stdMat(spine, 0.6);
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N, s = x.torso.sample(t, 0), k = Math.pow(Math.sin((Math.PI * i) / N), 0.6) * (1 + 0.12 * Math.sin(i * 2.1));
    const top = s.p.clone().addScaledVector(s.n, h * x.S * k);
    pos.push(s.p.x, s.p.y - 0.05, 0, top.x - 0.12 * x.S * k, top.y, 0);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (i % 2 === 0 && k > 0.15) tubeMesh(x.root, [s.p, new V3(top.x - 0.12 * x.S * k, top.y + 0.06 * x.S, 0)], (u) => (0.03 - 0.02 * u) * x.S, sm, 6, 6);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  x.root.add(shadowed(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.86, envMapIntensity: 0.4 }))));
}
/** Fleshy whiskers hanging from the chin. */
export function barbels(x, color = 0x3a2f2a, n = 4) {
  const m = stdMat(color, 0.5);
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * 0.16, l = 0.45 + 0.2 * (i % 2);
    tubeMesh(x.hd.g, [new V3(0.3, -0.4, z), new V3(0.34, -0.4 - l * 0.6, z * 1.2), new V3(0.26, -0.4 - l, z * 1.3)], (t) => 0.028 - 0.02 * t, m, 10, 6);
  }
}
export function snoutHorn(x, { at = [1.42, 0.12, 0], h = 0.42, r = 0.09, color = 0xd8ccae, tilt = -0.25 } = {}) {
  const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), stdMat(color, 0.45))); c.position.set(at[0], at[1] + h / 2, at[2]); c.rotation.z = tilt; x.hd.g.add(c);
}
/** Stalked eyes on the front of the shell. */
export function eyestalks(x, color = 0xc46a2a) {
  const m = stdMat(color, 0.4), bead = new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.05, clearcoat: 1 });
  for (const sg of [1, -1]) {
    const s = x.torso.sample(0.9, sg * 0.55), tip = s.p.clone().add(new V3(0.08 * x.S, 0.5 * x.S, sg * 0.05 * x.S));
    tubeMesh(x.root, [s.p, tip], () => 0.035 * x.S, m, 6, 7);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075 * x.S, 14, 10), bead); b.position.copy(tip); x.root.add(b);
  }
}
/** A spiked knob on the end of the tail. */
export function tailClub(x, color = 0x9aa2aa, metal = true) {
  const S = x.S, m = stdMat(color, 0.4, metal ? { metalness: 0.75, envMapIntensity: 0.9 } : {});
  const k = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), m)); k.scale.set(0.36 * S, 0.26 * S, 0.32 * S); k.position.copy(x.tailTip); k.position.y += 0.14 * S; x.root.add(k);
  const geo = new THREE.ConeGeometry(0.07 * S, 0.3 * S, 6);
  [[0, 1, 0], [0, 0.3, 1], [0, 0.3, -1], [-1, 0.4, 0]].forEach((d) => {
    const v = new V3(d[0], d[1], d[2]).normalize(), c = shadowed(new THREE.Mesh(geo, m));
    c.position.copy(k.position).add(new V3(v.x * 0.36 * S, v.y * 0.26 * S, v.z * 0.32 * S)); c.quaternion.setFromUnitVectors(UP, v); x.root.add(c);
  });
}
/** Bands around the lower legs: iron cuffs, or painted rings. */
export function legBands(x, color, { metal = false, heights = [0.34, 0.5], w = 0.05 } = {}) {
  const m = stdMat(color, metal ? 0.35 : 0.8, metal ? { metalness: 0.8, envMapIntensity: 0.9 } : {});
  x.feet.forEach((f) => heights.forEach((hh) => {
    const r = x.legR * 1.35, t = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, w * x.S, 8, 20), m));
    t.rotation.x = Math.PI / 2; t.position.set(f.x - 0.02 * x.S, hh * x.S, f.z); t.scale.z = 1.6; x.root.add(t);
  }));
}
/** Stripes painted across a bare hide (elephant skin has no fur to recolour). */
export function hideStripes(x, color, { t0 = 0.14, t1 = 0.9, step = 0.085, reach = 2.5, skip = 0.95, wid = 0.2 } = {}) {
  for (let t = t0; t <= t1; t += step) for (let a = -reach; a <= reach; a += 0.13) {
    if (Math.abs(a) < skip) continue;   // the top of the back is under the shell
    const s = x.torso.sample(t + 0.012 * Math.sin(a * 5), a); if (s.h < 0.15 * x.S) continue;
    const around = new V3().crossVectors(s.T, s.n).multiplyScalar(a > 0 ? 1 : -1), l = 0.5 * x.S * (1 - Math.abs(a) / (reach * 2.2));
    x.main.add(s.p, s.n, around, l, wid * x.S, color(), 0.02);
  }
}
/** A raised killing claw on each hind foot. */
export function sickleClaws(x, color = 0x1a1612) {
  const m = stdMat(color, 0.35), S = x.S;
  [x.feet[2], x.feet[3]].forEach((f) => tubeMesh(x.root, [new V3(f.x + 0.05 * S, 0.1 * S, f.z), new V3(f.x + 0.3 * S, 0.5 * S, f.z), new V3(f.x + 0.58 * S, 0.34 * S, f.z), new V3(f.x + 0.62 * S, 0.1 * S, f.z)], (t) => (0.07 - 0.06 * t) * S, m, 16, 8));
}
/** Long feathers trailing from the forelimbs. */
export function forearmFeathers(x, color) {
  x.hips.forEach((h) => { const sg = Math.sign(h.z); for (let i = 0; i < 9; i++) {
    const l = x.rnd.range(0.55, 0.85) * x.S;
    x.main.add(new V3(h.x + 0.02 * x.S, h.y * (0.92 - i * 0.06), h.z + sg * 0.14 * x.S), new V3(0, 0.1, sg).normalize(), new V3(-1, -0.35 - i * 0.03, 0), l, l * 0.34, color(i), 0.12);
  } });
}
/** Stiff quills standing along the spine. */
export function quills(x, color, { len = 0.7, step = 0.03, t0 = 0.15, t1 = 0.92, lift = 1.3 } = {}) {
  let k = 0;
  for (let t = t0; t < t1; t += step) {
    const s = x.torso.sample(t, x.rnd.range(-0.25, 0.25)); if (s.h < 0.08 * x.S) continue;
    const l = len * x.S * x.rnd.range(0.7, 1.2); x.main.add(s.p, s.n, s.T.clone().negate(), l, l * 0.12, color(k++), lift);
  }
}
export { hsl };
