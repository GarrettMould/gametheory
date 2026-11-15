// Each creature's individual design: a written brief, then the colours, markings and one-off details that realise it.
// Keyed by the creature's name in lower-case-with-hyphens. A creature with no entry still builds, just without extras.
import * as THREE from 'three';
import { noise2 } from './kit.js';

/* ---- painting helpers: each takes (colour, position, surface normal) and returns the colour to use ---- */
const r01 = (p, k = 1) => { const v = Math.sin(p.x * 91.7 * k + p.y * 47.3 + p.z * 13.1) * 43758.5453; return v - Math.floor(v); };
const K = (h, s, l, j = 0.05) => (p) => new THREE.Color().setHSL(h, s, Math.min(0.97, Math.max(0.02, l + (r01(p, 1.7) - 0.5) * 2 * j)));
const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);
const recolor = (h, s, l, contrast = 0.9, ref = 0.32) => (c) => { const o = {}; c.getHSL(o); return c.setHSL(h, s, Math.min(0.96, Math.max(0.03, l + (o.l - ref) * contrast))); };
const seq = (...fs) => (c, p, n) => { for (const f of fs) c = f(c, p, n) || c; return c; };
const notBelly = (f) => (c, p, n) => (n.y < -0.5 ? c : f(c, p, n));
const flecks = (prob, col) => (c, p) => (r01(p) < prob ? col(p) : c);
const stripes = (freq, col, thr = 0.5, skew = 1.2) => (c, p) => (Math.sin(p.x * freq + p.y * skew) > thr ? col(p) : c);
const belly = (col, at = -0.45) => (c, p, n) => (n.y < at ? col(p) : c);
const flank = (lo, hi, col) => (c, p, n) => (n.y > lo && n.y < hi ? col(p) : c);
const fawn = (col) => (c, p, n) => (n.y > 0.05 && Math.sin(p.x * 6.5) > 0.5 && Math.sin(p.z * 8 + p.y * 5) > -0.1 ? col(p) : c);
const zigzag = (col) => (c, p, n) => (n.y > 0.7 && Math.abs(p.z) < 0.1 + 0.1 * Math.sin(p.x * 7) ? col(p) : c);
const diamonds = (a, b) => (c, p, n) => (n.y < -0.55 ? c : Math.sin(p.x * 5.2 + p.z * 4.6) * Math.sin(p.x * 5.2 - p.z * 4.6) > 0 ? a(p) : b(p));
const fadeX = (x0, x1, f) => (c, p, n) => (r01(p, 2.3) < (p.x - x0) / (x1 - x0) ? f(c, p, n) : c);
const front = (x0, f) => (c, p, n) => (p.x > x0 && n.y < 0.15 ? f(c, p, n) : c);
const blotch = (scale, thr, col) => (c, p) => (noise2(p.x * scale + 5, p.y * scale + p.z * scale) > thr ? col(p) : c);

export const DESIGNS = {
  'appa': {
    brief: 'Marsh bison in reed camouflage with a deep-sea lantern jaw: three glowing lures and a line of pale light-spots along each flank.',
    mods: { girth: 1.08 }, opt: { lureColor: 0x9dffb0 },
    extras: (x, D) => { D.extraLures(x, [[-0.1, 0.18, 0.45, 0.35], [-0.1, -0.18, 0.38, 0.3]], 0x9dffb0); D.photophores(x, 0x9dffb0); },
  },
  'danatster': {
    brief: 'Black-water crocodile with rust bands, a cobra-like hood behind a dark python head, bronze-black armour and a spiked tail club.',
    paint: { body: notBelly(seq(recolor(0.04, 0.35, 0.1, 0.7), stripes(4.2, K(0.04, 0.7, 0.3), 0.72, 0))), head: recolor(0.06, 0.3, 0.14, 0.8), legs: recolor(0.05, 0.4, 0.2, 0.8) },
    base: { body: 0x1c1410, neck: 0x241a12, legs: 0x3a2618 }, opt: { armor: [0.07, 0.3, 0.24] },
    extras: (x, D) => { D.frill(x, (a) => hsl(0.04, 0.65, 0.2 + 0.1 * Math.sin(a * 6))); D.tailClub(x, 0x4a3a2c); },
  },
  'nea': {
    brief: 'Red-earth elephant the colour of laterite dust, with a tall saddle-backed shell, big ears and white pack war-paint ringing its legs.',
    base: { body: 0x9a5c40 }, opt: { ear: 1.2, earTint: 0xdba58c, shellH: 1.28, shellTint: 0xd9b89a, tusk: 0.9 },
    paint: { legs: recolor(0.05, 0.45, 0.42) },
    extras: (x, D) => D.legBands(x, 0xf2efe6, { heights: [0.3, 0.42, 0.54], w: 0.03 }),
  },
  'nyxstride': {
    brief: "Midnight stag: a blue-black coat flecked with star-white, tall dark antlers, a violet-black python head and gunmetal armour over a sprinter's striped legs.",
    paint: { body: seq(recolor(0.65, 0.4, 0.1, 0.6), flecks(0.045, K(0.6, 0.3, 0.92))), head: recolor(0.72, 0.35, 0.16, 0.9), legs: seq(recolor(0.65, 0.3, 0.16, 0.8), stripes(9, K(0.6, 0.1, 0.75), 0.75)) },
    base: { body: 0x14162a, legs: 0x1c1e30, neck: 0x1e1a30 }, opt: { antlers: { scale: 1.25, color: 0x2a2622 }, armor: [0.62, 0.15, 0.32] },
  },
  'the-burrito-torpedo-gobbler': {
    brief: 'Torpedo-shaped and very well fed: a long, sleek cinnamon body with a cream belly, a red wattle under the beak and broad amber wings.',
    mods: { len: 1.18, girth: 1.18 }, opt: { wingColor: 0xf2b25a, wingChord: 1.25, antlers: { scale: 0.8 } },
    paint: { body: seq(recolor(0.06, 0.6, 0.36), belly(K(0.1, 0.4, 0.85), -0.25)) },
    extras: (x, D) => D.wattle(x),
  },
  'the-natster': {
    brief: "Slate-blue mountain ape wearing a falcon's hood: a feathered ruff, a barred chest and tortoise-column legs under one great shoulder hump.",
    paint: { body: seq(recolor(0.6, 0.22, 0.22, 0.9), (c, p, n) => (n.y < -0.1 && Math.sin(p.x * 16) > 0.1 ? hsl(0.1, 0.3, 0.82) : c)) },
    base: { body: 0x2a3240 },
    extras: (x, D) => D.frill(x, (a) => hsl(0.6, 0.2, 0.26 + 0.08 * Math.sin(a * 9)), { len: 0.55, lift: 0.9, aspect: 0.45, t: 0.55, arc: 3.0 }),
  },
  'emperor-silverback': {
    brief: 'Regal: a bright silver saddle, a crown of golden plumes, a tuxedo-white chest and moss camouflage kept to the flanks.',
    paint: { body: seq(front(0.45, () => hsl(0.12, 0.08, 0.93)), (c, p, n) => (n.y > 0.45 && p.x < 0.3 ? hsl(0.6, 0.04, 0.72 + 0.1 * r01(p)) : c)) },
    extras: (x, D) => D.crestPlumes(x, () => hsl(0.12, 0.95, 0.55), { n: 9, len: 0.6, lift: 1.3, sweep: -0.35, spread: 0.34 }),
  },
  'fuelrunner': {
    brief: 'Built to run far: a lean sand-coloured monitor with dark racing stripes, a low streamlined shell and a fat-storing tail behind long cheetah legs.',
    mods: { girth: 0.88, len: 1.06 }, opt: { shellH: 0.62, shellTint: 0xe6d6a8 }, base: { body: 0xb99a5e },
    paint: { body: seq(recolor(0.1, 0.45, 0.5, 0.8), flank(0.1, 0.36, K(0.07, 0.5, 0.12))) },
  },
  'matrovan': {
    brief: "Emerald river crocodile with a tall ribbed sail down its back, a cinnamon wader's neck and smoke-dark wings.",
    paint: { body: notBelly(recolor(0.42, 0.55, 0.2, 0.9)) }, base: { body: 0x1f5a3c }, opt: { wingColor: 0x4a4f58, wingOpacity: 0.72 },
    extras: (x, D) => D.sail(x, 0x2f8f6a, { h: 1.15, spine: 0x143a28 }),
  },
  'perinox': {
    brief: 'Cave-pale: ghost-white plumage with faint grey barring, a cream-maned bison head, blood-red gills and tiny pink limbs.',
    paint: { body: recolor(0.6, 0.06, 0.86, 0.35), head: recolor(0.1, 0.2, 0.8, 0.5) }, base: { body: 0xe6e6ea },
  },
  'tame-impala': {
    brief: 'A gentle giant in warm sandstone hide with small rounded ears, a golden python head, bronze ceremonial armour and long lyre horns.',
    base: { body: 0xa88f72 }, paint: { head: recolor(0.12, 0.7, 0.5, 0.9) }, opt: { ear: 0.75, earTint: 0xe6cfae, tusk: 0.7, armor: [0.09, 0.55, 0.42] },
  },
  'the-grizzler': {
    brief: 'Grizzled: a grey-tipped shaggy coat and heavy mane, one antler snapped short, an ember-lit lantern jaw and rust-eaten armour.',
    paint: { body: seq(recolor(0.07, 0.2, 0.28, 0.9), flecks(0.2, K(0.1, 0.06, 0.72))) }, base: { body: 0x4a4038 },
    opt: { antlers: { broken: true, color: 0x9a8a6c }, armor: [0.05, 0.5, 0.28], lureColor: 0xffb060 },
    extras: (x, D) => D.mane(x, (c) => (c.rnd() < 0.3 ? hsl(0.1, 0.06, 0.7) : hsl(0.08, 0.15, c.rnd.range(0.2, 0.34))), { len: 0.7, count: 360 }),
  },
  'bambi': {
    brief: 'A young fawn: a bright russet coat with rows of white spots, short velvet antler spikes, big eyes and small clear wings.',
    mods: { scale: 0.86, head: 1.12, eye: 1.25 }, opt: { antlers: { spikes: true, color: 0x7a5a3c }, wingSpan: 0.8 },
    paint: { body: seq(recolor(0.055, 0.7, 0.4), fawn(K(0.1, 0.2, 0.95, 0.02))) },
  },
  'cuffem': {
    brief: 'Charcoal elephant in black iron: riveted cuffs on every leg, a spiked shell, short crossed tusks and narrow eyes.',
    base: { body: 0x4c4c52 }, paint: { legs: recolor(0.6, 0.05, 0.2, 0.8) },
    opt: { earTint: 0x8a8a90, shellTint: 0x77777d, shellSpikes: 0x2c2e33, tusk: 0.75, crossed: true, armor: [0.6, 0.06, 0.24] },
    extras: (x, D) => D.legBands(x, 0x2c2e33, { metal: true }),
  },
  'gemundyn': {
    brief: "Rust and black: the godwit's cinnamon runs down the neck and over the shoulders into black fur, with long folded wings, polished steel and a swept-back crest.",
    paint: { body: fadeX(-0.2, 1.3, recolor(0.055, 0.62, 0.4, 0.8)) }, opt: { armor: [0.58, 0.05, 0.74] },
    extras: (x, D) => D.crestPlumes(x, () => hsl(0.06, 0.6, 0.3), { n: 5, len: 0.55, lift: 0.5 }),
  },
  'jerry': {
    brief: 'Swamp ape: algae-green shag, chin barbels, twin lanterns and pale lamp eyes on slim striped legs.',
    paint: { body: (c) => c.offsetHSL(0.07, 0.08, -0.02), legs: stripes(8, K(0.08, 0.3, 0.12), 0.6) }, opt: { lureColor: 0xfff3a0 },
    extras: (x, D) => { D.barbels(x); D.extraLures(x, [[-0.12, 0.2, 0.3, 0.45]], 0xfff3a0); },
  },
  'lebron': {
    brief: 'The tallest of them all: a long-legged storm-blue elephant with sweeping tusks, a patterned python head and four broad wings.',
    base: { body: 0x5f6f86 }, mods: { legLen: 1.3, scale: 1.06 }, opt: { tusk: 1.35, earTint: 0xa9b6cc, wingSpan: 1.15, wingChord: 1.2, wingColor: 0xbfd6f2 },
  },
  'mrs-kippling': {
    brief: 'Jungle-elegant: tree-python green with a white zigzag down the spine, a feathered neck ruff, long folded wings and golden eyes.',
    paint: { body: seq(recolor(0.33, 0.6, 0.3, 0.8), zigzag(K(0.12, 0.1, 0.95, 0.02))), head: recolor(0.33, 0.6, 0.32, 0.8) }, base: { body: 0x2f6a34, neck: 0x2f6a34 },
    extras: (x, D) => D.frill(x, (a) => hsl(0.33, 0.5, 0.25 + 0.1 * Math.sin(a * 7)), { len: 0.5, lift: 1.2, aspect: 0.4, t: 0.7 }),
  },
  'placeholder': {
    brief: 'Left blank on purpose: a bone-white python body like an uncoloured sketch, with red compound eyes as its only colour and plain white armour.',
    paint: { body: recolor(0.1, 0.04, 0.86, 0.25), legs: recolor(0.1, 0.04, 0.82, 0.25) }, base: { body: 0xe9e6df, legs: 0xdedbd3, neck: 0xe9e6df },
    opt: { eyeColor: 0xd0202a, armor: [0.1, 0.02, 0.9], wingColor: 0xffffff },
    extras: (x) => { x.hd.g.children[0].material.color.set(0xe9e6df); },
  },
  'sarjackimus': {
    brief: 'Small and quick: a violet fiddler-crab shell, one oversized orange claw, stalked eyes and a signal crest, on lean cheetah legs.',
    base: { body: 0x6b3fa6 }, opt: { claw: 0xf08a2a, clawArm: 0x6b3fa6, clawTip: 0xfff0d0 },
    extras: (x, D) => D.eyestalks(x, 0x6b3fa6),
  },
  'scalejack': {
    brief: 'Black-and-gold diamond python with a broad crocodile snout, a horn on the nose, brass scale armour and long kicking hind legs.',
    paint: { body: diamonds(K(0.12, 0.85, 0.5), K(0.1, 0.2, 0.07)), head: recolor(0.12, 0.5, 0.3, 0.9) }, base: { body: 0x2a2210 }, opt: { armor: [0.11, 0.6, 0.45] },
    extras: (x, D) => D.snoutHorn(x),
  },
  'val-ociraptor': {
    brief: 'Raptor-styled: a tawny striped hide, a feather crest, feathered forearms and a sickle claw on each hind foot.',
    base: { body: 0xa07c48 }, paint: { legs: recolor(0.09, 0.5, 0.42) }, opt: { ear: 0.6, earTint: 0xe0c08c, shellTint: 0xb89462, tusk: 0.6 },
    extras: (x, D) => {
      D.hideStripes(x, () => hsl(0.07, 0.5, 0.14));
      D.crestPlumes(x, (k) => hsl(0.03 + 0.02 * (k % 2), 0.7, 0.4), { n: 7, len: 0.7, lift: 1.0 });
      D.forearmFeathers(x, (i) => hsl(0.07, 0.5, 0.25 + 0.06 * (i % 2)));
      D.sickleClaws(x);
    },
  },
};
