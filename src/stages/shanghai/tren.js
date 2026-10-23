// Tren maglev low-poly: dos coches con morro aerodinámico, franja azul, ventanillas
// encendidas, brillo de levitación, faros con haz y escudo de turbo.
import * as THREE from 'three';
import { glow, mergeMeshes, canvasTexture } from '../../core/util.js';

// Sección del coche (x, y), en bucle. Cada tramo i va del punto i al i+1.
const PROFILE = [
  [-1.2, 0.0], [-1.5, 0.35], [-1.58, 1.05], [-1.58, 1.45], [-1.5, 1.75], [-1.4, 2.35], [-1.05, 2.95], [-0.45, 3.22],
  [0.45, 3.22], [1.05, 2.95], [1.4, 2.35], [1.5, 1.75], [1.58, 1.45], [1.58, 1.05], [1.5, 0.35], [1.2, 0.0],
];
// k = faldón oscuro, w = blanco, b = franja azul, g = banda de ventanillas
const SEG = ['k', 'w', 'b', 'w', 'g', 'w', 'w', 'w', 'w', 'w', 'g', 'w', 'b', 'w', 'k', 'k'];
const COL = { k: new THREE.Color('#283044'), w: new THREE.Color('#eef2f8'), b: new THREE.Color('#1f6feb'), g: new THREE.Color('#16223f') };

function loft(rings, glassFn) {
  const body = [], cols = [], glass = [];
  const P = (r, i) => { const [x, y] = PROFILE[i % PROFILE.length]; return [x * r.sx, y * r.sy + r.dy, r.z]; };
  const pushTri = (arr, a, b, c) => arr.push(...a, ...b, ...c);
  for (let k = 0; k < rings.length - 1; k++) {
    const a = rings[k], b = rings[k + 1];
    for (let i = 0; i < PROFILE.length; i++) {
      const p1 = P(a, i), p2 = P(a, i + 1), p3 = P(b, i + 1), p4 = P(b, i);
      if (glassFn && glassFn(i, k)) { pushTri(glass, p1, p2, p3); pushTri(glass, p1, p3, p4); continue; }
      pushTri(body, p1, p2, p3); pushTri(body, p1, p3, p4);
      const c = COL[SEG[i]];
      for (let t = 0; t < 6; t++) cols.push(c.r, c.g, c.b);
    }
  }
  // tapas en los extremos que no acaban en punta
  for (const r of [rings[0], rings[rings.length - 1]]) {
    if (r.sx < 0.1) continue;
    const c = [0, 1.6 * r.sy + r.dy, r.z];
    for (let i = 0; i < PROFILE.length; i++) {
      pushTri(body, c, P(r, i), P(r, i + 1));
      for (let t = 0; t < 3; t++) cols.push(COL.w.r, COL.w.g, COL.w.b);
    }
  }
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.Float32BufferAttribute(body, 3));
  g1.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g1.computeVertexNormals();
  let g2 = null;
  if (glass.length) { g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(glass, 3)); g2.computeVertexNormals(); }
  return { body: g1, glass: g2 };
}

const NOSE = [
  { z: 0, sx: 0.03, sy: 0.03, dy: 0.55 }, { z: 0.8, sx: 0.32, sy: 0.22, dy: 0.35 }, { z: 2.2, sx: 0.62, sy: 0.42, dy: 0.2 },
  { z: 4.2, sx: 0.84, sy: 0.66, dy: 0.1 }, { z: 6.2, sx: 0.96, sy: 0.88, dy: 0.03 }, { z: 8.2, sx: 1, sy: 1, dy: 0 },
];
export const CAR1 = 22, CAR2 = 22, GAP = 1;

function beamTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.5, 'rgba(255,230,180,0.35)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sg = g.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.3, 'rgba(0,0,0,0)'); sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = sg; g.fillRect(0, 0, w, h);
  });
}

export function makeShieldMaterial(color = '#4cc9f0') {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = position.z; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOp; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 2.2); float sc = 0.6 + 0.4 * sin(vY * 9.0 - uTime * 18.0); gl_FragColor = vec4(uColor * (f * 2.8 + 0.14) * sc * uOp, 1.0); }',
  });
}

export function makeTrain(ctx) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.32, metalness: 0.15, emissive: '#1c2440', side: THREE.DoubleSide });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0d1a3a', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });

  // coche 1 (morro en z=0, el cuerpo hacia +z: el tren avanza hacia -z)
  const lead = new THREE.Group();
  const l1 = loft([...NOSE, { z: CAR1, sx: 1, sy: 1, dy: 0 }], (i, k) => (k === 2 || k === 3) && i >= 5 && i <= 9);
  const leadBody = new THREE.Mesh(l1.body, bodyMat); leadBody.castShadow = true; lead.add(leadBody);
  const leadGlass = new THREE.Mesh(l1.glass, glassMat); leadGlass.renderOrder = 2; lead.add(leadGlass);
  group.add(lead);

  // coche 2 (cola en punta)
  const car2 = new THREE.Group();
  const tail = NOSE.map((r) => ({ ...r, z: CAR2 - r.z })).reverse();
  const l2 = loft([{ z: 0, sx: 1, sy: 1, dy: 0 }, ...tail]);
  const c2Body = new THREE.Mesh(l2.body, bodyMat); c2Body.castShadow = true; car2.add(c2Body);
  car2.position.z = CAR1 + GAP;
  group.add(car2);

  // ventanillas encendidas (una sola malla por coche)
  const winGlow = glow('#ffd89a', 1.5);
  const mkWins = (from, to) => {
    const list = [];
    for (let z = from; z < to; z += 1.55) for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 1.05), winGlow);
      m.position.set(1.47 * s, 2.05, z); m.rotation.z = -0.16 * s; list.push(m);
    }
    return mergeMeshes(list, winGlow);
  };
  lead.add(mkWins(9.2, CAR1 - 0.8));
  car2.add(mkWins(1.2, 14.5));

  // líneas de luz bajo la franja y brillo de levitación
  const cyan = glow('#4cc9f0', 2.2);
  const mkLines = (from, to) => {
    const list = [];
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, to - from), cyan); m.position.set(1.59 * s, 0.98, (from + to) / 2); list.push(m); }
    const under = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, to - from), cyan); under.position.set(0, 0.03, (from + to) / 2); list.push(under);
    return mergeMeshes(list, cyan);
  };
  lead.add(mkLines(7.5, CAR1 - 0.2));
  car2.add(mkLines(0.2, 15));

  // faros y luces traseras
  const head = glow('#fff4d0', 3);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.3), head); m.position.set(0.3 * s, 0.5, 0.9); lead.add(m); }
  const red = glow('#ff2d3a', 2.5);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), red); m.position.set(0.3 * s, 0.5, CAR2 - 0.9); car2.add(m); }
  // haz de los faros sobre la vía
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 70), new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, -0.48, -34); lead.add(beam);

  // halo azul de levitación sobre la guía
  const lev = new THREE.Mesh(new THREE.PlaneGeometry(3.6, CAR1 + CAR2 + GAP), new THREE.MeshBasicMaterial({ color: '#2a8cff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  lev.rotation.x = -Math.PI / 2; lev.position.set(0, -0.45, (CAR1 + CAR2 + GAP) / 2); lead.add(lev);

  // escudo del turbo
  const shieldMat = makeShieldMaterial();
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), shieldMat);
  shield.scale.set(2.7, 2.6, 13); shield.position.set(0, 1.6, 10); shield.visible = false; lead.add(shield);

  // los dos viajeros en la cabina (se ven en la intro y se esconden luego para ahorrar)
  const chars = [0, 1].map((i) => {
    const ch = ctx.makeCharacter(ctx.looks[i]);
    ch.pose('sit');
    ch.group.scale.setScalar(0.9);
    ch.group.position.set(i === 0 ? -0.6 : 0.6, 0.42, 5.9);
    ch.group.rotation.y = Math.PI;
    lead.add(ch.group);
    return ch;
  });

  return { group, lead, car2, beam, lev, shield, shieldMat, chars, bodyMat };
}
