// Slot 3: the animal that gives the creature its legs and the way it moves.
import * as THREE from 'three';
import { V3, hsl, lerp, sweep, cover, STYLES, stdMat, ellipsoid, shadowed, tubeMesh } from '../../kit.js';
import { cheetahColor } from './bodies.js';

const R = (c, a, b) => c.rnd.range(a, b);

// len: leg length · rU/rL: thickness at hip and ankle · sprawl: legs splay sideways (reptile stance)
export const LEGS = {
  hare: { len: 0.85, rU: 0.15, rL: 0.065, hindBulk: 2.1, hindFoot: 'long', foot: 'paw', base: 0x7a5c3e, style: STYLES.fur, tail: 'puff', echo: 'ears',
    color: (c) => (c.lower ? hsl(0.085, 0.3, R(c, 0.5, 0.62)) : hsl(0.075, 0.38, R(c, 0.3, 0.42))) },
  impala: { len: 1.9, rU: 0.15, rL: 0.05, foot: 'hoof', base: 0xa9703c, style: STYLES.fur, echo: 'lyre',
    color: (c) => (c.lower && c.t > 0.75 ? hsl(0.07, 0.3, 0.07) : c.side * c.sg < -0.3 ? hsl(0.1, 0.35, R(c, 0.72, 0.84)) : hsl(0.07, 0.55, R(c, 0.4, 0.5))) },
  gazelle: { len: 1.7, rU: 0.14, rL: 0.045, foot: 'hoof', base: 0xb98a55, style: STYLES.fur, echo: 'ghorns', stripe: true,
    color: (c) => (c.side * c.sg < -0.3 ? hsl(0.1, 0.3, R(c, 0.8, 0.9)) : hsl(0.085, 0.5, R(c, 0.5, 0.6))) },
  cheetah: { len: 1.6, rU: 0.2, rL: 0.08, foot: 'paw', base: 0xc9983f, style: STYLES.fur, tail: 'cheetah', color: cheetahColor },
  dragonfly: { len: 1.15, rU: 0.05, rL: 0.028, foot: 'hook', base: 0x16181a, rough: 0.3, style: null, wings: true },
  tortoise: { len: 0.7, rU: 0.3, rL: 0.27, foot: 'stump', base: 0x55513f, style: STYLES.bigscale, sprawl: 0.22,
    color: (c) => hsl(0.14, 0.12, R(c, 0.22, 0.34)) },
  olm: { len: 0.42, rU: 0.075, rL: 0.05, foot: 'toes', base: 0xf1cdc4, rough: 0.35, style: null, sprawl: 0.65, gills: true },
  falcon: { len: 1.0, rU: 0.24, rL: 0.055, foot: 'talon', base: 0x3a4250, lowerBase: 0xe9b81e, style: STYLES.feather, coverLower: false, wingsFolded: true,
    color: (c) => (Math.sin(c.t * 30) > 0.3 ? hsl(0.6, 0.15, R(c, 0.14, 0.2)) : hsl(0.1, 0.3, R(c, 0.74, 0.86))) },
  komodo: { len: 0.65, rU: 0.22, rL: 0.14, foot: 'claws', base: 0x4a4238, style: STYLES.scale, sprawl: 0.7, tail: 'long', tailLen: 3.0,
    color: (c) => hsl(R(c, 0.06, 0.1), 0.16, R(c, 0.2, 0.32)) },
  generic: { len: 1.1, rU: 0.16, rL: 0.08, foot: 'paw', base: 0x6e5a44, style: STYLES.fur, color: (c) => hsl(0.08, 0.3, R(c, 0.3, 0.42)) },
};

function foot(root, type, F, S, cfg, sg, front) {
  const col = cfg.lowerBase || cfg.base, rL = cfg.rL * S;
  const toes = (angles, len, clawCol, r0) => {
    const m = stdMat(col, cfg.rough || 0.6), cm = stdMat(clawCol, 0.3);
    angles.forEach((a) => {
      const tip = new V3(F.x + Math.cos(a) * len, 0.02 * S, F.z + Math.sin(a) * len), mid = F.clone().lerp(tip, 0.5); mid.y = 0.05 * S;
      tubeMesh(root, [F, mid, tip], (t) => r0 * (1 - 0.5 * t), m, 6, 7);
      const claw = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r0 * 0.7, r0 * 3.2, 7), cm));
      claw.position.set(tip.x + Math.cos(a) * r0 * 1.2, 0.03 * S, tip.z + Math.sin(a) * r0 * 1.2); claw.rotation.set(0, -a, -Math.PI / 2 - 0.25); root.add(claw);
    });
  };
  if (type === 'hoof') {
    const h = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rL * 1.25, rL * 1.75, 0.16 * S, 10), stdMat(0x121010, 0.35))); h.position.set(F.x + rL * 0.3, 0.08 * S, F.z); root.add(h);
  } else if (type === 'paw') {
    const p = ellipsoid([rL * 2.3, rL * 1.15, rL * 1.9], col, { roughness: 0.8 }); p.position.set(F.x + rL * 1.1, rL * 1.0, F.z); root.add(p);
  } else if (type === 'long') {
    const p = ellipsoid([0.42 * S, rL * 1.3, rL * 1.9], col, { roughness: 0.8 }); p.position.set(F.x + 0.3 * S, rL * 1.1, F.z); root.add(p);
  } else if (type === 'stump') {
    const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rL * 1.02, rL * 1.15, 0.2 * S, 14), stdMat(col, 0.9))); p.position.set(F.x, 0.1 * S, F.z); root.add(p);
    for (let i = -1.5; i <= 1.5; i++) { const n = ellipsoid([rL * 0.26, rL * 0.3, rL * 0.2], 0xd8cfb4, { roughness: 0.4 }); n.position.set(F.x + rL * 1.05 * Math.cos(i * 0.5), 0.07 * S, F.z + rL * 1.05 * Math.sin(i * 0.5)); root.add(n); }
  } else if (type === 'talon') toes([-0.55, 0, 0.55, Math.PI], 0.3 * S, 0x0d0d0d, 0.04 * S);
  else if (type === 'claws') toes([-0.7, -0.25, 0.25, 0.7], 0.3 * S, 0x15130f, 0.05 * S);
  else if (type === 'toes') toes([-0.6, 0, 0.6], 0.14 * S, 0xe9b9ae, 0.022 * S);
  else toes([-0.5, 0.5], 0.1 * S, 0x16181a, 0.014 * S);
}

/** Build one leg from the hip down to the ground (y = 0). Returns where the foot lands. */
export function buildLeg(root, batch, rnd, hip, { front, sg, cfg, S, wrap, thick = 1, tint = (m) => m }) {
  const H = hip.y, sp = cfg.sprawl || 0, bulk = (!front && cfg.hindBulk) || 1;
  const rU = cfg.rU * S * bulk * thick, rM = (cfg.rU * 0.5 + cfg.rL * 0.5) * S * (bulk > 1 ? 1.25 : 1) * thick, rL = cfg.rL * S * thick;
  const fwd = sp ? 0.3 : 1, longFoot = !front && cfg.hindFoot === 'long';
  const knee = new V3(hip.x + (front ? 0.05 : 0.17) * H * fwd, H * (sp ? 0.72 : 0.5), hip.z + sg * sp * H * 0.95);
  const ankle = new V3(hip.x + (front ? -0.03 : longFoot ? -0.3 : -0.17) * H * fwd, H * (longFoot ? 0.1 : front ? 0.1 : 0.2) + 0.05 * S, hip.z + sg * sp * H * 1.15);
  const F = new V3(ankle.x + (front || longFoot ? 0 : 0.05 * H), 0.05 * S, ankle.z);
  const top = hip.clone(); top.y += rU * 0.6;
  const upper = sweep(new THREE.CatmullRomCurve3([top, hip.clone().lerp(knee, 0.5), knee]), 10, 12, (t) => lerp(rU, rM, t));
  const lower = sweep(new THREE.CatmullRomCurve3([knee, ankle, F]), 12, 10, (t) => lerp(rM, rL, Math.min(1, t * 1.3)));
  const mU = tint(stdMat(cfg.base, cfg.rough || 0.8, { side: THREE.DoubleSide })), mL = cfg.lowerBase ? stdMat(cfg.lowerBase, 0.5, { side: THREE.DoubleSide }) : mU;
  root.add(shadowed(new THREE.Mesh(upper.geo, mU)), shadowed(new THREE.Mesh(lower.geo, mL)));
  const j = shadowed(new THREE.Mesh(new THREE.SphereGeometry(rM * 1.05, 12, 10), cfg.lowerBase ? mL : mU)); j.position.copy(knee); root.add(j);
  if (cfg.style) {
    const n = Math.round((cfg.style === STYLES.fur ? 230 : 130) * Math.min(2.2, 0.6 + H * 0.5) * bulk * thick);
    const st = { ...cfg.style, lift: Math.min(cfg.style.lift, 0.13) }, k = cfg.style === STYLES.fur ? 0.6 : 0.85;
    cover(batch, upper, rnd, { count: n, style: st, S: S * k, flow: 1, color: (c) => wrap(cfg.color)({ ...c, sg, lower: false }) });
    if (cfg.coverLower !== false) cover(batch, lower, rnd, { count: Math.round(n * 0.7), t1: 0.9, style: { ...st, len: st.len * 0.6 }, S: S * k, flow: 1, color: (c) => wrap(cfg.color)({ ...c, sg, lower: true }) });
  }
  foot(root, longFoot ? 'long' : cfg.foot, F, S * (0.6 + 0.4 * thick), { ...cfg, rL: cfg.rL * thick / (0.6 + 0.4 * thick) }, sg, front);
  return F;
}
