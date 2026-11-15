// Slot 1: the animal that gives the creature its body, covering and base colors.
import { hsl, fbm, noise2, STYLES } from '../../kit.js';

const cap = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, t)))), 0.45);
const bump = (t, c, w, a) => a * Math.exp(-(((t - c) / w) ** 2));
const R = (c, a, b) => c.rnd.range(a, b);

// S overall scale · L length · R girth · w width/height · pitch front-raised · neckRise how upright the neck is
export const BODIES = {
  bison: {
    S: 1.2, L: 3.2, R: 0.8, w: 0.78, pitch: 0.04, neckRise: 0.1, base: 0x2a1c12, count: 1700, tail: 'tuft',
    prof: (t) => cap(t) * (1 + bump(t, 0.72, 0.2, 0.34)),
    style: (c) => (c.t > 0.52 ? STYLES.shag : STYLES.fur),
    color: (c) => (c.t > 0.52 ? hsl(0.07, 0.4, R(c, 0.08, 0.15)) : hsl(0.075, 0.45, R(c, 0.19, 0.27))),
  },
  croc: {
    S: 1.0, L: 4.0, R: 0.52, w: 1.3, pitch: 0, neckRise: 0.08, base: 0x39402a, count: 1900, tail: 'long', tailLen: 3.0, extras: 'scutes',
    prof: (t) => cap(t) * (0.85 + bump(t, 0.5, 0.3, 0.2)),
    style: () => STYLES.bigscale,
    color: (c) => (c.up < -0.45 ? hsl(0.13, 0.3, R(c, 0.55, 0.68)) : Math.sin(c.t * 38) > 0.55 ? hsl(0.2, 0.25, R(c, 0.09, 0.14)) : hsl(R(c, 0.17, 0.23), 0.3, R(c, 0.2, 0.3))),
  },
  elephant: {
    S: 1.35, L: 3.2, R: 1.02, w: 0.9, pitch: 0.03, neckRise: 0.35, base: 0x77726e, rough: 0.9, hide: true, tail: 'thin', echo: 'elephant',
    prof: (t) => cap(t) * (1 + bump(t, 0.3, 0.3, 0.08)),
    style: null, color: (c) => hsl(0.07, 0.04, R(c, 0.4, 0.48)),
  },
  deer: {
    S: 1.0, L: 2.8, R: 0.62, w: 0.74, pitch: 0.05, neckRise: 0.8, base: 0x6b3a22, count: 1500, tail: 'short', echo: 'antlers',
    prof: (t) => cap(t) * (1 + bump(t, 0.75, 0.2, 0.12)),
    style: () => STYLES.fur,
    color: (c) => (c.up < -0.55 ? hsl(0.09, 0.4, R(c, 0.62, 0.74)) : c.t < 0.13 ? hsl(0.1, 0.45, R(c, 0.68, 0.8)) : hsl(R(c, 0.04, 0.06), 0.58, R(c, 0.28, 0.37))),
  },
  gorilla: {
    S: 1.12, L: 2.6, R: 0.86, w: 0.96, pitch: 0.46, neckRise: 0.3, base: 0x121214, count: 1800, tail: 'none',
    prof: (t) => cap(t) * (1 + bump(t, 0.8, 0.2, 0.26)),
    style: (c) => (c.up > 0.3 && c.t > 0.18 && c.t < 0.62 ? STYLES.fur : STYLES.shag),
    color: (c) => (c.up > 0.3 && c.t > 0.18 && c.t < 0.62 ? hsl(0.6, 0.04, R(c, 0.5, 0.64)) : hsl(0.62, 0.06, R(c, 0.05, 0.1))),
  },
  komodo: {
    S: 0.95, L: 3.5, R: 0.5, w: 1.18, pitch: 0, neckRise: 0.12, base: 0x4a4238, count: 2000, tail: 'long', tailLen: 3.1,
    prof: (t) => cap(t) * (0.9 + bump(t, 0.45, 0.3, 0.2)),
    style: () => STYLES.scale,
    color: (c) => (c.rnd() < 0.12 ? hsl(0.13, 0.4, R(c, 0.45, 0.55)) : hsl(R(c, 0.06, 0.1), 0.16, R(c, 0.2, 0.32))),
  },
  falcon: {
    S: 0.9, L: 2.4, R: 0.62, w: 0.86, pitch: 0.32, neckRise: 0.75, base: 0x3a4250, count: 1500, tail: 'fan', wingsFolded: true,
    prof: (t) => cap(t) * (1 + bump(t, 0.7, 0.25, 0.12)),
    style: () => STYLES.feather,
    color: (c) => (c.up < -0.2 ? (Math.sin(c.t * 60) > 0.45 ? hsl(0.6, 0.15, R(c, 0.12, 0.18)) : hsl(0.1, 0.35, R(c, 0.72, 0.84))) : hsl(R(c, 0.59, 0.62), 0.22, R(c, 0.24, 0.34))),
  },
  python: {
    S: 0.9, L: 5.0, R: 0.42, w: 1.02, pitch: 0, neckRise: 0.45, base: 0x7a5a30, count: 2400, tail: 'long', tailLen: 2.4,
    prof: (t) => cap(t) * (0.92 + bump(t, 0.5, 0.35, 0.14)),
    style: () => STYLES.scale,
    color: (c) => pythonColor(c),
  },
  crab: {
    S: 1.05, L: 2.2, R: 0.56, w: 1.75, pitch: 0.06, neckRise: 0.4, base: 0xb5642a, rough: 0.35, tail: 'none', extras: 'claw',
    prof: (t) => cap(t) * (0.95 + bump(t, 0.6, 0.3, 0.15)),
    style: null, color: (c) => hsl(0.065, 0.62, R(c, 0.38, 0.46)),
  },
  // used when an animal shows up in slot 1 that has no body of its own yet
  generic: {
    S: 1.0, L: 2.8, R: 0.6, w: 0.8, pitch: 0.05, neckRise: 0.5, base: 0x6e5a44, count: 1400, tail: 'short',
    prof: (t) => cap(t), style: () => STYLES.fur, color: (c) => hsl(0.08, 0.3, R(c, 0.3, 0.42)),
  },
};

export function pythonColor(c) {
  if (c.up < -0.6) return hsl(0.12, 0.35, R(c, 0.68, 0.8));
  const n = fbm(c.p.x * 1.6 + 3, c.p.z * 2.2 + c.p.y * 1.5, 2), e = noise2(c.p.x * 5, c.p.z * 5 + c.p.y * 4);
  if (n > 0.56) return hsl(0.07, 0.5, R(c, 0.12, 0.19));        // dark saddle blotches
  if (n > 0.52) return hsl(0.1, 0.3, R(c, 0.08, 0.12));          // their darker outline
  return hsl(0.105 + e * 0.02, 0.5, R(c, 0.46, 0.58));
}

export function cheetahColor(c) {
  const spot = noise2(c.p.x * 7.5 + 11, c.p.y * 7.5 + c.p.z * 7.5) > 0.7;
  return spot ? hsl(0.08, 0.2, 0.06) : hsl(R(c, 0.105, 0.12), 0.68, R(c, 0.5, 0.6));
}
