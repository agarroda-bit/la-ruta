// Modelos low-poly de Phuket hechos con código. Todo se "hornea" en geometrías con
// color por vértice (Kit) para que cada objeto sea 1 draw call.
import * as THREE from 'three';

// ───────── geometrías base (sin índice, centradas, tamaño 1) ─────────
const ni = (g) => (g.index ? g.toNonIndexed() : g);
export const G = {
  box: ni(new THREE.BoxGeometry(1, 1, 1)),
  cyl5: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 5)),
  cyl6: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
  cyl10: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
  cone4: ni(new THREE.ConeGeometry(0.5, 1, 4)),
  cone6: ni(new THREE.ConeGeometry(0.5, 1, 6)),
  ico0: ni(new THREE.IcosahedronGeometry(0.5, 0)),
  ico1: ni(new THREE.IcosahedronGeometry(0.5, 1)),
  sph: ni(new THREE.SphereGeometry(0.5, 8, 6)),
  dode: ni(new THREE.DodecahedronGeometry(0.5, 0)),
  tri: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0, 0.5, 0, 0, -0.5, 0, 0, 0, -1, 0], 3)); return g; })(),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
export function T({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, order = 'XYZ' } = {}) {
  _e.set(rx, ry, rz, order); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

export class Kit {
  constructor() { this.p = []; this.c = []; this.base = new THREE.Matrix4(); this.stack = []; }
  push(m) { this.stack.push(this.base); this.base = this.base.clone().multiply(m); return this; }
  pop() { this.base = this.stack.pop() || new THREE.Matrix4(); return this; }
  add(geo, color, t = {}) {
    _m.copy(this.base).multiply(t.isMatrix4 ? t : T(t));
    const pos = geo.attributes.position;
    const c = color.isColor ? color : new THREE.Color(color);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      this.p.push(_v.x, _v.y, _v.z); this.c.push(c.r, c.g, c.b);
    }
    return this;
  }
  get empty() { return this.p.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat) { const m = new THREE.Mesh(this.geometry(), mat); return m; }
}

export const matLit = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
export const matGlow = () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

// ───────── scooter del jugador (mira a +Z, ruedas aparte) ─────────
export function scooterKit(k, body = '#2ec4b6', accent = '#fff8ec', withBasket = true) {
  const dark = '#2b2d42', chrome = '#dcdce6', seat = '#3a2e3f';
  k.add(G.box, body, { y: 0.45, z: -0.45, sx: 0.5, sy: 0.38, sz: 0.8 });
  k.add(G.box, body, { y: 0.66, z: -0.47, sx: 0.44, sy: 0.12, sz: 0.72 });
  k.add(G.box, accent, { y: 0.5, z: -0.45, sx: 0.52, sy: 0.06, sz: 0.6 });
  k.add(G.box, seat, { y: 0.77, z: -0.4, sx: 0.4, sy: 0.1, sz: 0.74 });
  k.add(G.box, '#4a4458', { y: 0.29, z: 0.12, sx: 0.42, sy: 0.07, sz: 0.62 });
  k.add(G.box, body, { y: 0.7, z: 0.47, sx: 0.5, sy: 0.8, sz: 0.13, rx: -0.22 });
  k.add(G.box, accent, { y: 0.72, z: 0.545, sx: 0.3, sy: 0.55, sz: 0.03, rx: -0.22 });
  k.add(G.cyl6, chrome, { y: 1.0, z: 0.55, sx: 0.07, sy: 0.4, sz: 0.07, rx: -0.22 });
  k.add(G.box, body, { y: 1.15, z: 0.6, sx: 0.36, sy: 0.15, sz: 0.24 });
  k.add(G.box, chrome, { y: 1.16, z: 0.55, sx: 0.84, sy: 0.05, sz: 0.05 });
  for (const s of [-1, 1]) {
    k.add(G.box, dark, { x: 0.42 * s, y: 1.16, z: 0.55, sx: 0.12, sy: 0.07, sz: 0.07 });
    k.add(G.cyl5, chrome, { x: 0.22 * s, y: 1.3, z: 0.56, sx: 0.025, sy: 0.26, sz: 0.025, rz: -0.35 * s });
    k.add(G.cyl6, chrome, { x: 0.28 * s, y: 1.44, z: 0.56, sx: 0.12, sy: 0.03, sz: 0.09, rx: Math.PI / 2 });
  }
  k.add(G.box, body, { y: 0.55, z: 0.68, sx: 0.2, sy: 0.08, sz: 0.36, rx: 0.2 });
  k.add(G.box, '#ff3b4a', { y: 0.6, z: -0.86, sx: 0.26, sy: 0.08, sz: 0.04 });
  k.add(G.box, dark, { y: 0.27, z: -0.55, sx: 0.12, sy: 0.12, sz: 0.5 });
  k.add(G.cyl6, '#8a8a96', { x: -0.2, y: 0.3, z: -0.75, sx: 0.09, sy: 0.4, sz: 0.09, rx: Math.PI / 2 });
  if (withBasket) {
    k.add(G.box, '#c98b4a', { y: 0.95, z: -0.98, sx: 0.4, sy: 0.22, sz: 0.3 });
    k.add(G.ico0, '#5cb85c', { x: -0.08, y: 1.1, z: -0.98, s: 0.2 });
    k.add(G.ico0, '#4aa04a', { x: 0.1, y: 1.12, z: -0.96, s: 0.19 });
  }
}
export function wheelGeo() {
  const k = new Kit();
  k.add(G.cyl10, '#25222e', { sx: 0.54, sy: 0.14, sz: 0.54, rz: Math.PI / 2 });
  k.add(G.cyl6, '#c9c9d4', { sx: 0.24, sy: 0.16, sz: 0.24, rz: Math.PI / 2 });
  k.add(G.box, '#e8e8f0', { sx: 0.17, sy: 0.07, sz: 0.4 });
  return k.geometry();
}

// ───────── personas sencillas (vendedores, locales, bailarines) ─────────
export const SKINS = ['#e8b48a', '#c68a5e', '#a86b43', '#e0ac7e', '#7a4a2c'];
export function personKit(k, { shirt = '#ff6f61', skin = '#c68a5e', hair = '#1a1210', pants = '#2e4a7d', sit = false, hat = null, arms = true } = {}) {
  if (sit) {
    k.add(G.box, pants, { y: 0.5, z: 0.12, sx: 0.36, sy: 0.16, sz: 0.5 });
    k.add(G.box, pants, { x: -0.1, y: 0.27, z: 0.35, sx: 0.13, sy: 0.45, sz: 0.14 });
    k.add(G.box, pants, { x: 0.1, y: 0.27, z: 0.35, sx: 0.13, sy: 0.45, sz: 0.14 });
  } else {
    k.add(G.box, pants, { x: -0.1, y: 0.42, sx: 0.14, sy: 0.84, sz: 0.16 });
    k.add(G.box, pants, { x: 0.1, y: 0.42, sx: 0.14, sy: 0.84, sz: 0.16 });
  }
  const by = sit ? 0.58 : 0.84;
  k.add(G.cyl6, shirt, { y: by + 0.28, sx: 0.44, sy: 0.56, sz: 0.3 });
  if (arms) for (const s of [-1, 1]) k.add(G.box, shirt, { x: 0.27 * s, y: by + 0.3, sx: 0.11, sy: 0.5, sz: 0.12, rz: 0.12 * s });
  k.add(G.ico1, skin, { y: by + 0.75, sx: 0.36, sy: 0.4, sz: 0.36 });
  k.add(G.sph, hair, { y: by + 0.84, sx: 0.39, sy: 0.26, sz: 0.39 });
  if (hat === 'casco') k.add(G.sph, '#ffd166', { y: by + 0.84, sx: 0.44, sy: 0.32, sz: 0.44 });
  else if (hat === 'paja') { k.add(G.cone6, '#e9c46a', { y: by + 1.0, sx: 0.8, sy: 0.28, sz: 0.8 }); }
}

// ───────── animales ─────────
export function monkeyKit(k) {
  const fur = '#8d6346', light = '#d9b48f', dark = '#2b1d14';
  k.add(G.ico1, fur, { y: 0.45, sx: 0.5, sy: 0.56, sz: 0.44 });
  k.add(G.ico1, light, { y: 0.42, z: 0.15, sx: 0.32, sy: 0.38, sz: 0.2 });
  k.add(G.ico1, fur, { y: 0.9, z: 0.04, s: 0.38 });
  k.add(G.ico1, light, { y: 0.87, z: 0.17, sx: 0.28, sy: 0.24, sz: 0.16 });
  for (const s of [-1, 1]) {
    k.add(G.sph, dark, { x: 0.065 * s, y: 0.93, z: 0.24, s: 0.05 });
    k.add(G.ico0, light, { x: 0.19 * s, y: 0.94, z: 0.02, sx: 0.12, sy: 0.14, sz: 0.06 });
    k.add(G.cyl6, fur, { x: 0.25 * s, y: 0.42, z: 0.08, sx: 0.1, sy: 0.46, sz: 0.1, rz: 0.35 * s, rx: -0.4 });
    k.add(G.cyl6, fur, { x: 0.16 * s, y: 0.14, z: 0.12, sx: 0.12, sy: 0.3, sz: 0.12, rx: -1.0 });
  }
  k.add(G.box, dark, { y: 0.81, z: 0.25, sx: 0.09, sy: 0.02, sz: 0.02 });
  // cola enroscada
  k.add(G.cyl5, fur, { y: 0.22, z: -0.32, sx: 0.07, sy: 0.4, sz: 0.07, rx: 1.1 });
  k.add(G.cyl5, fur, { y: 0.42, z: -0.55, sx: 0.07, sy: 0.35, sz: 0.07, rx: 0.2 });
  k.add(G.cyl5, fur, { y: 0.62, z: -0.5, sx: 0.07, sy: 0.18, sz: 0.07, rx: -1.0 });
}
export function dogBodyKit(k, c = '#d9a066', patch = '#fff1dc') {
  k.add(G.ico1, c, { y: 0.24, sx: 0.48, sy: 0.34, sz: 1.0 });
  k.add(G.ico1, patch, { y: 0.2, z: 0.18, sx: 0.36, sy: 0.24, sz: 0.5 });
  for (const s of [-1, 1]) {
    k.add(G.box, c, { x: 0.14 * s, y: 0.07, z: 0.5, sx: 0.11, sy: 0.09, sz: 0.4 });
    k.add(G.box, patch, { x: 0.14 * s, y: 0.07, z: 0.72, sx: 0.12, sy: 0.08, sz: 0.1 });
    k.add(G.box, c, { x: 0.26 * s, y: 0.08, z: -0.32, sx: 0.12, sy: 0.1, sz: 0.36, ry: 0.5 * s });
  }
  k.add(G.cyl5, c, { y: 0.2, z: -0.6, sx: 0.07, sy: 0.4, sz: 0.07, rx: 1.2 });
}
export function dogHeadKit(k, c = '#d9a066', ear = '#8a5a2b') {
  k.add(G.ico1, c, { y: 0.0, sx: 0.32, sy: 0.3, sz: 0.32 });
  k.add(G.box, c, { y: -0.04, z: 0.2, sx: 0.18, sy: 0.14, sz: 0.2 });
  k.add(G.sph, '#1b1b22', { y: 0.0, z: 0.31, s: 0.07 });
  for (const s of [-1, 1]) {
    k.add(G.box, ear, { x: 0.16 * s, y: 0.06, z: -0.04, sx: 0.06, sy: 0.2, sz: 0.12, rz: 0.4 * s });
    k.add(G.sph, '#1b1b22', { x: 0.08 * s, y: 0.06, z: 0.14, s: 0.045 });
  }
}
export function chickenKit(k, c = '#fff8ec') {
  k.add(G.ico1, c, { y: 0.3, sx: 0.34, sy: 0.3, sz: 0.42 });
  k.add(G.cone4, c === '#fff8ec' ? '#e8dcc8' : '#5a3a1e', { y: 0.42, z: -0.22, sx: 0.2, sy: 0.3, sz: 0.1, rx: -0.6 });
  k.add(G.ico1, c, { y: 0.52, z: 0.14, s: 0.2 });
  k.add(G.box, '#e63946', { y: 0.65, z: 0.15, sx: 0.04, sy: 0.08, sz: 0.12 });
  k.add(G.box, '#e63946', { y: 0.45, z: 0.24, sx: 0.04, sy: 0.07, sz: 0.04 });
  k.add(G.cone4, '#ffb703', { y: 0.52, z: 0.28, sx: 0.07, sy: 0.12, sz: 0.07, rx: Math.PI / 2 });
  for (const s of [-1, 1]) {
    k.add(G.cyl5, '#ffb703', { x: 0.07 * s, y: 0.08, sx: 0.03, sy: 0.18, sz: 0.03 });
    k.add(G.sph, '#1b1b22', { x: 0.075 * s, y: 0.55, z: 0.21, s: 0.035 });
  }
}

// ───────── scooters locales cargados hasta arriba ─────────
export const LOADS = ['cajas', 'sillas', 'cocos', 'colchon', 'jaula', 'familia', 'tabla'];
export function localScooterKit(k, rng, load) {
  const bodies = ['#ff4fa3', '#ffd166', '#7b5cff', '#ef476f', '#8ac926', '#ffffff', '#ff9f1c'];
  scooterKit(k, rng.pick(bodies), '#ffffff', false);
  const shirt = rng.pick(['#36c2b4', '#ff6f61', '#ffd166', '#7b5cff', '#ffffff', '#8ac926']);
  k.push(T({ y: 0.28, z: -0.25 }));
  personKit(k, { shirt, skin: rng.pick(SKINS), sit: true, hat: 'casco', arms: false });
  k.pop();
  k.add(G.box, shirt, { x: 0.27, y: 1.15, z: -0.05, sx: 0.11, sy: 0.12, sz: 0.5 });
  if (load === 'cajas') {
    const cs = ['#c98b4a', '#b07a3a', '#dda15e'];
    for (let i = 0; i < 4; i++) k.add(G.box, cs[i % 3], { x: (i % 2 ? 0.06 : -0.06), y: 1.05 + i * 0.32, z: -0.95, sx: 0.62 - i * 0.04, sy: 0.3, sz: 0.5, ry: (i % 2 ? 0.15 : -0.1) });
  } else if (load === 'sillas') {
    const cs = ['#ff4fa3', '#36c2b4', '#ffd166', '#ef476f', '#3a86ff'];
    for (let i = 0; i < 7; i++) {
      k.add(G.box, cs[i % 5], { y: 1.0 + i * 0.16, z: -0.98, sx: 0.55, sy: 0.06, sz: 0.5 });
      k.add(G.box, cs[i % 5], { y: 1.25 + i * 0.16, z: -1.22, sx: 0.55, sy: 0.5, sz: 0.06, rx: -0.15 });
    }
  } else if (load === 'cocos') {
    k.add(G.ico1, '#a37b45', { y: 1.15, z: -0.95, sx: 0.8, sy: 0.7, sz: 0.7 });
    for (let i = 0; i < 6; i++) k.add(G.ico0, '#6ab04c', { x: Math.cos(i) * 0.22, y: 1.5 + (i % 2) * 0.1, z: -0.95 + Math.sin(i) * 0.2, s: 0.22 });
  } else if (load === 'colchon') {
    k.add(G.box, '#a2d2ff', { y: 1.35, z: -0.6, sx: 1.4, sy: 0.22, sz: 1.9, rx: -0.12 });
    k.add(G.box, '#ffffff', { y: 1.48, z: -0.6, sx: 1.2, sy: 0.04, sz: 1.7, rx: -0.12 });
  } else if (load === 'jaula') {
    k.add(G.box, '#c98b4a', { y: 1.25, z: -0.98, sx: 0.7, sy: 0.6, sz: 0.55 });
    k.add(G.box, '#fff8ec', { y: 1.6, z: -0.98, sx: 0.5, sy: 0.12, sz: 0.4 });
    k.add(G.box, '#e63946', { y: 1.7, z: -0.88, sx: 0.06, sy: 0.08, sz: 0.1 });
  } else if (load === 'familia') {
    k.push(T({ y: 0.3, z: -0.7 })); personKit(k, { shirt: '#ffd166', skin: rng.pick(SKINS), sit: true, arms: false }); k.pop();
    k.push(T({ y: 0.65, z: 0.22, s: 0.6 })); personKit(k, { shirt: '#ff4fa3', skin: rng.pick(SKINS), sit: true, arms: false }); k.pop();
  } else {
    k.add(G.box, '#ff9f1c', { x: 0.4, y: 1.0, z: -0.3, sx: 0.08, sy: 0.5, sz: 2.4, rx: 0.05 });
    k.add(G.box, '#ffffff', { x: 0.45, y: 1.0, z: -0.3, sx: 0.03, sy: 0.3, sz: 2.2, rx: 0.05 });
  }
}

// ───────── palmera (geometría para InstancedMesh, con color por vértice) ─────────
export function palmGeo(h = 7) {
  const k = new Kit();
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const x0 = Math.pow(t0, 2) * 1.2, x1 = Math.pow(t1, 2) * 1.2;
    const y0 = t0 * h, y1 = t1 * h;
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0);
    k.add(G.cyl6, i % 2 ? '#8a5a3b' : '#9c6a45', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, sx: 0.36 - t0 * 0.12, sy: len * 1.02, sz: 0.36 - t0 * 0.12, rz: -ang });
  }
  const top = { x: 1.2, y: h };
  const leafCols = ['#3f9e4d', '#2f8a44', '#4fb35a'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    k.push(T({ x: top.x, y: top.y, ry: a }));
    k.add(G.box, leafCols[i % 3], { z: 1.0, y: 0.15, sx: 0.7, sy: 0.06, sz: 2.1, rx: 0.32 });
    k.add(G.box, leafCols[(i + 1) % 3], { z: 2.4, y: -0.45, sx: 0.5, sy: 0.05, sz: 1.3, rx: 0.75 });
    k.pop();
  }
  for (let i = 0; i < 3; i++) k.add(G.ico0, '#5c8a2e', { x: top.x + Math.cos(i * 2.1) * 0.25, y: top.y - 0.35, z: Math.sin(i * 2.1) * 0.25, s: 0.32 });
  return k.geometry();
}
export function bushGeo() {
  const k = new Kit();
  k.add(G.ico0, '#ffffff', { y: 1.0, sx: 2.4, sy: 2.0, sz: 2.4 });
  k.add(G.ico0, '#e8e8e8', { x: 0.9, y: 0.7, s: 1.5 });
  k.add(G.ico0, '#f2f2f2', { x: -0.8, y: 0.8, z: 0.4, s: 1.6 });
  return k.geometry();
}
export function treeGeo() {
  const k = new Kit();
  k.add(G.cyl5, '#7a5236', { y: 2, sx: 0.4, sy: 4, sz: 0.4 });
  k.add(G.ico0, '#ffffff', { y: 4.8, sx: 3.6, sy: 2.6, sz: 3.6 });
  k.add(G.ico0, '#ececec', { y: 6.0, x: 0.4, sx: 2.4, sy: 1.8, sz: 2.4 });
  return k.geometry();
}
export function rockGeo() {
  const k = new Kit();
  k.add(G.dode, '#ffffff', { y: 0.3, sx: 1.6, sy: 1.1, sz: 1.3 });
  return k.geometry();
}

// ───────── coco verde con pajita (InstancedMesh) ─────────
export function cocoGeo() {
  const k = new Kit();
  k.add(G.ico1, '#6ab04c', { sx: 0.7, sy: 0.78, sz: 0.7 });
  k.add(G.ico0, '#8fd16a', { y: 0.12, z: 0.22, sx: 0.32, sy: 0.32, sz: 0.2 });
  k.add(G.cyl6, '#f7f1d5', { y: 0.36, sx: 0.36, sy: 0.08, sz: 0.36 });
  k.add(G.cyl5, '#ff4fa3', { x: 0.06, y: 0.6, sx: 0.06, sy: 0.55, sz: 0.06, rz: -0.25 });
  return k.geometry();
}

// ───────── puesto de fruta con toldo de rayas (mira a +Z) ─────────
export function stallKit(k, rng, c1, c2) {
  const wood = '#a0623a';
  k.add(G.box, wood, { y: 0.85, sx: 2.4, sy: 0.08, sz: 1.0 });
  k.add(G.box, c1, { y: 0.5, z: 0.48, sx: 2.4, sy: 0.7, sz: 0.04 });
  for (const x of [-1.1, 1.1]) for (const z of [-0.45, 0.45]) k.add(G.box, wood, { x, y: 0.43, z, sx: 0.08, sy: 0.86, sz: 0.08 });
  for (const x of [-1.25, 1.25]) for (const z of [-0.7, 0.75]) k.add(G.cyl5, '#d9cfc1', { x, y: 1.2, z, sx: 0.07, sy: 2.4, sz: 0.07 });
  const fruit = [['#ffb703', 0.17], ['#ff9f1c', 0.16], ['#ffd166', 0.15], ['#6ab04c', 0.22], ['#e63946', 0.13]];
  for (let i = 0; i < 22; i++) {
    const [c, r] = fruit[i % fruit.length];
    k.add(i % 5 === 3 ? G.ico0 : G.sph, c, { x: -1.0 + (i % 11) * 0.2, y: 0.98 + Math.floor(i / 11) * 0.12, z: -0.2 + Math.floor(i / 11) * 0.25 + (i % 2) * 0.08, s: r * 1.6 });
  }
  for (let i = 0; i < 2; i++) k.add(G.sph, '#2d6a4f', { x: 0.75 - i * 0.35, y: 1.1, z: -0.3, sx: 0.36, sy: 0.3, sz: 0.3 });
  // toldo de rayas
  for (let i = 0; i < 6; i++) {
    k.add(G.box, i % 2 ? c2 : c1, { x: -1.25 + 0.5 * i + 0.25, y: 2.35, z: 0.05, sx: 0.5, sy: 0.05, sz: 1.8, rx: 0.22 });
    k.add(G.tri, i % 2 ? c1 : c2, { x: -1.25 + 0.5 * i + 0.25, y: 2.17, z: 0.94, sx: 0.5, sy: 0.25, sz: 1 });
  }
  k.push(T({ z: -0.8 }));
  personKit(k, { shirt: rng.pick(['#36c2b4', '#ffd166', '#ff4fa3', '#ffffff']), skin: rng.pick(SKINS), hat: rng.chance(0.5) ? 'paja' : null });
  k.pop();
}

// ───────── caseta / casita (mira a +Z) ─────────
export function hutKit(k, rng) {
  const wall = rng.pick(['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#ffc6ff', '#ffadad', '#fff1e6']);
  const roof = rng.pick(['#d1495b', '#00798c', '#edae49', '#66a182', '#7b5cff']);
  const w = rng.range(2.8, 3.8), d = rng.range(2.6, 3.4), h = rng.range(2.1, 2.6);
  k.add(G.box, '#b08968', { y: 0.2, sx: w + 0.6, sy: 0.4, sz: d + 1.4 });
  k.add(G.box, wall, { y: 0.4 + h / 2, sx: w, sy: h, sz: d });
  for (const s of [-1, 1]) k.add(G.box, roof, { x: (s * w) / 4, y: 0.4 + h + 0.38, sx: w / 2 + 0.55, sy: 0.12, sz: d + 1.3, rz: -0.55 * s });
  k.add(G.box, '#5a3a2a', { y: 0.4 + 0.85, z: d / 2 + 0.01, sx: 0.7, sy: 1.7, sz: 0.04 });
  k.add(G.box, '#ffe8a3', { x: w / 2 - 0.7, y: 0.4 + 1.3, z: d / 2 + 0.01, sx: 0.6, sy: 0.5, sz: 0.04 });
  for (const s of [-1, 1]) k.add(G.cyl5, '#8a5a3b', { x: s * (w / 2 + 0.2), y: 0.4 + h / 2 + 0.2, z: d / 2 + 0.55, sx: 0.1, sy: h + 0.4, sz: 0.1 });
  return { w, d, h };
}

// ───────── barca de cola larga (mira a +Z) ─────────
export function boatKit(k, rng) {
  const paint = rng.pick(['#2ec4b6', '#ff6f61', '#ffd166', '#3a86ff', '#ffffff']);
  k.add(G.box, '#7b4b2a', { y: 0.25, sx: 1.2, sy: 0.5, sz: 4.6 });
  k.add(G.box, '#6a3f22', { y: 0.05, sx: 0.7, sy: 0.3, sz: 4.2 });
  k.add(G.box, paint, { y: 0.52, sx: 1.25, sy: 0.1, sz: 4.7 });
  k.add(G.box, '#7b4b2a', { y: 0.6, z: 2.55, sx: 0.5, sy: 0.4, sz: 1.2, rx: -0.6 });
  k.add(G.box, paint, { y: 1.0, z: 3.0, sx: 0.3, sy: 0.6, sz: 0.3, rx: -0.6 });
  const rib = ['#ff4fa3', '#ffd166', '#8ac926', '#ff6f61'];
  for (let i = 0; i < 4; i++) k.add(G.box, rib[i], { x: (i - 1.5) * 0.08, y: 1.05 - i * 0.05, z: 3.1 + i * 0.03, sx: 0.07, sy: 0.6, sz: 0.04, rx: 0.3 });
  if (rng.chance(0.6)) {
    for (const x of [-0.5, 0.5]) for (const z of [-1, 1]) k.add(G.cyl5, '#dcdce6', { x, y: 1.1, z, sx: 0.06, sy: 1.2, sz: 0.06 });
    k.add(G.box, rng.pick(['#1d3557', '#f4a261', '#e63946', '#2a9d8f']), { y: 1.72, sx: 1.4, sy: 0.08, sz: 2.4 });
  }
  k.add(G.box, '#3a3a48', { y: 0.75, z: -2.2, sx: 0.4, sy: 0.4, sz: 0.5 });
  k.add(G.cyl5, '#8a8a96', { y: 0.45, z: -3.4, sx: 0.07, sy: 2.6, sz: 0.07, rx: 1.35 });
}

// ───────── islote kárstico (para el mar) ─────────
export function karstKit(k, rng, x, z, h, r) {
  const g = new THREE.CylinderGeometry(r * rng.range(0.55, 0.8), r, h, 7, 4).toNonIndexed();
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, [rng.range(0.82, 1.18), rng.range(-0.06, 0.06) * h]);
    const [f, dy] = seen.get(key);
    p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); p.setY(i, p.getY(i) + (Math.abs(p.getY(i)) < h / 2 - 0.01 ? dy : 0));
  }
  k.add(g, '#9c6a6a', { x, y: h / 2 - 2, z });
  k.add(G.ico0, '#3d7a4a', { x, y: h - 1.5, z, sx: r * 1.5, sy: r * 0.5, sz: r * 1.4 });
  k.add(G.ico0, '#4a8a52', { x: x + r * 0.3, y: h * 0.7, z: z + r * 0.4, sx: r * 0.7, sy: r * 0.4, sz: r * 0.7 });
  g.dispose();
}

// ───────── carteles con texto (textura de canvas) ─────────
export function signMesh(lines, { bg = '#fff8ec', fg = '#1a1036', accent = '#ff6f61', w = 3.2, h = 1.6 } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1036'; rr(g, 4, 4, 504, 248, 34); g.fill();
  g.fillStyle = bg; rr(g, 16, 16, 480, 224, 26); g.fill();
  g.fillStyle = accent; g.fillRect(16, 190, 480, 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg;
  fit(g, lines[0], 450, 78, "'Bungee', 'Baloo 2', sans-serif"); g.fillText(lines[0], 256, lines[1] ? 92 : 125);
  if (lines[1]) { g.fillStyle = accent === bg ? fg : '#3a2e5a'; fit(g, lines[1], 450, 44, "800 {s}px 'Baloo 2', sans-serif"); g.fillText(lines[1], 256, 160); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  return mesh;
}
function fit(g, text, maxW, size, font) {
  const mk = (s) => (font.includes('{s}') ? font.replace('{s}', s) : `${s}px ${font}`);
  let s = size; g.font = mk(s);
  while (g.measureText(text).width > maxW && s > 16) { s -= 2; g.font = mk(s); }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// Pancarta larga (meta) con banderines
export function bannerMesh(text, w = 12, h = 1.8) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#ff6f61'); gr.addColorStop(0.5, '#ffb703'); gr.addColorStop(1, '#ff4fa3');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#fff8ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = "96px 'Bungee', sans-serif"; g.lineWidth = 10; g.strokeStyle = '#1a1036';
  g.strokeText(text, 512, 86); g.fillText(text, 512, 86);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // dos caras de una sola cara: se lee bien por delante y por detrás (sin espejo)
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); back.rotation.y = Math.PI;
  grp.add(front, back);
  return grp;
}

// Guirnalda colgante entre dos puntos: añade el cable al kit y devuelve las bombillas
export function garland(k, a, b, n, sag = 0.9, wire = '#2b2d42') {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const len = p0.distanceTo(p1);
    const m = new THREE.Matrix4().lookAt(p0, p1, new THREE.Vector3(0, 1, 0));
    m.setPosition(mid);
    k.add(G.box, wire, m.multiply(T({ sx: 0.035, sy: 0.035, sz: len })));
  }
  return pts.slice(1, -1);
}

// ───────── carrito de comida del mercado (mira a +Z) ─────────
export function cartKit(k, rng) {
  const body = rng.pick(['#ff6f61', '#2ec4b6', '#ffd166', '#7b5cff', '#ff4fa3', '#8ac926']);
  const umb = rng.pick([['#ff6f61', '#fff8ec'], ['#2ec4b6', '#ffd166'], ['#ff4fa3', '#fff8ec'], ['#ffb703', '#e63946']]);
  k.add(G.box, body, { y: 0.75, sx: 1.7, sy: 0.8, sz: 1.0 });
  k.add(G.box, '#fff8ec', { y: 1.2, sx: 1.75, sy: 0.08, sz: 1.05 });
  k.add(G.box, '#c0c0cc', { x: -0.4, y: 1.3, sx: 0.6, sy: 0.12, sz: 0.6 });
  for (let i = 0; i < 6; i++) k.add(G.sph, rng.pick(['#ffb703', '#e63946', '#8ac926', '#fff3c4']), { x: 0.2 + (i % 3) * 0.2, y: 1.32, z: -0.15 + Math.floor(i / 3) * 0.3, s: 0.16 });
  for (const x of [-0.6, 0.6]) k.add(G.cyl10, '#2b2d42', { x, y: 0.28, z: 0.52, sx: 0.5, sy: 0.08, sz: 0.5, rx: Math.PI / 2 });
  k.add(G.cyl5, '#dcdce6', { y: 1.9, sx: 0.06, sy: 1.4, sz: 0.06 });
  for (let i = 0; i < 8; i++) k.add(G.cone4, umb[i % 2], { y: 2.6, sx: 2.2, sy: 0.45, sz: 2.2, ry: (i / 8) * Math.PI * 0.5 });
  k.push(T({ z: -0.85, x: 0.3 })); personKit(k, { shirt: rng.pick(['#36c2b4', '#ffd166', '#fff8ec']), skin: rng.pick(SKINS), hat: 'paja' }); k.pop();
}

// ───────── tuk-tuk (mira a +Z, ruedas incluidas) ─────────
export function tuktukKit(k) {
  const body = '#ff3fa4', roof = '#1b998b';
  k.add(G.box, body, { y: 0.75, z: -0.3, sx: 1.4, sy: 0.7, sz: 1.6 });
  k.add(G.box, body, { y: 0.8, z: 0.75, sx: 0.8, sy: 0.6, sz: 0.7 });
  k.add(G.box, '#fff8ec', { y: 0.65, z: -0.3, sx: 1.42, sy: 0.1, sz: 1.62 });
  k.add(G.box, '#ffd166', { y: 0.98, z: -0.55, sx: 1.2, sy: 0.18, sz: 0.8 });
  for (const x of [-0.68, 0.68]) for (const z of [-1.05, 0.45]) k.add(G.cyl5, '#dcdce6', { x, y: 1.55, z, sx: 0.05, sy: 1.2, sz: 0.05 });
  k.add(G.box, roof, { y: 2.18, z: -0.25, sx: 1.6, sy: 0.12, sz: 2.2 });
  k.add(G.box, '#ffd166', { y: 2.28, z: -0.25, sx: 1.5, sy: 0.08, sz: 2.0 });
  k.add(G.box, '#a8e6ff', { y: 1.55, z: 0.95, sx: 1.2, sy: 0.6, sz: 0.04, rx: -0.15 });
  k.add(G.box, '#fff3c4', { y: 0.95, z: 1.11, sx: 0.25, sy: 0.15, sz: 0.04 });
  for (const [x, z] of [[-0.62, -0.75], [0.62, -0.75], [0, 0.9]]) k.add(G.cyl10, '#2b2d42', { x, y: 0.3, z, sx: 0.6, sy: 0.16, sz: 0.6, rz: Math.PI / 2 });
  k.push(T({ y: 0.35, z: 0.55 })); personKit(k, { shirt: '#ffd166', skin: '#a86b43', sit: true, arms: false }); k.pop();
  const rib = ['#ff6f61', '#ffd166', '#8ac926', '#2ec4b6'];
  for (let i = 0; i < 4; i++) k.add(G.box, rib[i], { x: -0.6 + i * 0.4, y: 2.0, z: 0.85, sx: 0.1, sy: 0.35, sz: 0.03 });
}
