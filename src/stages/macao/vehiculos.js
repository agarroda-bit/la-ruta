// MACAO · vehículos: el cochecito descapotable alquilado, el taxi del Taxista Zhou y los
// autobuses lentos (instanciados). Todos miran hacia +Z, ruedas en el suelo (y=0).
import * as THREE from 'three';
import { flat, glow, canvasTexture } from '../../core/util.js';

let coneTex = null, poolTex = null;
function lightTextures() {
  if (coneTex) return;
  coneTex = canvasTexture(4, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff2c8'); g.addColorStop(0.35, '#4a3c24'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  poolTex = canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}
export function softTexture() { lightTextures(); return poolTex; }

function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; }

function wheels(g, mat, rimMat, z1, z2, x) {
  const list = [];
  const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10); geo.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 6); rim.rotateZ(Math.PI / 2);
  for (const z of [z1, z2]) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(x * s, 0.36, z);
    const t = new THREE.Mesh(geo, mat); t.castShadow = true; w.add(t);
    w.add(new THREE.Mesh(rim, rimMat));
    g.add(w); list.push(w);
  }
  return list;
}

// Faros: conos aditivos + mancha de luz en el suelo
function headlights(g, z, x) {
  lightTextures();
  const coneMat = new THREE.MeshBasicMaterial({ map: coneTex, color: '#ffe6b0', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const geo = new THREE.ConeGeometry(1.5, 10, 12, 1, true);
  geo.translate(0, -5, 0); geo.rotateX(-Math.PI / 2 - 0.09);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(geo, coneMat); c.position.set(x * s, 0.62, z); c.renderOrder = 2; g.add(c); }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 9), new THREE.MeshBasicMaterial({ map: poolTex, color: '#ffdca0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, z + 6.5); pool.renderOrder = 1; g.add(pool);
}

// Cochecito alquilado (descapotable morado). opts: { people: [lookConductor, lookCopi], makeCharacter, lights }
export function makeCar({ color = '#7b2cbf', people = null, makeCharacter = null, lights = true } = {}) {
  const g = new THREE.Group();
  const body = flat(color), dark = flat('#1b1030'), chrome = flat('#d9d2e9', { metalness: 0.5, roughness: 0.3 });
  g.add(box(1.8, 0.5, 3.7, body, 0, 0.62, 0));
  const hood = box(1.7, 0.18, 1.3, body, 0, 0.92, 1.1); hood.rotation.x = 0.08; g.add(hood);
  const trunk = box(1.7, 0.18, 0.8, body, 0, 0.92, -1.35); g.add(trunk);
  g.add(box(1.82, 0.14, 3.75, flat('#ffb703'), 0, 0.5, 0)); // franja ámbar
  g.add(box(1.86, 0.2, 0.25, chrome, 0, 0.48, 1.9));
  g.add(box(1.86, 0.2, 0.25, chrome, 0, 0.48, -1.9));
  // parabrisas
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: '#b9a6ff', transparent: true, opacity: 0.35, roughness: 0.1 }));
  glass.position.set(0, 1.22, 0.42); glass.rotation.x = -0.45; g.add(glass);
  g.add(box(1.62, 0.06, 0.08, dark, 0, 1.45, 0.3));
  // asientos (volante a la derecha: en Macao se conduce por la izquierda)
  for (const s of [-1, 1]) { g.add(box(0.6, 0.6, 0.18, dark, 0.42 * s, 1.05, -0.55)); }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 10), dark); wheel.position.set(-0.42, 1.12, 0.12); wheel.rotation.x = -0.6; g.add(wheel);
  const ws = wheels(g, flat('#141018'), chrome, 1.2, -1.2, 0.86);
  // faros y pilotos
  const headMat = glow('#fff1c9', 2);
  for (const s of [-1, 1]) g.add(box(0.36, 0.18, 0.06, headMat, 0.6 * s, 0.7, 1.86));
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2d6f').multiplyScalar(1.2), toneMapped: false });
  for (const s of [-1, 1]) g.add(box(0.4, 0.16, 0.06, tailMat, 0.6 * s, 0.72, -1.86));
  if (lights) headlights(g, 1.9, 0.6);
  const out = { group: g, wheels: ws, tailMat, driver: null, copilot: null };
  if (people && makeCharacter) {
    const d = makeCharacter(people[0]); d.pose('ride'); d.group.position.set(-0.42, 0.42, -0.45); d.group.scale.setScalar(0.92); g.add(d.group);
    const c = makeCharacter(people[1]); c.pose('sit'); c.group.position.set(0.42, 0.42, -0.45); c.group.scale.setScalar(0.92); g.add(c.group);
    out.driver = d; out.copilot = c;
  }
  g.traverse((o) => { if (o.isMesh && o.material && o.material.blending !== THREE.AdditiveBlending && !o.material.transparent) o.castShadow = true; });
  out.setBrake = (k) => { out.tailMat.color.set('#ff2d6f').multiplyScalar(1.2 + k * 2.2); };
  return out;
}

// Taxi del Taxista Zhou: ámbar con franja morada y cartelito luminoso
export function makeTaxi({ makeCharacter = null, look = null } = {}) {
  const g = new THREE.Group();
  const body = flat('#ffb703'), stripe = flat('#5a189a'), dark = flat('#1b1030'), chrome = flat('#e8e2f2', { metalness: 0.5, roughness: 0.3 });
  g.add(box(1.9, 0.6, 4.2, body, 0, 0.66, 0));
  g.add(box(1.92, 0.16, 4.22, stripe, 0, 0.78, 0));
  g.add(box(1.94, 0.2, 0.25, chrome, 0, 0.48, 2.12));
  g.add(box(1.94, 0.2, 0.25, chrome, 0, 0.48, -2.12));
  // cabina con cristales oscuros semitransparentes
  const glassMat = new THREE.MeshStandardMaterial({ color: '#2a1a4a', transparent: true, opacity: 0.45, roughness: 0.1 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.1), glassMat); cab.position.set(0, 1.27, -0.2); g.add(cab);
  g.add(box(1.72, 0.08, 2.12, body, 0, 1.6, -0.2));
  // cartel TAXI
  const signTex = canvasTexture(128, 48, (c, w, h) => {
    c.fillStyle = '#2a0f45'; c.fillRect(0, 0, w, h);
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ffcf5a'; c.shadowBlur = 10; c.fillStyle = '#fff3c4'; c.fillText('TAXI', w / 2, h / 2 + 2);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.4), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
  sign.position.set(0, 1.82, -0.2); g.add(sign);
  const ws = wheels(g, flat('#141018'), chrome, 1.35, -1.35, 0.9);
  const headMat = glow('#fff1c9', 2);
  for (const s of [-1, 1]) g.add(box(0.36, 0.18, 0.06, headMat, 0.62 * s, 0.74, 2.11));
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2d6f').multiplyScalar(1.4), toneMapped: false });
  for (const s of [-1, 1]) g.add(box(0.4, 0.16, 0.06, tailMat, 0.62 * s, 0.76, -2.11));
  headlights(g, 2.15, 0.62);
  let zhou = null;
  if (makeCharacter && look) {
    zhou = makeCharacter(look); zhou.pose('ride'); zhou.group.position.set(-0.42, 0.45, -0.1); zhou.group.scale.setScalar(0.9); g.add(zhou.group);
  }
  return { group: g, wheels: ws, zhou };
}

// Autobuses lentos (tráfico): todos en InstancedMesh → pocos draw calls
export function makeBuses(scene, n) {
  const bodyGeo = new THREE.BoxGeometry(2.5, 2.4, 9.6); bodyGeo.translate(0, 1.75, 0);
  const roofGeo = new THREE.BoxGeometry(2.3, 0.3, 9.2); roofGeo.translate(0, 3.1, 0);
  const winGeo = new THREE.BoxGeometry(2.56, 0.75, 8.4); winGeo.translate(0, 2.25, -0.3);
  const frontGeo = new THREE.BoxGeometry(2.2, 0.5, 0.06); frontGeo.translate(0, 2.7, 4.82);
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.56, 10); wheelGeo.rotateZ(Math.PI / 2); wheelGeo.translate(0, 0.5, 0);
  const signTex = canvasTexture(128, 32, (c, w, h) => {
    c.fillStyle = '#120a20'; c.fillRect(0, 0, w, h);
    c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffcf5a'; c.fillText('AL FERRY', w / 2, h / 2 + 1);
  });
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.7 }), n);
  const roofs = new THREE.InstancedMesh(roofGeo, flat('#f4ecdc'), n);
  const wins = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46b').multiplyScalar(1.1), toneMapped: false }), n);
  const fronts = new THREE.InstancedMesh(frontGeo, new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }), n);
  const wheelsM = new THREE.InstancedMesh(wheelGeo, flat('#141018'), n * 2);
  const cols = ['#2a9d8f', '#e9c46a', '#9b5de5', '#ef8354', '#4d7cfe'];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) bodies.setColorAt(i, c.set(cols[i % cols.length]));
  bodies.castShadow = true;
  for (const m of [bodies, roofs, wins, fronts, wheelsM]) { m.frustumCulled = false; scene.add(m); }
  const tmp = new THREE.Object3D();
  return {
    set(i, pos, yaw) {
      tmp.position.copy(pos); tmp.rotation.set(0, yaw, 0); tmp.updateMatrix();
      bodies.setMatrixAt(i, tmp.matrix); roofs.setMatrixAt(i, tmp.matrix); wins.setMatrixAt(i, tmp.matrix); fronts.setMatrixAt(i, tmp.matrix);
      for (let k = 0; k < 2; k++) {
        tmp.position.copy(pos).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(k ? -3.2 : 3.2));
        tmp.updateMatrix(); wheelsM.setMatrixAt(i * 2 + k, tmp.matrix);
      }
    },
    commit() { for (const m of [bodies, roofs, wins, fronts, wheelsM]) m.instanceMatrix.needsUpdate = true; },
  };
}
