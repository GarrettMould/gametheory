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
  build() {
    const mat = new THREE.MeshStandardMaterial({ map: featherTexture(), roughness: 0.75, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.22 });
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
  const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 8; sc.bottom = -4; sc.near = 1; sc.far = 40;
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
