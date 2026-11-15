// Slot 2: the animal that gives the creature its head and neck (and sometimes one signature trait).
// Heads are built at unit size, facing +X, centred on the origin. The assembler scales and places them.
import * as THREE from 'three';
import { V3, hsl, ellipsoid, FeatherBatch, coverEllipsoid, STYLES, stdMat, tubeMesh, addEye, shadowed, noise2 } from '../../kit.js';
import { pythonColor } from './bodies.js';

const X = new V3(-1, -0.05, 0);   // coverings on a head flow backwards

function ell(g, r, pos, color, rough = 0.8, rotZ = 0) {
  const m = ellipsoid(r, color, { roughness: rough }); m.position.set(pos[0], pos[1], pos[2]); m.rotation.z = rotZ; g.add(m); return m;
}
function cone(g, pos, r, h, mat, rot = [0, 0, 0]) {
  const m = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat)); m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]); g.add(m); return m;
}
function eyePair(g, x, y, z, r, opts, es) {
  const out = [];
  for (const sg of [1, -1]) { const p = new V3(x, y, sg * z); addEye(g, p, r * es, { ...opts, sg }); out.push({ p, r: r * es, sg }); }
  return out;
}
function finish(g, batch) { if (batch.items.length) g.add(batch.build()); }

export const HEADS = {
  /* Anglerfish: huge underbite full of needle teeth, tiny pale eyes, a glowing lure on a stalk. */
  anglerfish({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.56, 0.5, 0.46], [0, 0, 0], 0x2b2420, 0.55);
    ell(g, [0.52, 0.17, 0.43], [0.14, -0.3, 0], 0x231d1a, 0.5, -0.2);
    ell(g, [0.4, 0.1, 0.34], [0.16, -0.2, 0], 0x4a1418, 0.6, -0.2);   // mouth interior
    const tooth = new THREE.MeshPhysicalMaterial({ color: 0xf2efe2, roughness: 0.2, transmission: 0.25, thickness: 0.2, envMapIntensity: 0.6 });
    for (let i = 0; i < 15; i++) {
      const a = -1.25 + (2.5 * i) / 14, cx = Math.cos(a), sz = Math.sin(a);
      cone(g, [0.16 + 0.47 * cx, -0.2 + 0.02 * cx, 0.4 * sz], 0.022, rnd.range(0.2, 0.34), tooth, [0, 0, 0.12]);
      if (i % 2 === 0) cone(g, [0.06 + 0.5 * cx, -0.1, 0.42 * sz], 0.02, rnd.range(0.14, 0.22), tooth, [Math.PI, 0, 0]);
    }
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.56, 0.5, 0.46], { count: 260, flow: X, style: STYLES.scale, color: () => hsl(0.04, 0.2, rnd.range(0.08, 0.15)), skip: (s) => s.x > 0.45 && s.y < 0.1 });
    const eyes = eyePair(g, 0.3, 0.2, 0.36, 0.06, { iris: 0xbfe6f2 }, es);
    const stalk = [new V3(0.05, 0.46, 0), new V3(0.2, 0.86, 0), new V3(0.55, 0.98, 0), new V3(0.84, 0.78, 0)];
    tubeMesh(g, stalk, (t) => 0.035 - 0.02 * t, stdMat(0x2b2420, 0.5), 20, 8);
    const lureMat = new THREE.MeshStandardMaterial({ color: 0xd9fbff, emissive: 0x7fe9ff, emissiveIntensity: 2.2, roughness: 0.3 });
    const lure = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), lureMat); lure.position.copy(stalk[3]); g.add(lure);
    finish(g, b);
    return { g, crown: new V3(-0.05, 0.48, 0), halfW: 0.44, eyes, back: 0.35, neck: { len: 0.35, r: 0.4 }, update: (t) => { lureMat.emissiveIntensity = 1.8 + 0.9 * Math.sin(t * 2.2); } };
  },

  /* Burmese python: flat wedge head, amber slit eyes, forked tongue, on a long patterned neck. */
  python({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.6, 0.2, 0.36], [0.1, 0, 0], 0x7a5a30, 0.6);
    ell(g, [0.34, 0.13, 0.24], [0.52, -0.03, 0], 0x8a6a3c, 0.6);
    coverEllipsoid(b, rnd, new V3(0.1, 0, 0), [0.6, 0.2, 0.36], { count: 420, flow: X, style: STYLES.scale,
      color: (s) => (s.y > 0.2 && Math.abs(s.z) < 0.5 - s.x * 0.25 ? hsl(0.07, 0.5, rnd.range(0.12, 0.18)) : s.y < -0.3 ? hsl(0.12, 0.35, rnd.range(0.66, 0.78)) : hsl(0.105, 0.5, rnd.range(0.46, 0.58))) });
    const eyes = eyePair(g, 0.38, 0.08, 0.27, 0.055, { iris: 0xd99a1c, slit: true }, es);
    const tm = stdMat(0x5a0f18, 0.5);
    tubeMesh(g, [new V3(0.8, -0.05, 0), new V3(1.05, -0.08, 0)], () => 0.014, tm, 4, 6);
    for (const sg of [1, -1]) tubeMesh(g, [new V3(1.05, -0.08, 0), new V3(1.22, -0.06, sg * 0.07)], (t) => 0.012 - 0.008 * t, tm, 4, 6);
    finish(g, b);
    return { g, crown: new V3(0, 0.2, 0), halfW: 0.33, eyes, back: 0.42, tilt: -0.1,
      neck: { len: 1.7, r: 0.25, rise: 0.75, base: 0x7a5a30, style: () => STYLES.scale, color: pythonColor, count: 520 } };
  },

  /* Galápagos tortoise: blunt wrinkled head on a long wrinkled neck, and a domed shell over the body. */
  tortoise({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.42, 0.3, 0.3], [0.05, 0, 0], 0x5b5848, 0.9);
    ell(g, [0.2, 0.16, 0.22], [0.4, -0.06, 0], 0x4f4c3e, 0.9);
    ell(g, [0.2, 0.012, 0.22], [0.4, -0.1, 0], 0x1c1b16, 0.8);   // mouth line
    coverEllipsoid(b, rnd, new V3(0.05, 0, 0), [0.42, 0.3, 0.3], { count: 240, flow: X, style: STYLES.bigscale, color: () => hsl(0.14, 0.12, rnd.range(0.24, 0.36)) });
    const eyes = eyePair(g, 0.24, 0.1, 0.25, 0.05, { iris: 0x14100a }, es);
    finish(g, b);
    return { g, crown: new V3(0, 0.3, 0), halfW: 0.28, eyes, back: 0.3, trait: 'shell',
      neck: { len: 1.35, r: 0.2, rise: 0.6, base: 0x5b5848, style: () => STYLES.bigscale, color: (c) => hsl(0.14, 0.12, c.rnd.range(0.24, 0.36)), count: 300 } };
  },

  /* Emperor penguin: black head, golden ear patches, long slim beak, white bib down the neck. */
  penguin({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.4, 0.38, 0.34], [0, 0, 0], 0x0e0f12, 0.7);
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.4, 0.38, 0.34], { count: 420, flow: X, style: { len: 0.13, aspect: 1.3, lift: 0.12 },
      color: (s) => (s.x < 0.2 && s.x > -0.6 && Math.abs(s.z) > 0.55 && s.y < 0.35 && s.y > -0.6 ? hsl(0.115, 0.95, rnd.range(0.5, 0.6)) : hsl(0.62, 0.1, rnd.range(0.04, 0.08))), skip: (s) => s.x > 0.8 });
    tubeMesh(g, [new V3(0.3, -0.02, 0), new V3(0.75, -0.06, 0), new V3(1.12, -0.16, 0)], (t) => 0.075 - 0.06 * t, stdMat(0x15161a, 0.4), 14, 10);
    tubeMesh(g, [new V3(0.34, -0.07, 0), new V3(0.75, -0.105, 0), new V3(1.0, -0.17, 0)], (t) => 0.05 - 0.035 * t, stdMat(0xf08a2a, 0.45), 12, 8);
    const eyes = eyePair(g, 0.22, 0.08, 0.3, 0.05, { iris: 0x2a1708 }, es);
    finish(g, b);
    return { g, crown: new V3(-0.02, 0.38, 0), halfW: 0.32, eyes, back: 0.3, tilt: -0.05,
      neck: { len: 0.75, r: 0.3, rise: 0.8, base: 0x1a1b1f, style: () => STYLES.feather, count: 320,
        color: (c) => (c.p.x - c.center.x > 0.02 ? (c.t > 0.7 ? hsl(0.13, 0.9, c.rnd.range(0.55, 0.65)) : hsl(0.12, 0.1, c.rnd.range(0.86, 0.95))) : hsl(0.62, 0.1, c.rnd.range(0.05, 0.09))) } };
  },

  /* Peregrine falcon: slate hood, white cheek with a dark "moustache", hooked beak, big dark eyes. */
  falcon({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.4, 0.36, 0.34], [0, 0, 0], 0x3a4250, 0.8);
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.4, 0.36, 0.34], { count: 460, flow: X, style: { len: 0.12, aspect: 1.3, lift: 0.12 }, skip: (s) => s.x > 0.82,
      color: (s) => {
        if (s.y < 0.05 && s.x > 0.05 && s.x < 0.5 && Math.abs(s.z) > 0.5) return hsl(0.62, 0.15, rnd.range(0.07, 0.12));   // moustache stripe
        if (s.y < -0.05) return hsl(0.1, 0.25, rnd.range(0.8, 0.92));
        return hsl(0.61, 0.22, rnd.range(0.18, 0.28));
      } });
    ell(g, [0.1, 0.085, 0.11], [0.4, -0.02, 0], 0xf2c21a, 0.4);   // yellow cere
    tubeMesh(g, [new V3(0.42, -0.02, 0), new V3(0.6, -0.04, 0), new V3(0.68, -0.16, 0), new V3(0.63, -0.27, 0)], (t) => 0.075 - 0.065 * t, stdMat(0x2b3038, 0.3), 16, 10);
    tubeMesh(g, [new V3(0.4, -0.1, 0), new V3(0.56, -0.15, 0)], (t) => 0.045 - 0.02 * t, stdMat(0x3a4048, 0.35), 6, 8);
    const eyes = eyePair(g, 0.2, 0.08, 0.29, 0.075, { iris: 0x0d0a08 }, es);
    const ring = stdMat(0xf2c21a, 0.5);
    for (const e of eyes) { const t = new THREE.Mesh(new THREE.TorusGeometry(e.r * 1.05, 0.012, 8, 24), ring); t.position.set(e.p.x, e.p.y, e.p.z + e.sg * 0.01); g.add(t); }
    finish(g, b);
    return { g, crown: new V3(-0.02, 0.36, 0), halfW: 0.32, eyes, back: 0.3, tilt: -0.05, neck: { len: 0.5, r: 0.28, rise: 0.8 } };
  },

  /* Bar-tailed godwit: small cinnamon head with a very long, slightly upturned bill. */
  godwit({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.3, 0.28, 0.26], [0, 0, 0], 0x8a4f2c, 0.8);
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.3, 0.28, 0.26], { count: 360, flow: X, style: { len: 0.1, aspect: 1.3, lift: 0.12 }, skip: (s) => s.x > 0.85,
      color: (s) => (s.y > 0.25 && s.y < 0.6 && Math.abs(s.z) > 0.3 ? hsl(0.1, 0.4, rnd.range(0.74, 0.84)) : s.y > 0.6 ? hsl(0.07, 0.4, rnd.range(0.2, 0.28)) : hsl(0.055, 0.6, rnd.range(0.38, 0.48))) });
    tubeMesh(g, [new V3(0.25, -0.02, 0), new V3(0.9, -0.08, 0), new V3(1.5, -0.06, 0)], (t) => 0.05 - 0.018 * t, stdMat(0xe08a84, 0.45), 14, 8);
    tubeMesh(g, [new V3(1.48, -0.06, 0), new V3(1.95, -0.01, 0), new V3(2.35, 0.1, 0)], (t) => 0.033 - 0.022 * t, stdMat(0x1f1a18, 0.4), 14, 8);
    const eyes = eyePair(g, 0.14, 0.07, 0.22, 0.045, { iris: 0x120c08 }, es);
    finish(g, b);
    return { g, crown: new V3(-0.02, 0.28, 0), halfW: 0.24, eyes, back: 0.24, tilt: -0.08,
      neck: { len: 1.05, r: 0.16, rise: 0.85, base: 0x8a4f2c, style: () => STYLES.feather, color: (c) => hsl(0.055, 0.6, c.rnd.range(0.36, 0.48)), count: 300 } };
  },

  /* American bison: massive shaggy head carried low, short curved horns, a beard. */
  bison({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.56, 0.6, 0.5], [0, 0, 0], 0x1f140d, 0.9);
    ell(g, [0.32, 0.27, 0.3], [0.5, -0.32, 0], 0x17100b, 0.7);
    ell(g, [0.09, 0.05, 0.2], [0.78, -0.3, 0], 0x0c0908, 0.4);   // nose
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.56, 0.6, 0.5], { count: 620, flow: new V3(-0.5, -1, 0), style: STYLES.shag, color: () => hsl(0.07, 0.4, rnd.range(0.06, 0.13)), skip: (s) => s.x > 0.7 && s.y < 0 });
    for (let i = 0; i < 60; i++) b.add(new V3(rnd.range(0.05, 0.5), -0.5 + rnd.range(-0.06, 0.06), rnd.range(-0.2, 0.2)), new V3(0, -0.4, 1).normalize(), new V3(0.05, -1, 0), rnd.range(0.4, 0.7), 0.12, hsl(0.07, 0.4, rnd.range(0.05, 0.1)), 0.02);   // beard
    const horn = stdMat(0x1a1714, 0.45);
    for (const sg of [1, -1]) tubeMesh(g, [new V3(0.02, 0.3, sg * 0.42), new V3(0.04, 0.38, sg * 0.66), new V3(0.08, 0.6, sg * 0.74), new V3(0.1, 0.78, sg * 0.64)], (t) => 0.085 - 0.07 * t, horn, 16, 10);
    const eyes = eyePair(g, 0.36, 0.06, 0.4, 0.05, { iris: 0x1a0f08 }, es);
    finish(g, b);
    return { g, crown: new V3(-0.05, 0.6, 0), halfW: 0.48, eyes, back: 0.42, tilt: -0.35, horned: true, size: 1.05, neck: { len: 0.3, r: 0.5, rise: 0.05 } };
  },

  /* Dragonfly: enormous iridescent compound eyes, small mandibles, short antennae; brings wings with it. */
  dragonfly({ rnd, es }) {
    const g = new THREE.Group();
    ell(g, [0.3, 0.28, 0.32], [0, 0, 0], 0x1d6b6a, 0.3);
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x2fae6a, roughness: 0.18, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 1, iridescenceIOR: 1.6, envMapIntensity: 1 });
    const eyes = [];
    for (const sg of [1, -1]) {
      const e = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.3 * es, 28, 20), eyeMat)); e.position.set(0.1, 0.1, sg * 0.24); e.scale.set(1, 1.05, 0.9); g.add(e);
      eyes.push({ p: new V3(0.2, 0.12, sg * 0.42), r: 0.2 * es, sg });
    }
    ell(g, [0.14, 0.1, 0.16], [0.3, -0.18, 0], 0xcaa55a, 0.5);
    const dark = stdMat(0x14110f, 0.4);
    for (const sg of [1, -1]) {
      tubeMesh(g, [new V3(0.36, -0.22, sg * 0.1), new V3(0.46, -0.3, sg * 0.03)], (t) => 0.03 - 0.02 * t, dark, 4, 6);
      tubeMesh(g, [new V3(0.22, 0.3, sg * 0.06), new V3(0.34, 0.46, sg * 0.1)], () => 0.01, dark, 4, 5);
    }
    return { g, crown: new V3(-0.1, 0.3, 0), halfW: 0.4, eyes, back: 0.24, trait: 'wings', neck: { len: 0.3, r: 0.14, rise: 0.5, base: 0x1d6b6a } };
  },

  /* Saltwater crocodile: long toothed snout, eyes and nostrils raised on top. */
  croc({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    const skin = 0x39402a;
    ell(g, [0.46, 0.27, 0.42], [0, 0, 0], skin, 0.8);
    ell(g, [0.8, 0.13, 0.27], [0.85, 0.02, 0], skin, 0.8);                // upper jaw
    ell(g, [0.76, 0.09, 0.24], [0.8, -0.16, 0], 0x8f8a62, 0.8, -0.1);     // lower jaw, slightly open
    ell(g, [0.12, 0.07, 0.15], [1.56, 0.08, 0], skin, 0.7);               // nostril bump
    for (const sg of [1, -1]) ell(g, [0.13, 0.1, 0.11], [0.12, 0.24, sg * 0.2], skin, 0.8);   // eye ridges
    const tooth = stdMat(0xf0ead6, 0.3);
    for (let i = 0; i < 13; i++) for (const sg of [1, -1]) {
      const x = 0.3 + i * 0.1, z = sg * 0.25 * Math.sqrt(Math.max(0.05, 1 - ((x - 0.85) / 0.82) ** 2));
      cone(g, [x, -0.06, z], 0.022, i % 3 === 0 ? 0.15 : 0.09, tooth, [Math.PI, 0, 0]);
      if (i % 2) cone(g, [x + 0.05, -0.1, z * 0.94], 0.02, 0.09, tooth);
    }
    const col = (s) => (s.y < -0.3 ? hsl(0.14, 0.25, rnd.range(0.5, 0.62)) : hsl(rnd.range(0.17, 0.23), 0.3, rnd.range(0.16, 0.28)));
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.46, 0.27, 0.42], { count: 280, flow: X, style: STYLES.bigscale, color: col });
    coverEllipsoid(b, rnd, new V3(0.85, 0.02, 0), [0.8, 0.13, 0.27], { count: 300, flow: X, style: STYLES.scale, color: col, skip: (s) => s.y < -0.2 });
    const eyes = eyePair(g, 0.14, 0.28, 0.24, 0.055, { iris: 0xb8c23a, slit: true }, es);
    finish(g, b);
    return { g, crown: new V3(-0.1, 0.27, 0), halfW: 0.4, eyes, back: 0.36, tilt: 0.02, neck: { len: 0.45, r: 0.38, rise: 0.15 } };
  },

  /* fallback for an animal that has no head of its own yet */
  generic({ rnd, es }) {
    const g = new THREE.Group(), b = new FeatherBatch();
    ell(g, [0.42, 0.34, 0.32], [0, 0, 0], 0x6e5a44, 0.8);
    ell(g, [0.24, 0.18, 0.2], [0.4, -0.08, 0], 0x5c4a38, 0.8);
    coverEllipsoid(b, rnd, new V3(0, 0, 0), [0.42, 0.34, 0.32], { count: 300, flow: X, style: STYLES.fur, color: () => hsl(0.08, 0.3, rnd.range(0.3, 0.42)) });
    const eyes = eyePair(g, 0.22, 0.08, 0.28, 0.055, { iris: 0x1a0f08 }, es);
    finish(g, b);
    return { g, crown: new V3(-0.02, 0.34, 0), halfW: 0.3, eyes, back: 0.3, neck: { len: 0.6, r: 0.26 } };
  },
};
