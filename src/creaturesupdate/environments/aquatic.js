// Aquatic environment: shallow marsh at dawn, reeds, and a sand mound in the distance.
// Water surface is y = 0. Creatures that wade are lowered by their own wadeDepth.
import * as THREE from 'three';
import { V3, makeRng, canvasTexture, fbm, noise2, smoothstep, skyDome, sunRig } from '../kit.js';

export function createAquatic({ lights = true } = {}) {
  const rnd = makeRng(4417), rr = rnd.range;
  const group = new THREE.Group(); group.name = 'env-aquatic';
  const sunDirection = new V3(7, 10, 5).normalize();

  const sky = skyDome([[0, '#23415f'], [0.3, '#5d87a6'], [0.44, '#b9c9cc'], [0.5, '#f3d9ae'], [0.54, '#8d9486'], [1, '#26332f']]);
  group.add(sky);
  if (lights) group.add(sunRig({ direction: sunDirection, sunColor: 0xffe0b4, sunIntensity: 6.2, skyColor: 0xbcd4e6, groundColor: 0x3a3f2e, skyIntensity: 0.9, rimIntensity: 2.4 }));

  /* water with slow ripples */
  const N = 256;
  const waterN = canvasTexture(N, N, (g) => {
    const img = g.createImageData(N, N), waves = [];
    for (let i = 0; i < 9; i++) waves.push({ fx: Math.round(rr(-6, 6)), fy: Math.round(rr(1, 7)), ph: rr(0, 6.28), a: rr(0.4, 1) });
    const k = (2 * Math.PI) / N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) { const cc = Math.cos(k * (w.fx * x + w.fy * y) + w.ph) * w.a; dx += cc * w.fx; dy += cc * w.fy; }
      const v = new V3(-dx * 0.09, -dy * 0.09, 1).normalize(), i = (y * N + x) * 4;
      img.data[i] = (v.x * 0.5 + 0.5) * 255; img.data[i + 1] = (v.y * 0.5 + 0.5) * 255; img.data[i + 2] = (v.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: 18 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(150, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a6a76, roughness: 0.1, metalness: 0.25, normalMap: waterN, normalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 1.5 }));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = true; group.add(water);

  /* sand mound in the distance: a low wind-shaped bar rising out of the water */
  const moundPos = new V3(-9, 0, -25);
  const moundH = (x, z) => {
    const main = Math.exp(-(((x + 2) / 8.5) ** 2) - (z / 3.4) ** 2) * 3.3;
    const spur = Math.exp(-(((x - 7.5) / 4.5) ** 2) - ((z - 1.2) / 2.4) ** 2) * 1.7;
    const shape = Math.max(main, spur) + Math.min(main, spur) * 0.5;
    return shape * (0.78 + 0.34 * fbm(x * 0.22 + 9, z * 0.22, 3)) + 0.09 * Math.sin(x * 2.6 + z * 1.1 + 3 * noise2(x * 0.4, z * 0.4)) * smoothstep(0.2, 0.9, shape) - 0.22;
  };
  const mg = new THREE.PlaneGeometry(34, 15, 170, 76); mg.rotateX(-Math.PI / 2);
  const mp = mg.attributes.position, mcol = [];
  const dry = new THREE.Color(0xc9a66c), pale = new THREE.Color(0xe8d3a0), wet = new THREE.Color(0x7a623f), tmp = new THREE.Color();
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), z = mp.getZ(i), h = moundH(x, z); mp.setY(i, h);
    tmp.copy(dry).lerp(pale, fbm(x * 0.5, z * 0.5 + 4, 3));
    tmp.lerp(wet, 1 - smoothstep(0.02, 0.32, h));           // darker damp sand at the waterline
    mcol.push(tmp.r, tmp.g, tmp.b);
  }
  mg.setAttribute('color', new THREE.Float32BufferAttribute(mcol, 3)); mg.computeVertexNormals();
  const grain = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const v = Math.floor(rr(150, 255)); g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(rr(0, 256), rr(0, 256), 1.3, 1.3); }
  }, { repeat: 14 });
  const mound = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.96, envMapIntensity: 0.25 }));
  mound.position.copy(moundPos); mound.rotation.y = 0.35; mound.receiveShadow = true; group.add(mound);

  /* reeds in the shallows, and sparse dune grass on the mound */
  const reedGeo = new THREE.ConeGeometry(0.035, 1, 5); reedGeo.translate(0, 0.5, 0);
  const reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, envMapIntensity: 0.3 }), 420 + 160);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  let i = 0;
  for (let cl = 0; cl < 28; cl++) {
    const ang = rr(0, 6.28), rad = rr(5.5, 26), cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
    for (let k = 0; k < 15; k++, i++) {
      e.set(rr(-0.16, 0.16), rr(0, 6.28), rr(-0.16, 0.16)); q.setFromEuler(e);
      m.compose(new V3(cx + rr(-0.9, 0.9), -0.05, cz + rr(-0.9, 0.9)), q, new V3(1, rr(1.3, 3.1), 1));
      reeds.setMatrixAt(i, m); col.setHSL(rr(0.15, 0.26), rr(0.3, 0.5), rr(0.1, 0.2)); reeds.setColorAt(i, col);
    }
  }
  const cy = Math.cos(0.35), sy = Math.sin(0.35);
  for (let k = 0; k < 160; k++, i++) {
    let x, z, h, tries = 0;
    do { x = rr(-12, 12); z = rr(-4, 4); h = moundH(x, z); } while (h < 1.2 && ++tries < 30);
    e.set(rr(-0.3, 0.3), rr(0, 6.28), rr(-0.3, 0.3)); q.setFromEuler(e);
    m.compose(new V3(moundPos.x + x * cy + z * sy, h - 0.03, moundPos.z - x * sy + z * cy), q, new V3(1.2, rr(0.5, 1.1), 1.2));
    reeds.setMatrixAt(i, m); col.setHSL(rr(0.13, 0.2), rr(0.3, 0.45), rr(0.25, 0.4)); reeds.setColorAt(i, col);
  }
  group.add(reeds);

  /* ripple rings where a wading creature's legs meet the water */
  const ripples = [], rippleGroup = new THREE.Group(); group.add(rippleGroup);
  function setWaders(points = []) {
    ripples.forEach((r) => { r.geometry.dispose(); r.material.dispose(); }); ripples.length = 0; rippleGroup.clear();
    points.forEach((p, pi) => { for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.12, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.006, p.z); ring.userData.ph = k * 0.5 + pi * 0.25;
      rippleGroup.add(ring); ripples.push(ring);
    } });
  }

  return {
    kind: 'aquatic', group, sky, sunDirection, wading: true,
    fog: new THREE.Fog(0xd9c7a6, 18, 80),
    setWaders,
    update(t) {
      waterN.offset.set(t * 0.004, t * 0.007);
      ripples.forEach((r) => { const u = (t * 0.28 + r.userData.ph) % 1, s = 0.12 + u * 0.75; r.scale.set(s, s, s); r.material.opacity = 0.16 * (1 - u); });
    },
  };
}
