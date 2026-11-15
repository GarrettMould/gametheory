// Tails, wings, horns, ears, shells and the four power-ups.
import * as THREE from 'three';
import { V3, hsl, fbm, lerp, sweep, cover, coverEllipsoid, STYLES, stdMat, ellipsoid, shadowed, tubeMesh, canvasTexture, makeRng, wrinkleTexture, FeatherBatch } from '../../kit.js';
import { cheetahColor } from './bodies.js';

const BONE = 0xcbb894, IVORY = 0xf1e6cb;

/* ---------- tails ---------- */
export function buildTail(root, batch, rnd, { type, base, S, r0, body, legs, wrap, fat = 1 }) {
  const fromLegs = legs.tail === type && legs.color, skinColor = fromLegs ? legs.color : (c) => body.color({ ...c, t: 0.06 });
  const skinStyle = fromLegs ? legs.style : body.style, baseCol = fromLegs ? legs.base : body.base;
  const mat = stdMat(baseCol, body.rough || 0.85, { side: THREE.DoubleSide });
  let tip = base.clone();
  if (type === 'long') {
    const len = (legs.tailLen || body.tailLen || 2.6) * S;
    const pts = [base, new V3(base.x - len * 0.3, Math.max(base.y * 0.6, 0.3 * S), 0), new V3(base.x - len * 0.66, 0.2 * S, 0), new V3(base.x - len, 0.09 * S, 0)];
    const sw = sweep(new THREE.CatmullRomCurve3(pts), 30, 16, (t) => r0 * fat * Math.pow(1 - t, 0.8) + 0.025 * S, (t) => (r0 * fat * Math.pow(1 - t, 0.8) + 0.025 * S) * 0.85, true);
    root.add(shadowed(new THREE.Mesh(sw.geo, mat)));
    if (skinStyle) cover(batch, sw, rnd, { count: 700, style: skinStyle, S, flow: 1, color: wrap(skinColor) });
    if (body.extras === 'scutes') spikes(root, sw, S, 0.05, 0.9, 0.05, [0], 0x2a2f1e, 0.75);
    tip = pts[3];
  } else if (type === 'cheetah') {
    const len = 2.5 * S;
    const pts = [base, new V3(base.x - len * 0.35, base.y - 0.5 * S, 0), new V3(base.x - len * 0.8, base.y - 0.8 * S, 0), new V3(base.x - len, base.y - 0.35 * S, 0)];
    const sw = sweep(new THREE.CatmullRomCurve3(pts), 26, 12, (t) => lerp(0.12, 0.075, t) * S, undefined, true);
    root.add(shadowed(new THREE.Mesh(sw.geo, stdMat(0xc9983f, 0.85, { side: THREE.DoubleSide }))));
    cover(batch, sw, rnd, { count: 520, style: STYLES.fur, S: S * 0.8, flow: 1,
      color: (c) => (c.t > 0.93 ? hsl(0.1, 0.1, 0.92) : c.t > 0.7 ? (Math.sin(c.t * 60) > 0 ? hsl(0.08, 0.2, 0.06) : hsl(0.11, 0.6, 0.6)) : wrap(cheetahColor)(c)) });
    tip = pts[3];
  } else if (type === 'tuft' || type === 'thin') {
    const pts = [base, new V3(base.x - 0.28 * S, base.y - 0.5 * S, 0), new V3(base.x - 0.32 * S, base.y - 1.05 * S, 0)];
    tubeMesh(root, pts, (t) => (0.07 - 0.03 * t) * S, mat, 10, 8);
    for (let i = 0; i < 26; i++) batch.add(pts[2].clone().add(new V3(rnd.range(-0.04, 0.04), rnd.range(-0.05, 0.1), rnd.range(-0.04, 0.04))), new V3(rnd.range(-1, 1), 0, rnd.range(-1, 1)).normalize(), new V3(0, -1, 0), rnd.range(0.3, 0.5) * S, 0.07 * S, hsl(0.07, 0.3, rnd.range(0.05, 0.12)), 0.1);
    tip = pts[2];
  } else if (type === 'short') {
    const C = new V3(base.x - 0.12 * S, base.y + 0.02 * S, 0), Rr = [0.2 * S, 0.11 * S, 0.11 * S];
    const m = ellipsoid(Rr, 0xe8dcc0); m.position.copy(C); m.rotation.z = 0.5; root.add(m);
    coverEllipsoid(batch, rnd, C, Rr, { count: 60, flow: new V3(-1, -0.6, 0), style: STYLES.fur, S, color: (s) => (s.y > 0.2 ? wrap(skinColor)({ t: 0.3, up: 1, side: 0, p: C, rnd }) : hsl(0.1, 0.4, rnd.range(0.8, 0.92))) });
    tip = C;
  } else if (type === 'fan') {
    for (let k = -5; k <= 5; k++) batch.add(new V3(base.x + 0.1 * S, base.y, k * 0.035 * S), new V3(0, 1, 0), new V3(-1, -0.18, k * 0.07), rnd.range(0.85, 1.0) * S, 0.3 * S, k % 2 ? hsl(0.61, 0.2, rnd.range(0.16, 0.22)) : hsl(0.61, 0.15, rnd.range(0.28, 0.36)), 0.02);
    tip = new V3(base.x - 0.8 * S, base.y - 0.15 * S, 0);
  } else if (type === 'puff') {
    const C = new V3(base.x - 0.1 * S, base.y + 0.05 * S, 0), Rr = [0.2 * S, 0.2 * S, 0.2 * S];
    const m = ellipsoid(Rr, 0xf2efe6); m.position.copy(C); root.add(m);
    coverEllipsoid(batch, rnd, C, Rr, { count: 120, flow: new V3(-1, 0.6, 0), style: STYLES.fur, S, color: () => hsl(0.1, 0.1, rnd.range(0.85, 0.97)) });
    tip = C;
  }
  return tip;
}

function spikes(root, sw, S, t0, t1, step, angles, color, size = 1, metal = false) {
  const geo = new THREE.ConeGeometry(0.075 * S * size, 0.2 * S * size, 5);
  const mat = metal ? stdMat(color, 0.38, { metalness: 0.75, envMapIntensity: 0.9 }) : stdMat(color, 0.7);
  const up = new V3(0, 1, 0);
  for (let t = t0; t <= t1; t += step) for (const a of angles) {
    const s = sw.sample(t, a); if (s.h < 0.06 * S) continue;
    const m = shadowed(new THREE.Mesh(geo, mat)); m.position.copy(s.p).addScaledVector(s.n, 0.07 * S * size);
    m.quaternion.setFromUnitVectors(up, s.n); root.add(m);
  }
}
export const crocScutes = (root, torso, S) => spikes(root, torso, S, 0.08, 0.94, 0.045, [0.3, -0.3, 0.75, -0.75], 0x2a2f1e, 0.8);

/* ---------- wings ---------- */
let _vein = null;
function veinTexture() {
  if (_vein) return _vein;
  const rnd = makeRng(5);
  _vein = canvasTexture(512, 128, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = 'rgba(20,30,40,.75)'; g.lineWidth = 2.2;
    for (const y of [20, 44, 64, 88]) { g.beginPath(); g.moveTo(0, 64); g.bezierCurveTo(120, y, 380, y, 512, 64); g.stroke(); }
    g.lineWidth = 0.9; g.strokeStyle = 'rgba(20,30,40,.5)';
    for (let x = 14; x < 512; x += 14) { g.beginPath(); g.moveTo(x + rnd.range(-4, 4), 8); g.lineTo(x + rnd.range(-6, 6), 120); g.stroke(); }
    g.fillStyle = 'rgba(40,30,20,.85)'; g.fillRect(440, 22, 36, 12);   // the dark wing-spot dragonflies have
  });
  _vein.userData.shared = true;
  return _vein;
}
/** Four translucent veined wings. Returns the parts to flutter. */
export function dragonflyWings(root, anchor, S) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xd6eef5, map: veinTexture(), transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, iridescence: 0.8, envMapIntensity: 1 });
  const flaps = [];
  [[0.2, 2.9, 0.62, 0.22, 0.2], [-0.3, 2.6, 0.72, -0.3, 0.08]].forEach(([dx, span, chord, sweepA, rise]) => {
    const sh = new THREE.Shape(); span *= S; chord *= S;
    sh.moveTo(0, 0); sh.bezierCurveTo(span * 0.3, chord * 0.55, span * 0.9, chord * 0.5, span, 0); sh.bezierCurveTo(span * 0.9, -chord * 0.5, span * 0.3, -chord * 0.4, 0, 0);
    const geo = new THREE.ShapeGeometry(sh, 10), pa = geo.attributes.position, ua = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) ua.setXY(i, pa.getX(i) / span, pa.getY(i) / chord * 0.5 + 0.5);
    geo.rotateX(-Math.PI / 2);
    for (const sg of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(anchor.x + dx * S, anchor.y, sg * 0.12 * S);
      pivot.rotation.y = sg * (-Math.PI / 2 + sweepA);
      const flap = new THREE.Group(); flap.rotation.z = rise; flap.userData.rest = rise;
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; flap.add(m); pivot.add(flap); root.add(pivot); flaps.push(flap);
    }
  });
  return flaps;
}
/** Feathered wings folded along the flanks. */
export function foldedWings(batch, rnd, torso, S) {
  for (const sg of [1, -1]) {
    for (let i = 0; i < 150; i++) {
      const t = rnd.range(0.28, 0.84), a = sg * (Math.PI / 2 + rnd.range(-0.95, 0.5)), s = torso.sample(t, a), low = sg * (a - sg * Math.PI / 2) > 0.1;
      const len = (0.4 + 0.55 * (0.84 - t)) * S * rnd.range(0.85, 1.15);
      batch.add(s.p.clone().addScaledVector(s.n, 0.05 * S), s.n, new V3(-1, -0.2, 0), len, len * 1.0, low ? hsl(0.61, 0.2, rnd.range(0.1, 0.16)) : hsl(0.6, 0.22, rnd.range(0.2, 0.3)), 0.1);
    }
    for (let k = 0; k < 8; k++) {
      const s = torso.sample(0.3 - k * 0.012, sg * (Math.PI / 2 + 0.1 + k * 0.05));
      batch.add(s.p.clone().addScaledVector(s.n, 0.07 * S), s.n, new V3(-1, -0.12 - k * 0.02, 0), rnd.range(1.1, 1.35) * S, 0.3 * S, hsl(0.62, 0.18, rnd.range(0.08, 0.13)), 0.03);
    }
  }
}

/* ---------- things that sit on the head (built in head units) ---------- */
export function antlers(g, hd) {
  const mat = stdMat(BONE, 0.6), c = hd.crown;
  for (const sg of [1, -1]) {
    const pts = [new V3(c.x, c.y - 0.06, sg * 0.14), new V3(c.x - 0.12, c.y + 0.5, sg * 0.45), new V3(c.x - 0.28, c.y + 1.0, sg * 0.72), new V3(c.x - 0.12, c.y + 1.5, sg * 0.8), new V3(c.x + 0.18, c.y + 1.85, sg * 0.62)];
    const curve = new THREE.CatmullRomCurve3(pts);
    tubeMesh(g, pts, (t) => 0.075 - 0.05 * t, mat, 28, 9);
    [[0.12, 0.5, 0.12, 0.55], [0.36, 0.42, 0.3, 0.4], [0.6, 0.4, 0.34, 0.32], [0.8, 0.3, 0.3, 0.24]].forEach(([t, fx, fy, len]) => {
      const p = curve.getPointAt(t), d = new V3(fx, fy, sg * 0.12).normalize(), q = p.clone().addScaledVector(d, len), mid = p.clone().addScaledVector(d, len * 0.55); mid.y -= 0.05;
      tubeMesh(g, [p, mid, q], (u) => 0.045 - 0.035 * u, mat, 8, 7);
    });
  }
}
export function horns(g, hd, kind) {
  const k = kind === 'lyre' ? 1 : 0.62, mat = stdMat(0x1c1815, 0.45), c = hd.crown;
  for (const sg of [1, -1]) tubeMesh(g, [new V3(c.x, c.y - 0.05, sg * 0.12), new V3(c.x - 0.16 * k, c.y + 0.5 * k, sg * (0.12 + 0.2 * k)), new V3(c.x - 0.32 * k, c.y + 0.95 * k, sg * (0.12 + 0.32 * k)), new V3(c.x - 0.22 * k, c.y + 1.35 * k, sg * (0.12 + 0.2 * k)), new V3(c.x, c.y + 1.62 * k, sg * (0.12 + 0.24 * k))], (t) => 0.06 - 0.048 * t, mat, 24, 9);
}
export function hareEars(g, hd) {
  const c = hd.crown;
  for (const sg of [1, -1]) {
    const ear = new THREE.Group(); ear.position.set(c.x - 0.06, c.y - 0.05, sg * 0.15); ear.rotation.set(sg * 0.2, 0, 0.3);
    const o = ellipsoid([0.07, 0.6, 0.17], 0x7a5c3e); o.position.y = 0.55; ear.add(o);
    const i = ellipsoid([0.03, 0.5, 0.11], 0xd9a08f, { roughness: 0.6 }); i.position.set(0.05, 0.53, 0); ear.add(i);
    const tip = ellipsoid([0.06, 0.12, 0.12], 0x14100c); tip.position.y = 1.07; ear.add(tip);
    g.add(ear);
  }
}
let _ear = null;
function earTexture() {
  if (_ear) return _ear;
  const rnd = makeRng(12);
  _ear = canvasTexture(256, 256, (g) => {
    const gr = g.createRadialGradient(20, 128, 10, 60, 128, 250);
    gr.addColorStop(0, '#8a7f7a'); gr.addColorStop(0.45, '#7a7571'); gr.addColorStop(0.85, '#625d5a'); gr.addColorStop(1, '#4a4644');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 22; i++) {   // veins fanning out from where the ear joins the head
      const a = rnd.range(-1.1, 1.1); g.strokeStyle = `rgba(50,44,42,${rnd.range(0.2, 0.45)})`; g.lineWidth = rnd.range(1, 2.4);
      g.beginPath(); g.moveTo(0, 128); g.quadraticCurveTo(120, 128 + Math.sin(a) * 70, 250, 128 + Math.sin(a) * 190); g.stroke();
    }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '40,36,34' : '170,160,152'},.18)`; g.fillRect(rnd.range(0, 256), rnd.range(0, 256), 3, 3); }
  });
  _ear.userData.shared = true;
  return _ear;
}
export function elephantEarsAndTusks(g, hd) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.32); sh.bezierCurveTo(-0.5, 0.95, -1.35, 0.75, -1.3, -0.1); sh.bezierCurveTo(-1.25, -0.95, -0.4, -1.05, 0, -0.38); sh.lineTo(0, 0.32);
  const geo = new THREE.ShapeGeometry(sh, 16), pa = geo.attributes.position, ua = geo.attributes.uv;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); ua.setXY(i, -x / 1.35, (y + 1.05) / 2.1); pa.setZ(i, 0.16 * (x * x + y * y * 0.6)); }
  geo.computeVertexNormals();
  const mat = stdMat(0xffffff, 0.9, { side: THREE.DoubleSide, map: earTexture(), bumpMap: wrinkleTexture(), bumpScale: 1.5 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: IVORY, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.45 });
  const ears = [];
  for (const sg of [1, -1]) {
    const e = shadowed(new THREE.Mesh(geo, mat)); e.position.set(-0.05, 0.08, sg * hd.halfW * 0.95); e.rotation.y = sg * 0.62; e.userData.rest = sg * 0.62; g.add(e); ears.push(e);
    tubeMesh(g, [new V3(0.22, -0.16, sg * hd.halfW * 0.6), new V3(0.55, -0.55, sg * (hd.halfW * 0.6 + 0.1)), new V3(0.98, -0.62, sg * (hd.halfW * 0.6 + 0.14)), new V3(1.32, -0.36, sg * (hd.halfW * 0.6 + 0.12))], (t) => 0.07 - 0.055 * t, ivory, 20, 10);
  }
  return ears;
}
export function brows(g, hd, strat) {
  if (strat !== 'cheat' && strat !== 'grudger') return;
  for (const e of hd.eyes) {
    const b = ellipsoid([e.r * (strat === 'grudger' ? 1.7 : 1.5), e.r * (strat === 'grudger' ? 0.5 : 0.32), e.r * 0.7], 0x0e0c0a, { roughness: 0.6 });
    b.position.set(e.p.x + e.r * 0.2, e.p.y + e.r * 1.05, e.p.z + e.sg * e.r * 0.25); b.rotation.z = strat === 'cheat' ? -0.5 : -0.1; g.add(b);
  }
}

/* ---------- things that sit on the body ---------- */
let _scutes = null;
function scuteTexture() {
  if (_scutes) return _scutes;
  _scutes = canvasTexture(512, 256, (g) => {
    g.fillStyle = '#6a5c38'; g.fillRect(0, 0, 512, 256);
    const rows = 4, cols = 8, cw = 512 / cols, ch = 256 / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
      const x = c * cw + (r % 2 ? cw / 2 : 0) - cw / 2, y = r * ch;
      for (let k = 0; k < 5; k++) {
        const inset = 4 + k * 6; g.strokeStyle = k === 0 ? 'rgba(20,16,8,.9)' : `rgba(${150 + k * 14},${130 + k * 12},${80 + k * 8},.55)`; g.lineWidth = k === 0 ? 5 : 2;
        g.beginPath(); g.roundRect(x + inset, y + inset, cw - inset * 2, ch - inset * 2, 12); g.stroke();
      }
    }
  });
  _scutes.userData.shared = true;
  return _scutes;
}
export function tortoiseShell(root, spine, hF, wF, L, slope) {
  const P = spine.getPointAt(0.5), h = hF(0.5), w = wF(0.5);
  const tex = scuteTexture();
  const m = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 44, 22, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2.5, roughness: 0.55, envMapIntensity: 0.4 })));
  m.scale.set(L * 0.42, h * 1.15, w * 1.14); m.position.set(P.x, P.y + h * 0.12, 0); m.rotation.z = Math.atan(slope); root.add(m);
}
export function olmGills(batch, rnd, at, r, S) {
  for (const sg of [1, -1]) for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++)
    batch.add(new V3(at.x - i * 0.07 * S, at.y + 0.04 * S, sg * r * 0.9), new V3(0, 0.2, sg).normalize(), new V3(-0.6, 0.35 + i * 0.3 + k * 0.08, sg * 0.5), rnd.range(0.32, 0.5) * S, 0.1 * S, hsl(0.985, 0.7, rnd.range(0.45, 0.6)), 0.75);
}
export function crabClaws(root, spine, hF, wF, S) {
  const shell = stdMat(0xc46a2a, 0.35), pale = stdMat(0xf0d6ac, 0.35);
  const P = spine.getPointAt(0.82), w = wF(0.82);
  [[1, 0.72], [-1, 0.34]].forEach(([sg, k]) => {
    const sh = new V3(P.x, P.y, sg * w * 0.85), el = new V3(P.x + 0.5 * S * k + 0.2 * S, P.y + 0.25 * S * k, sg * (w + 0.35 * S * k)), wr = new V3(P.x + 1.0 * S * k + 0.3 * S, P.y + 0.05 * S, sg * (w * 1.05 + 0.35 * S * k));
    tubeMesh(root, [sh, el, wr], (t) => (0.13 - 0.03 * t) * S * (0.5 + k * 0.5), shell, 12, 10);
    const palm = ellipsoid([0.62 * S * k, 0.42 * S * k, 0.2 * S * k], 0xd9772e, { roughness: 0.35 }); palm.position.set(wr.x + 0.4 * S * k, wr.y, wr.z); root.add(palm);
    const a = new V3(wr.x + 0.8 * S * k, wr.y + 0.15 * S * k, wr.z);
    tubeMesh(root, [a, a.clone().add(new V3(0.5 * S * k, 0.14 * S * k, 0)), a.clone().add(new V3(0.95 * S * k, -0.1 * S * k, 0))], (t) => (0.17 - 0.14 * t) * S * k, pale, 12, 10);
    const b = new V3(wr.x + 0.8 * S * k, wr.y - 0.2 * S * k, wr.z);
    tubeMesh(root, [b, b.clone().add(new V3(0.45 * S * k, -0.16 * S * k, 0)), b.clone().add(new V3(0.9 * S * k, 0.0, 0))], (t) => (0.13 - 0.1 * t) * S * k, pale, 12, 10);
  });
}

/* ---------- power-ups ---------- */
/** Armor: rows of overlapping metal plates over the back and neck, a spiked spine, shoulder guards. */
export function armor(root, front, torso, neck, hips, S) {
  const rnd = makeRng(31), plates = new FeatherBatch(), neckPlates = new FeatherBatch();
  const steel = () => hsl(0.58, 0.08, rnd.range(0.52, 0.68));
  for (let i = 0; i < 12; i++) for (let j = 0; j < 9; j++) {
    const s = torso.sample(0.08 + i * 0.075, -1.3 + j * 0.325 + (i % 2) * 0.16); if (s.h < 0.1 * S) continue;
    plates.add(s.p.clone().addScaledVector(s.n, 0.045 * S), s.n, s.T.clone().negate(), 0.5 * S, 0.56 * S, steel(), 0.1);
  }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const s = neck.sample(0.12 + i * 0.18, -0.9 + j * 0.45);
    neckPlates.add(s.p.clone().addScaledVector(s.n, 0.03 * S), s.n, s.T.clone().negate(), 0.32 * S, 0.36 * S, steel(), 0.1);
  }
  const metal = { metalness: 0.8, roughness: 0.36, envMapIntensity: 1.0 };
  root.add(plates.build(metal)); front.add(neckPlates.build(metal));
  spikes(root, torso, S, 0.12, 0.92, 0.1, [0], 0x9aa2aa, 1.5, true);
  for (const h of hips) { const g = ellipsoid([0.3 * S, 0.27 * S, 0.09 * S], 0xa9b0b6, { roughness: 0.36, env: 1 }); g.material.metalness = 0.8; g.position.set(h.x, h.y + 0.15 * S, h.z + Math.sign(h.z) * 0.12 * S); root.add(g); }
}
/** Metabolic reserves: fat humps on the back (the body and tail base are also thickened by the assembler). */
export function reserveHumps(root, batch, rnd, spine, hF, wF, body, S, wrap) {
  [[0.46, 1], [0.66, 0.72]].forEach(([t, k]) => {
    const P = spine.getPointAt(t), h = hF(t), C = new V3(P.x, P.y + h * 0.78, 0), Rr = [h * 0.62 * k, h * 0.6 * k, wF(t) * 0.55 * k];
    const m = ellipsoid(Rr, body.base, { roughness: body.rough || 0.85 }); m.position.copy(C);
    if (body.hide) { m.material.bumpMap = wrinkleTexture(); m.material.bumpScale = 1.5; }
    root.add(m);
    if (body.style) coverEllipsoid(batch, rnd, C, Rr, { count: Math.round(260 * k), flow: new V3(-1, -0.3, 0), style: body.style({ t, up: 1 }), S, skip: (s) => s.y < -0.3,
      color: (s, p) => wrap(body.color)({ t, up: s.y, side: s.z, p, rnd }) });
  });
}
/** Camouflage: mottled marsh-and-grass colouring, plus a fringe of leaf-like tufts along the back. */
export function camoWrap(rnd) {
  const olive = new THREE.Color(0x5a5f2e);
  return (fn) => (c) => {
    const n = fbm(c.p.x * 1.3 + 7, c.p.y * 1.3 + c.p.z * 1.7, 3);
    if (n > 0.57) return hsl(rnd.range(0.24, 0.3), 0.38, rnd.range(0.14, 0.26));
    if (n < 0.4) return hsl(rnd.range(0.1, 0.13), 0.34, rnd.range(0.3, 0.44));
    return fn(c).lerp(olive, 0.4);
  };
}
export function camoFringe(batch, rnd, torso, S) {
  for (let i = 0; i < 46; i++) {
    const s = torso.sample(rnd.range(0.08, 0.95), rnd.range(-0.8, 0.8)); if (s.h < 0.1 * S) continue;
    const len = rnd.range(0.35, 0.6) * S;
    batch.add(s.p, s.n, s.T.clone().negate(), len, len * 0.5, rnd() < 0.3 ? hsl(0.12, 0.4, rnd.range(0.35, 0.5)) : hsl(rnd.range(0.24, 0.31), 0.42, rnd.range(0.18, 0.32)), 0.7);
  }
}
/** Pack coordination: a stiff black-and-white signal crest down the neck and spine, and a white flank blaze. */
export function packCrest(batch, frontBatch, rnd, torso, neck, S) {
  const put = (b, sw, t, k) => {
    const s = sw.sample(t, rnd.range(-0.1, 0.1)); if (s.h < 0.05 * S) return;
    const len = rnd.range(0.42, 0.6) * S;
    b.add(s.p, s.n, s.T.clone().negate(), len, len * 0.24, k % 3 === 0 ? hsl(0.1, 0.05, 0.95) : hsl(0.6, 0.05, 0.06), 1.5);
  };
  let k = 0;
  for (let t = 0.1; t < 0.97; t += 0.012) put(batch, torso, t, k++);
  for (let t = 0.05; t < 0.98; t += 0.03) put(frontBatch, neck, t, k++);
}
export const packWrap = (fn) => (c) => (c.blaze && Math.abs(c.up) < 0.2 && c.t > 0.3 && c.t < 0.76 ? hsl(0.1, 0.05, c.rnd.range(0.88, 0.97)) : fn(c));
export const gazelleStripe = (fn) => (c) => {
  if (!c.blaze || c.t < 0.22 || c.t > 0.82) return fn(c);
  if (c.up < -0.08 && c.up > -0.36) return hsl(0.07, 0.3, c.rnd.range(0.05, 0.1));
  if (c.up <= -0.36) return hsl(0.1, 0.25, c.rnd.range(0.84, 0.94));
  return fn(c);
};
