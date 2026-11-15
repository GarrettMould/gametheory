// Tusk Heron: a blue heron with a bright yellow eye and an ivory tusk hanging where the beak would be.
// Faces +X, feet on y = 0, about 5.2 units tall.
import * as THREE from 'three';
import { V3, makeRng, hsl, canvasTexture, taperedTube, ellipsoid, fibSphere, FeatherBatch, shadowed } from '../kit.js';

export const meta = { id: 'tusk-heron', name: 'Tusk Heron', habitat: 'aquatic' };

export function build() {
  const rnd = makeRng(20261113), rr = rnd.range;
  const bird = new THREE.Group(); bird.name = meta.id;
  const neckGroup = new THREE.Group(); bird.add(neckGroup);   // neck + head + tusk sway together
  const bodyF = new FeatherBatch(), neckF = new FeatherBatch();

  /* body */
  const bodyR = [1.25, 0.72, 0.62];
  const bodyM = new THREE.Matrix4().makeRotationZ(0.28).setPosition(0, 2.35, 0);
  const body = ellipsoid(bodyR, 0x34506b);
  body.position.set(0, 2.35, 0); body.rotation.z = 0.28; bird.add(body);
  fibSphere(1150, rnd, (s) => {
    const p = new V3(s.x * bodyR[0], s.y * bodyR[1], s.z * bodyR[2]).applyMatrix4(bodyM);
    const n = new V3(s.x / bodyR[0], s.y / bodyR[1], s.z / bodyR[2]).normalize().transformDirection(bodyM);
    const flow = new V3(-1, -0.12, 0).transformDirection(bodyM);
    const back = (1 - s.x) / 2;
    const c = s.y < -0.35
      ? (rnd() < 0.18 ? hsl(0.6, 0.3, 0.12) : hsl(0.58, 0.22, rr(0.48, 0.6)))   // pale belly with dark streaks
      : hsl(rr(0.57, 0.6), rr(0.5, 0.64), rr(0.26, 0.38));
    bodyF.add(p, n, flow, rr(0.26, 0.34) + back * 0.16, rr(0.3, 0.4), c);
  });

  /* wings, folded against the body */
  [1, -1].forEach((sg) => {
    const wc = new V3(-0.2, 0.12, sg * 0.56), wr = [1.2, 0.5, 0.15];
    const wing = ellipsoid(wr, 0x263a52);
    wing.position.copy(wc.clone().applyMatrix4(bodyM)); wing.rotation.z = 0.28; bird.add(wing);
    for (let gx = -0.95; gx <= 0.92; gx += 0.105) for (let gy = -0.9; gy <= 0.9; gy += 0.115) {
      const x = gx + rr(-0.03, 0.03), y = gy + rr(-0.03, 0.03), q = 1 - x * x - y * y; if (q <= 0.01) continue;
      const s = new V3(x, y, sg * Math.sqrt(q));
      const p = new V3(wc.x + s.x * wr[0], wc.y + s.y * wr[1], wc.z + s.z * wr[2]).applyMatrix4(bodyM);
      const n = new V3(s.x / wr[0], s.y / wr[1], s.z / wr[2]).normalize().transformDirection(bodyM);
      const flow = new V3(-1, -0.22, 0).transformDirection(bodyM);
      const t = (1 - x) / 2, low = y < -0.15;
      const c = low ? hsl(0.6, rr(0.4, 0.5), rr(0.1, 0.17)) : hsl(rr(0.575, 0.6), rr(0.52, 0.66), rr(0.22, 0.32));
      bodyF.add(p, n, flow, (low ? 0.42 : 0.3) + t * 0.5, low ? 0.34 : 0.42, c, 0.14);
    }
    for (let k = 0; k < 8; k++) {   // long dark flight feathers past the tail
      const p = new V3(wc.x - 1.0 + k * 0.05, wc.y - 0.1 - k * 0.045, wc.z + sg * 0.04).applyMatrix4(bodyM);
      bodyF.add(p, new V3(0, 0.15, sg).normalize(), new V3(-1, -0.3 + k * 0.02, 0).transformDirection(bodyM), rr(0.85, 1.05), 0.22, hsl(0.61, 0.3, rr(0.09, 0.15)), 0.03);
    }
    for (let k = 0; k < 9; k++) {   // pale plumes draped over the shoulder
      const p = new V3(0.55 - k * 0.07, 0.52 - k * 0.015, sg * (0.3 + k * 0.025)).applyMatrix4(bodyM);
      bodyF.add(p, new V3(0, 0.8, sg * 0.6).normalize(), new V3(-1, -0.22, sg * 0.08).transformDirection(bodyM), rr(0.75, 1.0), 0.1, hsl(0.58, 0.4, rr(0.5, 0.62)), 0.1);
    }
  });
  for (let k = -4; k <= 4; k++) {   // tail
    const p = new V3(-1.1, 0.02, k * 0.05).applyMatrix4(bodyM);
    bodyF.add(p, new V3(0, 1, 0), new V3(-1, -0.1, k * 0.05).transformDirection(bodyM), rr(0.6, 0.75), 0.3, hsl(0.59, 0.36, rr(0.24, 0.34)), 0.02);
  }
  for (let k = 0; k < 18; k++) {   // chest plumes at the base of the neck
    const z = rr(-0.22, 0.22), p = new V3(1.22 + rr(-0.05, 0.08), 2.95 + rr(-0.12, 0.1), z);
    bodyF.add(p, new V3(1, 0.1, z * 2).normalize(), new V3(0.12, -1, z * 0.3), rr(0.6, 0.85), 0.11, hsl(0.58, 0.2, rr(0.6, 0.72)), 0.06);
  }

  /* neck: S-curve, tapering toward the head */
  const neckCurve = new THREE.CatmullRomCurve3([new V3(0.9, 2.7, 0), new V3(1.45, 3.1, 0), new V3(1.52, 3.7, 0), new V3(1.15, 4.15, 0), new V3(1.2, 4.7, 0), new V3(1.55, 5.0, 0)]);
  const neckR = (t) => 0.3 * (1 - t) + 0.115 * t + 0.04 * Math.sin(t * Math.PI) * (1 - t);
  const NS = 70, neck = taperedTube(neckCurve, NS, 18, neckR);
  neckGroup.add(shadowed(new THREE.Mesh(neck.geo, new THREE.MeshStandardMaterial({ color: 0x5a718a, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 }))));
  for (let i = 1; i < NS; i++) {
    const t = i / NS, P = neckCurve.getPointAt(t), T = neckCurve.getTangentAt(t), r = neckR(t), N = neck.frames.normals[i], B = neck.frames.binormals[i];
    const per = Math.round(11 + 7 * (1 - t));
    for (let j = 0; j < per; j++) {
      const a = ((j + rnd()) / per) * Math.PI * 2;
      const n = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      const front = n.x > 0.45;
      const c = front ? (rnd() < 0.12 ? hsl(0.6, 0.25, 0.12) : hsl(0.1, 0.08, rr(0.66, 0.76))) : hsl(rr(0.58, 0.61), rr(0.3, 0.4), rr(0.34, 0.44));
      neckF.add(P.clone().addScaledVector(n, r), n, T.clone().negate(), rr(0.15, 0.2) + 0.08 * (1 - t), 0.42, c, 0.16);
    }
  }

  /* head */
  const headC = new V3(1.68, 5.03, 0), headR = [0.3, 0.2, 0.18];
  const head = ellipsoid(headR, 0xc9d0d4); head.position.copy(headC); neckGroup.add(head);
  const eyeP = [new V3(1.8, 5.07, 0.152), new V3(1.8, 5.07, -0.152)];
  fibSphere(560, rnd, (s) => {
    if (s.x > 0.86) return;   // tusk socket
    const p = new V3(headC.x + s.x * headR[0], headC.y + s.y * headR[1], headC.z + s.z * headR[2]);
    if (p.distanceTo(eyeP[0]) < 0.075 || p.distanceTo(eyeP[1]) < 0.075) return;
    const n = new V3(s.x / headR[0], s.y / headR[1], s.z / headR[2]).normalize();
    let c;
    if (s.y > 0.42 && s.y < 0.9 && Math.abs(s.z) > 0.2) c = hsl(0.62, 0.25, rr(0.07, 0.12));   // dark stripe over each eye
    else if (s.x < -0.35 && s.y < 0.25) c = hsl(0.59, 0.3, rr(0.36, 0.46));
    else c = hsl(0.1, 0.06, rr(0.7, 0.78));
    neckF.add(p, n, new V3(-1, -0.05, 0), rr(0.085, 0.12), 0.5, c, 0.14);
  });
  for (let k = 0; k < 4; k++) {   // long dark crest plumes
    const z = (k - 1.5) * 0.05;
    neckF.add(new V3(1.45, 5.13, z), new V3(0, 1, 0), new V3(-1, -0.28 - k * 0.04, z), rr(0.6, 0.85), 0.07, hsl(0.62, 0.25, 0.08), 0.04);
  }

  /* eyes: bright yellow iris, black pupil */
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0xffd21a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x7a5c00, envMapIntensity: 0.5 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.6, envMapIntensity: 0.2 });
  eyeP.forEach((p) => {
    const sg = Math.sign(p.z);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.058, 28, 20), irisMat); iris.position.copy(p);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), pupilMat); pupil.scale.z = 0.45; pupil.position.set(p.x + 0.004, p.y, p.z + sg * 0.047);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 10, 28), lidMat); lid.position.set(p.x, p.y, p.z + sg * 0.012);
    neckGroup.add(iris, pupil, lid);
  });

  /* tusk: ivory, hanging down where the beak would be */
  const ivory = canvasTexture(256, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#fbf5e6'); gr.addColorStop(0.7, '#f1e6cb'); gr.addColorStop(0.92, '#d9c59c'); gr.addColorStop(1, '#b59a6a');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 260; i++) {   // fine grain running the length of the tusk
      const x = rr(0, 256), y = rr(0, 512), h = rr(40, 220);
      g.strokeStyle = 'rgba(' + (rnd() < 0.5 ? '120,95,55' : '255,255,250') + ',' + rr(0.03, 0.1) + ')'; g.lineWidth = rr(0.5, 1.6);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-3, 3), y + h); g.stroke();
    }
  });
  const tuskCurve = new THREE.CatmullRomCurve3([new V3(1.85, 5.0, 0), new V3(2.08, 4.93, 0), new V3(2.22, 4.62, 0), new V3(2.25, 4.15, 0), new V3(2.31, 3.7, 0), new V3(2.47, 3.35, 0)]);
  neckGroup.add(shadowed(new THREE.Mesh(taperedTube(tuskCurve, 64, 24, (t) => 0.098 * Math.pow(1 - t, 0.75) + 0.006).geo,
    new THREE.MeshPhysicalMaterial({ color: 0xffedcc, map: ivory, bumpMap: ivory, bumpScale: 0.03, roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.45 }))));
  const socket = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 12, 28), new THREE.MeshStandardMaterial({ color: 0x2e2f2a, roughness: 0.7, envMapIntensity: 0.25 }));
  socket.position.set(1.955, 4.975, 0); socket.rotation.set(0, Math.PI / 2, 0); socket.rotateX(0.3); socket.castShadow = true; neckGroup.add(socket);

  /* legs and feet */
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c281d, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const wadePoints = [];
  [[0.22, 0.16], [-0.22, -0.2]].forEach(([z, fx]) => {
    const hip = new V3(-0.05, 1.92, z), knee = new V3(-0.3 + fx * 0.4, 1.02, z), foot = new V3(-0.1 + fx, 0.045, z);
    wadePoints.push({ x: foot.x, z });
    const thigh = ellipsoid([0.17, 0.36, 0.15], 0x41607f); thigh.position.set(-0.08, 1.82, z); thigh.rotation.z = -0.2; bird.add(thigh);
    fibSphere(90, rnd, (s) => {
      const p = new V3(-0.08 + s.x * 0.17, 1.82 + s.y * 0.36, z + s.z * 0.15), n = new V3(s.x / 0.17, s.y / 0.36, s.z / 0.15).normalize();
      bodyF.add(p, n, new V3(-0.2, -1, 0), rr(0.14, 0.2), 0.45, hsl(0.585, rr(0.45, 0.55), rr(0.26, 0.36)), 0.15);
    });
    const parts = [
      new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([hip, knee]), 8, 10, (t) => 0.05 - 0.012 * t).geo, legMat),
      new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([knee, foot]), 8, 10, (t) => 0.038 - 0.008 * t).geo, legMat),
    ];
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), legMat); joint.position.copy(knee); parts.push(joint);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8), legMat); ankle.position.copy(foot); parts.push(ankle);
    [[-0.6, 0.34], [0, 0.4], [0.6, 0.34], [Math.PI, 0.17]].forEach(([ang, len]) => {   // three toes forward, one back
      const tip = new V3(foot.x + Math.cos(ang) * len, 0.014, foot.z + Math.sin(ang) * len);
      const mid = foot.clone().lerp(tip, 0.5); mid.y = 0.03;
      parts.push(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([foot, mid, tip]), 8, 8, (t) => 0.026 - 0.016 * t).geo, legMat));
    });
    parts.forEach((o) => bird.add(shadowed(o)));
  });

  bird.add(bodyF.build());
  neckGroup.add(neckF.build());

  /* idle: the neck and head sway slightly */
  const pivot = new V3(0.9, 2.7, 0);
  bird.userData = {
    meta, height: 5.25, wadeDepth: 0.3, wadePoints,
    update(t) {
      const a = 0.022 * Math.sin(t * 0.9) + 0.007 * Math.sin(t * 2.3), c = Math.cos(a), s = Math.sin(a);
      neckGroup.rotation.z = a;
      neckGroup.position.set(pivot.x - (c * pivot.x - s * pivot.y), pivot.y - (s * pivot.x + c * pivot.y), 0);
    },
  };
  return bird;
}
