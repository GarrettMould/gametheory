// Land environment: an ordinary dry-season savanna. Golden grass, a few acacia trees, rocks, low hills on the horizon.
// Ground is flat at y = 0 around the creature.
import * as THREE from 'three';
import { V3, makeRng, canvasTexture, fbm, smoothstep, taperedTube, skyDome, sunRig, shadowed } from '../kit.js';

export function createSafari({ lights = true } = {}) {
  const rnd = makeRng(9021), rr = rnd.range;
  const group = new THREE.Group(); group.name = 'env-safari';
  const sunDirection = new V3(6, 11, 4).normalize();

  const sky = skyDome([[0, '#2a67ab'], [0.32, '#6ea5d6'], [0.46, '#c4dbe6'], [0.5, '#ece4c6'], [0.53, '#b9a777'], [1, '#6f6240']]);
  group.add(sky);
  if (lights) group.add(sunRig({ direction: sunDirection, sunColor: 0xfff0d6, sunIntensity: 6.6, skyColor: 0xcfe2f5, groundColor: 0x8a7446, skyIntensity: 1.1, rimColor: 0xbfd6ff, rimIntensity: 1.6 }));

  /* ground: flat near the creature, gently rolling farther out, rising to hills at the horizon */
  const groundH = (x, z) => {
    const r = Math.hypot(x, z);
    return (fbm(x * 0.045 + 3, z * 0.045, 4) - 0.45) * 2.6 * smoothstep(7, 26, r)
      + smoothstep(62, 120, r) * (3 + 15 * fbm(x * 0.018 + 11, z * 0.018 + 5, 3));
  };
  const gg = new THREE.PlaneGeometry(300, 300, 200, 200); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position, gcol = [];
  const straw = new THREE.Color(0xc2a45c), olive = new THREE.Color(0x8e8a45), dirt = new THREE.Color(0x9b7648), haze = new THREE.Color(0x7d8a6a), tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i); gp.setY(i, groundH(x, z));
    tmp.copy(straw).lerp(olive, smoothstep(0.42, 0.7, fbm(x * 0.06, z * 0.06 + 20, 3)));
    tmp.lerp(dirt, smoothstep(0.6, 0.78, fbm(x * 0.13 + 40, z * 0.13, 3)));
    tmp.lerp(haze, smoothstep(70, 130, Math.hypot(x, z)) * 0.7);
    gcol.push(tmp.r, tmp.g, tmp.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3)); gg.computeVertexNormals();
  const soil = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7000; i++) { const v = Math.floor(rr(140, 255)); g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(rr(0, 256), rr(0, 256), rr(1, 2.4), rr(1, 2.4)); }
  }, { repeat: 90 });
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, map: soil, roughness: 1, envMapIntensity: 0.2 }));
  ground.receiveShadow = true; group.add(ground);

  /* dry grass */
  const bladeGeo = new THREE.ConeGeometry(0.022, 1, 3); bladeGeo.translate(0, 0.5, 0);
  const GRASS = 16000, grass = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, envMapIntensity: 0.2 }), GRASS);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (let i = 0; i < GRASS; i++) {
    const cl = i % 5 === 0;
    const ang = rr(0, 6.28), r = 1.6 + Math.pow(rnd(), 0.6) * 52, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const near = smoothstep(1.6, 6, r);
    e.set(rr(-0.28, 0.28), rr(0, 6.28), rr(-0.28, 0.28)); q.setFromEuler(e);
    m.compose(new V3(x, groundH(x, z) - 0.03, z), q, new V3(cl ? 1.8 : 1, rr(0.2, 0.45) + near * rr(0.1, 0.7), cl ? 1.8 : 1));
    grass.setMatrixAt(i, m); col.setHSL(rr(0.105, 0.16), rr(0.4, 0.6), rr(0.36, 0.56)); grass.setColorAt(i, col);
  }
  grass.receiveShadow = true; group.add(grass);

  /* acacia trees: bent trunk, spreading branches, flat-topped canopy */
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.2 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f6b2e, roughness: 0.95, flatShading: true, envMapIntensity: 0.2 });
  const blobGeo = new THREE.IcosahedronGeometry(1, 2);
  { const bp = blobGeo.attributes.position; for (let i = 0; i < bp.count; i++) { const v = new V3().fromBufferAttribute(bp, i); v.multiplyScalar(0.86 + 0.28 * fbm(v.x * 2 + 5, v.y * 2 + v.z * 2, 2)); bp.setXYZ(i, v.x, v.y, v.z); } blobGeo.computeVertexNormals(); }
  function acacia(x, z, H, spread) {
    const t = new THREE.Group(), lean = new V3(rr(-0.8, 0.8), 0, rr(-0.8, 0.8));
    const top = new V3(lean.x, H * 0.62, lean.z);
    t.add(shadowed(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([new V3(0, -0.3, 0), new V3(lean.x * 0.25, H * 0.3, lean.z * 0.25), top]), 12, 10, (u) => 0.42 - 0.2 * u).geo, barkMat)));
    const n = 6 + Math.floor(rr(0, 3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.28 + rr(-0.3, 0.3), d = k === 0 ? 0 : rr(0.45, 1) * spread;
      const c = new V3(top.x + Math.cos(a) * d, H + rr(-0.35, 0.3), top.z + Math.sin(a) * d);
      const mid = top.clone().lerp(c, 0.55); mid.y = top.y + (c.y - top.y) * 0.8;
      t.add(shadowed(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([top, mid, c]), 8, 7, (u) => 0.17 - 0.11 * u).geo, barkMat)));
      const blob = new THREE.Mesh(blobGeo, leafMat); blob.position.copy(c); blob.rotation.y = rr(0, 6.28);
      const s = rr(0.55, 0.8) * spread; blob.scale.set(s, rr(0.5, 0.75), s); t.add(shadowed(blob));
    }
    t.position.set(x, groundH(x, z), z); group.add(t);
  }
  [[-15, -19, 9.5, 5.2], [19, -30, 11, 6], [-34, -9, 10, 5.5], [30, 13, 9, 5], [-24, 27, 10.5, 5.6], [7, 43, 9.5, 5.2], [48, -14, 11, 6], [-52, -36, 10, 5.5], [-8, -56, 11.5, 6.2], [56, 36, 10, 5.4]]
    .forEach((a) => acacia(...a));

  /* a few weathered rocks */
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x857a6a, roughness: 0.95, flatShading: true, envMapIntensity: 0.2 });
  [[6.5, -4.5, 0.75], [7.6, -3.7, 0.4], [-7.5, 5.5, 0.6], [-12, -8, 1.1], [14, 9, 0.9], [-5, -11, 0.5]].forEach(([x, z, s]) => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i); v.multiplyScalar(0.75 + 0.5 * fbm(v.x * 1.5 + x, v.y * 1.5 + v.z * 1.5 + z, 2)); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const r = shadowed(new THREE.Mesh(g, rockMat)); r.position.set(x, groundH(x, z) + s * 0.25, z); r.scale.set(s * 1.3, s * 0.75, s); r.rotation.y = rr(0, 6.28); group.add(r);
  });

  return {
    kind: 'safari', group, sky, sunDirection, wading: false,
    fog: new THREE.Fog(0xd9d3b6, 40, 190),
    setWaders() {},
    update() {},
  };
}
