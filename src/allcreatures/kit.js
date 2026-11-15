// Shared building blocks for every creature and environment.
// Plain Three.js (no React) so it works inside React Three Fiber or anywhere else.
import * as THREE from 'three';

export const V3 = THREE.Vector3;

/** Seeded random so a creature looks identical on every load. */
export function makeRng(seed) {
  let s = seed | 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.range = (a, b) => a + (b - a) * rnd();
  return rnd;
}

export const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);

/** Smooth 2D noise in 0..1, and a layered version for terrain. */
function hash(ix, iy) {
  const v = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, octaves = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < octaves; i++) { v += noise2(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Draw on a canvas and get a texture back. */
export function canvasTexture(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}

/** A tube that follows a curve and changes thickness along it (necks, tusks, legs, trunks). */
export function taperedTube(curve, segs, radial, rFn) {
  const fr = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [], P = new V3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, P);
    const r = rFn(t), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
      pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz); nor.push(nx, ny, nz); uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geo: g, frames: fr };
}

export function shadowed(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

export function ellipsoid(radii, color, { roughness = 0.8, env = 0.3 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28),
    new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: env }));
  m.scale.set(radii[0], radii[1], radii[2]);
  return shadowed(m);
}

/** Evenly spread points on a unit sphere. */
export function fibSphere(n, rnd, cb) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * ga + rnd.range(-0.15, 0.15);
    cb(new V3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
}

/* ---------- feathers: one shared shape + texture, drawn thousands of times ---------- */
let _featherGeo = null, _featherTex = null;
function featherGeometry() {
  if (_featherGeo) return _featherGeo;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.bezierCurveTo(0.25, 0.3, 0.8, 0.26, 1, 0); sh.bezierCurveTo(0.8, -0.26, 0.25, -0.3, 0, 0);
  const geo = new THREE.ShapeGeometry(sh, 7);
  const pa = geo.attributes.position, ua = geo.attributes.uv;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i);
    pa.setZ(i, -0.14 * x * x - 0.5 * y * y); ua.setXY(i, x, y / 0.6 + 0.5);
  }
  geo.computeVertexNormals(); geo.userData.shared = true;
  return (_featherGeo = geo);
}
function featherTexture() {
  if (_featherTex) return _featherTex;
  _featherTex = canvasTexture(128, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, '#bdbdbd'); gr.addColorStop(0.55, '#f2f2f2'); gr.addColorStop(1, '#a8a8a8');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    const ge = g.createLinearGradient(0, 0, 0, 64);
    ge.addColorStop(0, 'rgba(0,0,0,.45)'); ge.addColorStop(0.3, 'rgba(0,0,0,0)'); ge.addColorStop(0.7, 'rgba(0,0,0,0)'); ge.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = ge; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1;
    for (let x = -20; x < 128; x += 3) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.moveTo(x, 32); g.lineTo(x + 16, 64); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 32); g.lineTo(120, 32); g.stroke();
  });
  _featherTex.userData.shared = true;
  return _featherTex;
}

export class FeatherBatch {
  constructor() { this.items = []; }
  /** p: root position, n: surface normal, flow: direction the feather points, lift: how far the tip rises off the surface */
  add(p, n, flow, len, wid, color, lift = 0.2) {
    const d = flow.clone().addScaledVector(n, -flow.dot(n));
    if (d.lengthSq() < 1e-6) return;
    d.normalize().addScaledVector(n, lift).normalize();
    const side = new V3().crossVectors(n, d).normalize();
    const nn = new V3().crossVectors(d, side).normalize();
    const m = new THREE.Matrix4().makeBasis(d, side, nn);
    m.scale(new V3(len, wid, len)); m.setPosition(p);
    this.items.push({ m, c: color });
  }
  build(matOpts = {}) {
    const mat = new THREE.MeshStandardMaterial({ map: featherTexture(), roughness: 0.75, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.22, ...matOpts });
    const im = new THREE.InstancedMesh(featherGeometry(), mat, this.items.length);
    this.items.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, f.c); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    return shadowed(im);
  }
}

/* ---------- sky + reflections ---------- */
export function skyDome(stops, radius = 150) {
  const map = canvasTexture(16, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  return mesh;
}

/** Bake an environment's sky into a reflection map (gives eyes, tusks and water their shine). */
export function makeEnvMap(renderer, env) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(env.sky.geometry, env.sky.material));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  sun.position.copy(env.sunDirection).multiplyScalar(60); s.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose(); sun.geometry.dispose(); sun.material.dispose();
  return tex;
}

/** Sun + sky light with shadows, aimed at the creature. */
export function sunRig({ direction, sunColor, sunIntensity, skyColor, groundColor, skyIntensity, rimColor = 0x9cc3ff, rimIntensity = 1.5 }) {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(skyColor, groundColor, skyIntensity));
  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  sun.position.copy(direction).multiplyScalar(14); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -5; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  sun.target.position.set(0.6, 2.5, 0);
  const rim = new THREE.DirectionalLight(rimColor, rimIntensity);
  rim.position.set(-direction.x * 10, 5, -direction.z * 10);
  g.add(sun, sun.target, rim);
  return g;
}

/** Free GPU memory for a creature or environment that is no longer shown. */
export function disposeObject(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      for (const k of ['map', 'normalMap', 'bumpMap', 'roughnessMap']) if (m[k] && !m[k].userData.shared) m[k].dispose();
      m.dispose();
    });
  });
}

/* ---------- general-purpose parts used by the hybrid creatures ---------- */
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));

/**
 * Sweep an ellipse along a curve. hFn/wFn give the two radii along the way.
 * planar = true keeps "up" in the XY plane (torsos, necks, tails); false follows the curve freely (legs, horns).
 * Returns { geo, sample(t, angle) } where sample gives a surface point, its normal and the direction of travel.
 */
export function sweep(curve, segs, radial, hFn, wFn = hFn, planar = false) {
  const fr = planar ? null : curve.computeFrenetFrames(segs, false);
  const rings = [], pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, P = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
    let U, B;
    if (planar) { U = new V3(-T.y, T.x, 0); if (U.lengthSq() < 1e-8) U.set(0, 1, 0); U.normalize(); B = new V3(0, 0, 1); }
    else { U = fr.normals[i].clone(); B = fr.binormals[i].clone(); }
    const h = hFn(t), w = wFn(t); rings.push({ P, T, U, B, h, w });
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(P.x + U.x * c * h + B.x * s * w, P.y + U.y * c * h + B.y * s * w, P.z + U.z * c * h + B.z * s * w);
      const n = new V3().addScaledVector(U, c * w).addScaledVector(B, s * h).normalize();
      nor.push(n.x, n.y, n.z); uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const sample = (t, a) => {
    const r = rings[Math.round(clamp01(t) * segs)], c = Math.cos(a), s = Math.sin(a);
    return {
      p: r.P.clone().addScaledVector(r.U, c * r.h).addScaledVector(r.B, s * r.w),
      n: new V3().addScaledVector(r.U, c * r.w).addScaledVector(r.B, s * r.h).normalize(),
      T: r.T, h: r.h, center: r.P,
    };
  };
  return { geo, sample, curve };
}

/** Surface coverings. aspect = width relative to length. */
export const STYLES = {
  fur: { len: 0.24, aspect: 0.5, lift: 0.3 },
  shag: { len: 0.5, aspect: 0.3, lift: 0.42 },
  scale: { len: 0.15, aspect: 2.4, lift: 0.07 },
  bigscale: { len: 0.24, aspect: 2.2, lift: 0.06 },
  feather: { len: 0.3, aspect: 1.2, lift: 0.17 },
};

/** Scatter fur, scales or feathers over a swept surface. */
export function cover(batch, sw, rnd, { count, t0 = 0.02, t1 = 0.98, style, S = 1, color, flow = -1, filter = null }) {
  for (let k = 0; k < count; k++) {
    const t = rnd.range(t0, t1), a = rnd.range(0, Math.PI * 2), s = sw.sample(t, a);
    if (s.h < 0.015) continue;
    const ctx = { t, up: s.n.y, side: s.n.z, p: s.p, rnd, center: s.center };
    if (filter && !filter(ctx)) continue;
    const st = typeof style === 'function' ? style(ctx) : style;
    const len = st.len * S * rnd.range(0.8, 1.2);
    batch.add(s.p, s.n, s.T.clone().multiplyScalar(flow), len, st.aspect * len, color(ctx), st.lift);
  }
}

/** Scatter a covering over an ellipsoid (heads, humps). */
export function coverEllipsoid(batch, rnd, C, R, { count, flow, style, S = 1, color, skip = null }) {
  fibSphere(count, rnd, (s) => {
    const p = new V3(C.x + s.x * R[0], C.y + s.y * R[1], C.z + s.z * R[2]);
    if (skip && skip(s, p)) return;
    const n = new V3(s.x / R[0], s.y / R[1], s.z / R[2]).normalize();
    const st = typeof style === 'function' ? style(s, p) : style;
    const len = st.len * S * rnd.range(0.8, 1.2);
    batch.add(p, n, flow, len, st.aspect * len, color(s, p), st.lift);
  });
}

export const stdMat = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.3, ...extra });

export function tubeMesh(parent, pts, rFn, mat, segs = 16, radial = 10) {
  const m = shadowed(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3(pts), segs, radial, rFn).geo, mat));
  parent.add(m); return m;
}

let _wrinkle = null;
export function wrinkleTexture() {
  if (_wrinkle) return _wrinkle;
  const rnd = makeRng(77);
  _wrinkle = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const x = rnd.range(0, 256), y = rnd.range(0, 256), l = rnd.range(10, 60), a = rnd.range(-0.5, 0.5) + (rnd() < 0.5 ? 0 : 1.57);
      g.strokeStyle = `rgba(${rnd() < 0.6 ? '30,30,30' : '210,210,210'},${rnd.range(0.15, 0.5)})`; g.lineWidth = rnd.range(0.6, 2);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { srgb: false, repeat: 3 });
  _wrinkle.userData.shared = true;
  return _wrinkle;
}

/** One eye: glossy iris and pupil. Returns nothing; adds to parent. */
export function addEye(parent, pos, r, { iris = 0x2a1a0a, slit = false, sg = 1 } = {}) {
  const irisM = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: iris, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 }));
  irisM.position.copy(pos);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 }));
  pupil.scale.set(slit ? 0.35 : 1, 1, 0.45); pupil.position.set(pos.x + r * 0.08, pos.y, pos.z + sg * r * 0.78);
  parent.add(irisM, pupil);
}
