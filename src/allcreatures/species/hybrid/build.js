// Assembles a hybrid creature from three animals, a power-up and a strategy.
//   animals[0] -> body, covering, base colours     (bodies.js)
//   animals[1] -> head and neck, one signature     (heads.js)
//   animals[2] -> legs and movement                (limbs.js)
//   adaptation -> Armor / Reserves / Camouflage / Pack reshape the build   (traits.js)
//   strategy   -> a light touch on the eyes and brow only
import * as THREE from 'three';
import { V3, makeRng, lerp, sweep, cover, FeatherBatch, stdMat, shadowed, wrinkleTexture } from '../../kit.js';
import { BODIES } from './bodies.js';
import { HEADS } from './heads.js';
import { LEGS, buildLeg } from './limbs.js';
import * as T from './traits.js';

const ANIMALS = [['bison', 'bison'], ['anglerfish', 'anglerfish'], ['hare', 'hare'], ['crocodile', 'croc'], ['python', 'python'], ['impala', 'impala'],
  ['elephant', 'elephant'], ['tortoise', 'tortoise'], ['gazelle', 'gazelle'], ['deer', 'deer'], ['cheetah', 'cheetah'], ['penguin', 'penguin'],
  ['dragonfly', 'dragonfly'], ['gorilla', 'gorilla'], ['falcon', 'falcon'], ['komodo', 'komodo'], ['godwit', 'godwit'], ['olm', 'olm'], ['crab', 'crab']];
export const animalKey = (name) => { const n = String(name || '').toLowerCase(); const hit = ANIMALS.find(([k]) => n.includes(k)); return hit ? hit[1] : 'generic'; };
const powerKey = (a) => { const n = String(a || '').toLowerCase(); return n.includes('armor') ? 'armor' : n.includes('reserve') ? 'reserves' : n.includes('camo') || n.includes('silent') ? 'camo' : n.includes('pack') ? 'pack' : null; };
const stratKey = (s) => { const n = String(s || '').toLowerCase(); return n.includes('cheat') ? 'cheat' : n.includes('cooperate') ? 'cooperate' : n.includes('grudge') ? 'grudger' : n.includes('detective') ? 'detective' : 'copycat'; };
const EYE = { cheat: 0.85, cooperate: 1.3, grudger: 0.95, detective: 1.18, copycat: 1 };
const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; };

export function buildHybrid({ id, name, animals = [], adaptation, strategy }) {
  const [ka, kb, kc] = animals.map(animalKey);
  const body = BODIES[ka] || BODIES.generic, headDef = HEADS[kb] || HEADS.generic, legs = LEGS[kc] || LEGS.generic;
  const power = powerKey(adaptation), strat = stratKey(strategy);
  const rnd = makeRng(hashStr(name || animals.join()));
  const S = body.S, fat = power === 'reserves' ? 1.17 : 1;
  const root = new THREE.Group(); root.name = id || name;
  const front = new THREE.Group(); root.add(front);            // neck + head, sways as one
  const main = new FeatherBatch(), frontB = new FeatherBatch();

  // every creature gets its own slight variation in colour and proportions, so twins on paper still look like individuals
  const v = { dh: rnd.range(-0.045, 0.045), ds: rnd.range(-0.08, 0.1), dl: rnd.range(-0.07, 0.08), len: rnd.range(0.9, 1.12), girth: rnd.range(0.92, 1.1) };
  const tint = (m) => { m.color.offsetHSL(v.dh, v.ds * 0.5, v.dl * (body.hide ? 1.4 : 0.8)); return m; };

  // colour wrappers, innermost first
  let wrap = (fn) => (c) => fn(c).offsetHSL(v.dh, v.ds, v.dl);
  if (legs.stripe) { const w0 = wrap; wrap = (fn) => T.gazelleStripe(w0(fn)); }
  if (power === 'pack') { const w0 = wrap; wrap = (fn) => T.packWrap(w0(fn)); }
  if (power === 'camo') { const w0 = wrap, cw = T.camoWrap(rnd); wrap = (fn) => cw(w0(fn)); }

  /* torso */
  const L = body.L * S * v.len, Rg = body.R * S * v.girth, slope = Math.tan(body.pitch);
  const hF = (t) => Math.max(0.012, Rg * body.prof(t) * fat), wF = (t) => hF(t) * body.w;
  const y0 = legs.len * S + hF(0.2) * 0.45;
  const spine = new THREE.CatmullRomCurve3([new V3(-L / 2, y0, 0), new V3(0, y0 + slope * L / 2, 0), new V3(L / 2, y0 + slope * L, 0)]);
  const torso = sweep(spine, 48, 28, hF, wF, true);
  const skinMat = tint(stdMat(body.base, body.rough || 0.85, { side: THREE.DoubleSide }));
  const thick = Math.min(1.4, Math.max(0.85, 0.85 + (Rg - 0.6) * 0.65));
  if (body.hide) { skinMat.bumpMap = wrinkleTexture(); skinMat.bumpScale = 1.5; }
  root.add(shadowed(new THREE.Mesh(torso.geo, skinMat)));
  if (body.style) cover(main, torso, rnd, { count: body.count || 1400, style: body.style, S, color: (c) => wrap(body.color)({ ...c, blaze: true }) });

  /* legs */
  const feet = [], hips = [];
  for (const [t, isFront] of [[0.78, true], [0.2, false]]) for (const sg of [1, -1]) {
    const P = spine.getPointAt(t), hip = new V3(P.x, P.y - hF(t) * 0.35, sg * wF(t) * 0.62);
    if (isFront) hips.push(hip);
    feet.push(buildLeg(root, main, rnd, hip, { front: isFront, sg, cfg: legs, S, wrap, thick, tint }));
  }

  /* neck + head */
  const hd = headDef({ rnd, es: EYE[strat] }), nk = hd.neck;
  let rise = nk.rise != null ? lerp(body.neckRise, nk.rise, 0.6) : body.neckRise;
  if (legs.len < 0.6) rise = Math.max(rise, 0.42);   // short-legged creatures carry the head clear of the ground
  const ang = (8 + 72 * rise) * Math.PI / 180, dir = new V3(Math.cos(ang), Math.sin(ang), 0), perp = new V3(-dir.y, dir.x, 0);
  const nb = spine.getPointAt(0.93); nb.y += hF(0.93) * 0.2;
  const nl = nk.len * S, hs = S * (hd.size || 1);
  const r1 = nk.r * S, r0 = Math.max(r1, Math.min(hF(0.9) * 0.85, r1 * 1.7));
  const nEnd = nb.clone().addScaledVector(dir, nl);
  const neckCurve = new THREE.CatmullRomCurve3([nb.clone().addScaledVector(dir, -0.25 * S), nb.clone().addScaledVector(dir, nl * 0.5).addScaledVector(perp, nl * 0.1), nEnd]);
  const neck = sweep(neckCurve, 22, 18, (t) => lerp(r0, r1, Math.pow(t, 0.7)), undefined, true);
  front.add(shadowed(new THREE.Mesh(neck.geo, nk.base ? stdMat(nk.base, 0.85, { side: THREE.DoubleSide }) : skinMat)));
  const neckStyle = nk.style || body.style, neckColor = nk.color || ((c) => body.color({ ...c, t: 0.96 }));
  if (neckStyle) cover(frontB, neck, rnd, { count: nk.count || Math.round(160 + 260 * nk.len), t0: 0.1, style: neckStyle, S, color: wrap(neckColor) });

  hd.g.scale.setScalar(hs);
  hd.g.position.copy(nEnd).addScaledVector(dir, hd.back * hs * 0.75);
  hd.g.rotation.z = hd.tilt != null ? hd.tilt : Math.min(0.25, ang * 0.25) - 0.12;
  front.add(hd.g);
  T.brows(hd.g, hd, strat);
  let earParts = null;
  if (body.echo === 'antlers') T.antlers(hd.g, hd);
  else if (!hd.horned && (legs.echo === 'lyre' || legs.echo === 'ghorns')) T.horns(hd.g, hd, legs.echo === 'lyre' ? 'lyre' : 'short');
  if (body.echo === 'elephant') earParts = T.elephantEarsAndTusks(hd.g, hd);
  else if (legs.echo === 'ears') T.hareEars(hd.g, hd);

  /* tail */
  const tb = spine.getPointAt(0.04); tb.y += hF(0.04) * 0.2;
  T.buildTail(root, main, rnd, { type: legs.tail || body.tail, base: tb, S, r0: hF(0.1) * 0.8, body, legs, wrap, fat: power === 'reserves' ? 1.35 : 1 });

  /* signature traits */
  let flaps = null;
  if (hd.trait === 'shell') T.tortoiseShell(root, spine, hF, wF, L, slope);
  if (hd.trait === 'wings' || legs.wings) { const a = spine.getPointAt(0.7); a.y += hF(0.7) * 0.92; flaps = T.dragonflyWings(root, a, S); }
  if ((body.wingsFolded || legs.wingsFolded) && hd.trait !== 'shell') T.foldedWings(main, rnd, torso, S);
  if (legs.gills) T.olmGills(frontB, rnd, nb, r0, S);
  if (body.extras === 'scutes') T.crocScutes(root, torso, S);
  if (body.extras === 'claw') T.crabClaws(root, spine, hF, wF, S);

  /* power-up */
  if (power === 'armor') T.armor(root, front, torso, neck, hips, S);
  if (power === 'reserves' && hd.trait !== 'shell') T.reserveHumps(root, main, rnd, spine, hF, wF, body, S, wrap);
  if (power === 'camo' && body.style) T.camoFringe(main, rnd, torso, S);
  if (power === 'pack') T.packCrest(main, frontB, rnd, torso, neck, S);

  if (main.items.length) root.add(main.build());
  if (frontB.items.length) front.add(frontB.build());

  const box = new THREE.Box3().setFromObject(root), pivot = nb.clone(), headPos = hd.g.position.clone(), phase = rnd.range(0, 6);
  root.userData = {
    meta: { id: id || name, name, animals, adaptation, strategy },
    height: box.max.y, length: box.max.x - box.min.x, centerX: (box.max.x + box.min.x) / 2, headPos, headSize: hs,
    wadeDepth: Math.min(0.3, legs.len * S * 0.3),
    wadePoints: feet.map((f) => ({ x: f.x, z: f.z })),
    update(t) {
      const a = 0.02 * Math.sin(t * 0.8 + phase) + 0.007 * Math.sin(t * 2.1 + phase), c = Math.cos(a), s = Math.sin(a);
      front.rotation.z = a; front.position.set(pivot.x - (c * pivot.x - s * pivot.y), pivot.y - (s * pivot.x + c * pivot.y), 0);
      if (flaps) flaps.forEach((f, i) => { f.rotation.z = f.userData.rest + 0.1 * Math.sin(t * 9 + i * 1.3); });
      if (earParts) earParts.forEach((e) => { e.rotation.y = e.userData.rest + Math.sign(e.userData.rest) * 0.12 * Math.sin(t * 1.3 + phase); });
      if (hd.update) hd.update(t);
    },
  };
  return root;
}
