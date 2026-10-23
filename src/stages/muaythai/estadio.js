// Estadio de Bangkok: ring con cuerdas y esquinas roja y azul, gradas con público
// low-poly que bota (InstancedMesh + shader), focos con haces y polvo, banderines
// y los músicos tradicionales en una esquina.
import * as THREE from 'three';
import { flat, glow, canvasTexture, mergeMeshes, makeRng } from '../../core/util.js';

export const RING_Y = 1.0;      // altura de la lona
export const RING_HALF = 3.4;   // las cuerdas están en ±RING_HALF

export function crearEstadio(scene, { q, battery }) {
  const vr = makeRng(4242); // aleatorio visual (no afecta a la partida)
  const out = { update() {}, musicos: [], lights: {} };
  scene.background = new THREE.Color('#1c0c07');
  scene.fog = new THREE.Fog('#2a1209', 16, 48);

  // luces: hemisférica cálida + una direccional desde los focos
  const hemi = new THREE.HemisphereLight('#ffd9a0', '#4a1c10', 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0a8', 2.6);
  sun.position.set(2.5, 14, 4); sun.target.position.set(0, RING_Y, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadowSize || 1024, q.shadowSize || 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 4, far: 24 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  out.lights = { hemi, sun };

  // suelo del pabellón
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), flat('#2b170e'));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // ───── ring ─────
  const apronTex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#9d0208'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcf3f'; g.fillRect(0, 4, w, 5); g.fillRect(0, h - 9, w, 5);
    // motivo de rombos dorados (sin texto ni marcas)
    for (let x = 10; x < w; x += 28) { g.beginPath(); g.moveTo(x, h / 2 - 12); g.lineTo(x + 9, h / 2); g.lineTo(x, h / 2 + 12); g.lineTo(x - 9, h / 2); g.closePath(); g.fill(); }
  }, { repeat: [4, 1] });
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.2, RING_Y, 8.2), [
    new THREE.MeshStandardMaterial({ map: apronTex, flatShading: true, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: apronTex, flatShading: true, roughness: 0.8 }),
    flat('#6a040f'), flat('#6a040f'),
    new THREE.MeshStandardMaterial({ map: apronTex, flatShading: true, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: apronTex, flatShading: true, roughness: 0.8 }),
  ]);
  base.position.y = RING_Y / 2 - 0.01; base.receiveShadow = true; scene.add(base);
  const canvasTex = canvasTexture(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    gr.addColorStop(0, '#f6ead2'); gr.addColorStop(1, '#e2cfa8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // esquinas roja y azul
    g.fillStyle = 'rgba(193,18,31,0.85)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 0); g.lineTo(0, 120); g.fill();
    g.fillStyle = 'rgba(29,78,216,0.85)'; g.beginPath(); g.moveTo(w, h); g.lineTo(w - 120, h); g.lineTo(w, h - 120); g.fill();
    // emblema central: flor de loto dorada
    g.save(); g.translate(w / 2, h / 2);
    g.strokeStyle = '#c99a1e'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(214,160,23,0.75)';
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, -52, 20, 46, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#b8860b'; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(120,80,40,0.25)'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
  });
  const lona = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2), new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.95 }));
  lona.rotation.x = -Math.PI / 2; lona.rotation.z = Math.PI / 2; lona.position.y = RING_Y + 0.002; lona.receiveShadow = true; scene.add(lona);
  out.lona = lona;

  // postes: roja (-x,-z), azul (+x,+z), neutras blancas
  const C = RING_HALF + 0.2;
  const corners = [[-C, -C, '#c1121f'], [C, -C, '#f1f1f1'], [C, C, '#1d4ed8'], [-C, C, '#f1f1f1']];
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.85, 8);
  const padGeo = new THREE.BoxGeometry(0.34, 1.35, 0.34);
  for (const [x, z, col] of corners) {
    const p = new THREE.Mesh(postGeo, flat('#c9c9c9', { metalness: 0.6, roughness: 0.35 })); p.position.set(x, RING_Y + 0.9, z); p.castShadow = true; scene.add(p);
    const pad = new THREE.Mesh(padGeo, flat(col)); pad.position.set(x, RING_Y + 1.0, z); pad.rotation.y = Math.PI / 4; pad.castShadow = true; scene.add(pad);
  }
  // cuerdas: 4 alturas (roja, blanca, azul, blanca) unidas por color
  const ropeCols = ['#f1f1f1', '#1d4ed8', '#f1f1f1', '#d62828'];
  const ropeH = [0.42, 0.78, 1.12, 1.46];
  const byCol = new Map();
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, C * 2, 6);
  for (let lv = 0; lv < 4; lv++) {
    for (let s = 0; s < 4; s++) {
      const m = new THREE.Mesh(ropeGeo);
      const y = RING_Y + ropeH[lv];
      if (s < 2) { m.rotation.z = Math.PI / 2; m.position.set(0, y, s === 0 ? -C : C); }
      else { m.rotation.x = Math.PI / 2; m.position.set(s === 2 ? -C : C, y, 0); }
      const col = ropeCols[lv];
      if (!byCol.has(col)) byCol.set(col, []);
      byCol.get(col).push(m);
    }
  }
  for (const [col, list] of byCol) { const mm = mergeMeshes(list, flat(col, { roughness: 0.5 })); mm.castShadow = true; scene.add(mm); }

  // taburetes de esquina y cubo
  for (const [x, z, col] of [[-C - 0.9, -C - 0.9, '#c1121f'], [C + 0.9, C + 0.9, '#1d4ed8']]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 8), flat(col)); st.position.set(x, 0.28, z); scene.add(st);
  }

  // ───── gradas ─────
  const steps = [];
  const stepMat = flat('#3a2116');
  const ROWS = 6, D0 = 6.6, DR = 1.15, H0 = 0.35, HR = 0.62;
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < ROWS; r++) {
      const d = D0 + r * DR, len = (d + 0.6) * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, H0 + r * HR, DR));
      const ang = (s * Math.PI) / 2;
      m.position.set(Math.sin(ang) * (d + DR / 2 - 0.3), (H0 + r * HR) / 2, Math.cos(ang) * (d + DR / 2 - 0.3));
      m.rotation.y = ang;
      steps.push(m);
    }
  }
  const stepMesh = mergeMeshes(steps, stepMat); stepMesh.receiveShadow = false; scene.add(stepMesh);
  // paredes del fondo con franjas rojas y doradas
  const wallTex = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#5c0a0a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcf3f'; g.fillRect(0, 18, w, 6); g.fillRect(0, h - 24, w, 6);
    g.fillStyle = '#c1121f';
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 32, 64); g.lineTo(x, 98); g.lineTo(x - 32, 64); g.fill(); }
    g.fillStyle = '#ffcf3f';
    for (let x = 32; x < w; x += 64) { g.beginPath(); g.arc(x, 64, 8, 0, Math.PI * 2); g.fill(); }
  }, { repeat: [6, 1] });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const WD = D0 + ROWS * DR + 0.4;
  for (let s = 0; s < 4; s++) {
    const ang = (s * Math.PI) / 2;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(WD * 2 + 2, 6), wallMat);
    w.position.set(Math.sin(ang) * WD, H0 + ROWS * HR + 2.6, Math.cos(ang) * WD);
    w.rotation.y = ang + Math.PI;
    scene.add(w);
  }

  // público: cuerpo (2 variantes: brazos arriba / abajo) + cabeza, con bote en el shader
  const crowdScale = battery ? 0.45 : (q.particles >= 1 ? 1 : q.particles >= 0.7 ? 0.75 : 0.5);
  const seats = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < ROWS; r++) {
      const d = D0 + r * DR + 0.15, half = d - 0.2;
      for (let x = -half; x <= half; x += 0.62) {
        if (vr() > crowdScale) continue;
        const ang = (s * Math.PI) / 2;
        const lx = x + (vr() - 0.5) * 0.2;
        const px = Math.sin(ang) * d + Math.cos(ang) * lx, pz = Math.cos(ang) * d - Math.sin(ang) * lx;
        seats.push({ x: px, z: pz, y: H0 + r * HR, rot: ang + Math.PI });
      }
    }
  }
  const bodyA = new THREE.BoxGeometry(0.4, 0.5, 0.28); bodyA.translate(0, 0.25, 0);
  const armsUp = mergeGeo([bodyA.clone(), boxAt(0.09, 0.42, 0.09, -0.24, 0.62, 0, 0.35), boxAt(0.09, 0.42, 0.09, 0.24, 0.62, 0, -0.35)]);
  const armsDown = mergeGeo([bodyA.clone(), boxAt(0.09, 0.4, 0.09, -0.25, 0.25, 0.04, 0.1), boxAt(0.09, 0.4, 0.09, 0.25, 0.25, 0.04, -0.1)]);
  const headGeo = new THREE.IcosahedronGeometry(0.15, 0); headGeo.translate(0, 0.66, 0);
  const shirtCols = ['#c1121f', '#ffcf3f', '#f1f1f1', '#e85d04', '#9d0208', '#1d4ed8', '#ffd166', '#f48c06', '#6a040f', '#2a9d8f'];
  const skins = ['#f1c9a5', '#e0ac7e', '#c68a5e', '#a86b43', '#7a4a2c'];
  const crowdMat = (extra) => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85, ...extra });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = out.uTime; sh.uniforms.uExcite = out.uExcite;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aBounce; uniform float uTime; uniform float uExcite;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += max(0.0, sin(uTime * aBounce.y + aBounce.x)) * (0.05 + 0.26 * uExcite * (0.5 + 0.5 * fract(aBounce.x * 3.7)));');
    };
    return m;
  };
  out.uTime = { value: 0 }; out.uExcite = { value: 0.2 };
  const nUp = seats.filter((_, i) => i % 3 === 0).length;
  const meshes = {
    up: new THREE.InstancedMesh(armsUp, crowdMat(), nUp),
    down: new THREE.InstancedMesh(armsDown, crowdMat(), seats.length - nUp),
    head: new THREE.InstancedMesh(headGeo, crowdMat(), seats.length),
  };
  const bounce = { up: new Float32Array(nUp * 2), down: new Float32Array((seats.length - nUp) * 2), head: new Float32Array(seats.length * 2) };
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  let iu = 0, id = 0;
  seats.forEach((st, i) => {
    tmp.position.set(st.x, st.y, st.z); tmp.rotation.set(0, st.rot + (vr() - 0.5) * 0.4, 0); tmp.scale.setScalar(0.9 + vr() * 0.25); tmp.updateMatrix();
    const ph = vr() * 6.28, sp = 7 + vr() * 5;
    const key = i % 3 === 0 ? 'up' : 'down';
    const k = key === 'up' ? iu++ : id++;
    meshes[key].setMatrixAt(k, tmp.matrix);
    meshes[key].setColorAt(k, col.set(shirtCols[Math.floor(vr() * shirtCols.length)]));
    bounce[key][k * 2] = ph; bounce[key][k * 2 + 1] = sp;
    meshes.head.setMatrixAt(i, tmp.matrix);
    meshes.head.setColorAt(i, col.set(skins[Math.floor(vr() * skins.length)]));
    bounce.head[i * 2] = ph; bounce.head[i * 2 + 1] = sp;
  });
  for (const k of ['up', 'down', 'head']) {
    meshes[k].geometry.setAttribute('aBounce', new THREE.InstancedBufferAttribute(bounce[k], 2));
    meshes[k].frustumCulled = false;
    scene.add(meshes[k]);
  }

  // ───── focos: estructura, lámparas, haces de luz y polvo ─────
  const TY = 8.6;
  const truss = [];
  for (const s of [-1, 1]) {
    truss.push(boxMesh(7.4, 0.18, 0.18, 0, TY, s * 3.6));
    truss.push(boxMesh(0.18, 0.18, 7.4, s * 3.6, TY, 0));
  }
  scene.add(mergeMeshes(truss, flat('#2a2a2e', { metalness: 0.6 })));
  const lampPos = [];
  for (const s of [-1, 1]) for (const k of [-1.8, 1.8]) { lampPos.push([k, s * 3.6]); lampPos.push([s * 3.6, k]); }
  const lampBodies = [], lampFaces = [];
  for (const [x, z] of lampPos) {
    lampBodies.push(boxMesh(0.42, 0.36, 0.42, x, TY - 0.3, z));
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.17, 10)); f.rotation.x = Math.PI / 2; f.position.set(x, TY - 0.49, z); lampFaces.push(f);
  }
  scene.add(mergeMeshes(lampBodies, flat('#1a1a1e')));
  const lampFace = mergeMeshes(lampFaces, glow('#ffe6a8', 2.2)); lampFace.material.side = THREE.DoubleSide; scene.add(lampFace);
  // haces (conos aditivos muy suaves)
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const beams = [];
  for (const [x, z] of [[-1.8, -3.6], [1.8, 3.6], [3.6, -1.8], [-3.6, 1.8]]) {
    const len = TY - RING_Y - 0.4;
    const g = new THREE.CylinderGeometry(0.2, 1.9, len, 14, 1, true); g.translate(0, -len / 2, 0);
    const b = new THREE.Mesh(g, beamMat);
    b.position.set(x, TY - 0.45, z);
    b.lookAt(x * 0.15, RING_Y, z * 0.15);
    b.rotateX(-Math.PI / 2);
    beams.push(b); scene.add(b);
  }
  // polvo en los focos
  const nDust = Math.round((battery ? 60 : 180) * (q.particles || 1));
  const dPos = new Float32Array(nDust * 3), dSeed = new Float32Array(nDust * 3);
  for (let i = 0; i < nDust; i++) {
    dSeed[i * 3] = (vr() - 0.5) * 7; dSeed[i * 3 + 1] = RING_Y + 0.6 + vr() * 6.5; dSeed[i * 3 + 2] = (vr() - 0.5) * 7;
  }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dustTex = canvasTexture(32, 32, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.07, map: dustTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffd89a' }));
  dust.frustumCulled = false; scene.add(dust);

  // banderines rojos, dorados y blancos desde la estructura a las gradas
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.34, 0], 3));
  flagGeo.computeVertexNormals();
  const flagPts = [];
  for (let s = 0; s < 4; s++) {
    const ang = (s * Math.PI) / 2 + Math.PI / 4;
    const a = new THREE.Vector3(Math.sin(ang) * 5.0, TY, Math.cos(ang) * 5.0);
    const b = new THREE.Vector3(Math.sin(ang) * 14, 7.2, Math.cos(ang) * 14);
    for (let i = 1; i < 22; i++) {
      const t = i / 22; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 1.4;
      flagPts.push({ p, ang });
    }
  }
  for (let s = 0; s < 4; s++) {
    const ang = (s * Math.PI) / 2;
    const a = new THREE.Vector3(Math.sin(ang) * 3.6 + Math.cos(ang) * 3.6, TY, Math.cos(ang) * 3.6 - Math.sin(ang) * 3.6);
    const b = new THREE.Vector3(Math.sin(ang) * 3.6 - Math.cos(ang) * 3.6, TY, Math.cos(ang) * 3.6 + Math.sin(ang) * 3.6);
    for (let i = 1; i < 14; i++) { const t = i / 14; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.5; flagPts.push({ p, ang: ang + Math.PI / 2 }); }
  }
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, flatShading: true, roughness: 0.7 }), flagPts.length);
  const fcols = ['#c1121f', '#ffcf3f', '#f1f1f1'];
  flagPts.forEach((f, i) => {
    tmp.position.copy(f.p); tmp.rotation.set(0, f.ang + Math.PI / 2, 0); tmp.scale.setScalar(1); tmp.updateMatrix();
    flags.setMatrixAt(i, tmp.matrix); flags.setColorAt(i, col.set(fcols[i % 3]));
  });
  scene.add(flags);

  // ───── músicos (piphat): pi, dos tambores klong, ching y gong en círculo ─────
  const mus = new THREE.Group(); mus.position.set(4.95, 0, -5.25); mus.rotation.y = -0.72; scene.add(mus);
  const dais = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 1.6), flat('#7a1010')); dais.position.y = 0.15; mus.add(dais);
  const rugTrim = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.06, 1.7), flat('#ffcf3f')); rugTrim.position.y = 0.31; mus.add(rugTrim);
  const looksM = [
    { shirt: '#1d3557', skin: '#c68a5e', hat: false, inst: 'pi' },
    { shirt: '#f1f1f1', skin: '#a86b43', hat: false, inst: 'drum' },
    { shirt: '#8d0801', skin: '#e0ac7e', hat: false, inst: 'gong' },
    { shirt: '#ffcf3f', skin: '#7a4a2c', hat: false, inst: 'ching' },
  ];
  looksM.forEach((lk, i) => {
    const g = new THREE.Group(); g.position.set(-1.6 + i * 1.07, 0.33, 0); mus.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.6, 7), flat(lk.shirt)); body.position.y = 0.45; g.add(body);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.42), flat('#2b2d42')); legs.position.set(0, 0.1, 0.12); g.add(legs);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), flat(lk.skin)); head.position.y = 0.92; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), flat('#1a1210')); hair.position.y = 0.93; g.add(hair);
    const armL = new THREE.Group(); armL.position.set(0.22, 0.68, 0); g.add(armL);
    const armR = new THREE.Group(); armR.position.set(-0.22, 0.68, 0); g.add(armR);
    for (const a of [armL, armR]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.09), flat(lk.skin)); m.position.set(0, -0.18, 0.1); m.rotation.x = -0.9; a.add(m); }
    if (lk.inst === 'pi') {
      const pi = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.45, 6), flat('#5a3a1e')); pi.position.set(0, 0.72, 0.3); pi.rotation.x = 1.0; g.add(pi);
    } else if (lk.inst === 'drum') {
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.6, 9), flat(s < 0 ? '#8a5a2b' : '#6b3f1d')); d.rotation.z = Math.PI / 2; d.position.set(0, 0.32 + (s > 0 ? 0.0 : 0.1), 0.38 + s * 0.12); g.add(d); }
    } else if (lk.inst === 'gong') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 5, 16), flat('#6b3f1d')); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.3, 0.15); g.add(ring);
      const gm = flat('#d4a017', { metalness: 0.7, roughness: 0.35 });
      for (let k = 0; k < 9; k++) { const a = Math.PI * 0.15 + (k / 8) * Math.PI * 1.7; const gg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 8), gm); gg.position.set(Math.cos(a) * 0.45, 0.35, 0.15 + Math.sin(a) * 0.45); g.add(gg); }
    } else {
      for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 9), flat('#d4a017', { metalness: 0.8, roughness: 0.3 })); c.position.set(s * 0.1, 0.62, 0.38); c.rotation.z = s * 1.2; g.add(c); }
    }
    out.musicos.push({ g, armL, armR, head, inst: lk.inst, ph: i * 1.3 });
  });

  // ───── animación ─────
  let tAcc = 0;
  out.playing = 0.4; // intensidad con la que tocan los músicos (0..1)
  out.update = (dt, excite) => {
    tAcc += dt;
    out.uTime.value = tAcc;
    out.uExcite.value += (excite - out.uExcite.value) * Math.min(1, dt * 3);
    for (let i = 0; i < nDust; i++) {
      const t = tAcc * 0.25 + i;
      dPos[i * 3] = dSeed[i * 3] + Math.sin(t * 0.7) * 0.4;
      dPos[i * 3 + 1] = dSeed[i * 3 + 1] + Math.sin(t * 0.5 + i) * 0.3;
      dPos[i * 3 + 2] = dSeed[i * 3 + 2] + Math.cos(t * 0.6) * 0.4;
    }
    dGeo.attributes.position.needsUpdate = true;
    beamMat.opacity = 0.05 + Math.sin(tAcc * 1.3) * 0.008;
    const k = out.playing;
    for (const m of out.musicos) {
      const s = tAcc * (5 + k * 4) + m.ph;
      m.head.position.y = 0.92 + Math.sin(s * 0.5) * 0.02 * (1 + k);
      if (m.inst === 'drum' || m.inst === 'gong') { m.armL.rotation.x = Math.sin(s) * 0.5 * k; m.armR.rotation.x = -Math.sin(s) * 0.5 * k; }
      else if (m.inst === 'ching') { m.armL.rotation.z = Math.max(0, Math.sin(s)) * 0.3 * k; m.armR.rotation.z = -Math.max(0, Math.sin(s)) * 0.3 * k; }
      else { m.g.rotation.z = Math.sin(s * 0.25) * 0.05 * k; }
    }
  };
  return out;
}

function boxMesh(w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); return m; }
function boxAt(w, h, d, x, y, z, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); g.rotateZ(rz); g.translate(x, y, z); return g; }
function mergeGeo(list) {
  const meshes = list.map((g) => new THREE.Mesh(g));
  const m = mergeMeshes(meshes, null);
  return m.geometry;
}
