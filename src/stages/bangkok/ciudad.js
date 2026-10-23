// Bangkok de noche: ciudad en cuadrícula generada por código y unida en muy pocas mallas
// (edificios, accesorios, oro, neón, carteles, halos, reflejos, marcas, cables).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, makeRng } from '../../core/util.js';

export const N = 7;            // manzanas por lado
export const CELL = 44;        // distancia entre ejes de calles
export const ROAD = 14;        // ancho del asfalto
export const HALF = (N * CELL) / 2; // 154
export const EDGE = HALF + ROAD / 2; // 161: borde transitable
export const LANE = 3.5;       // desplazamiento del carril (se circula por la IZQUIERDA)
export const CURB = 4.3;       // punto de recogida, pegado al bordillo
export const line = (k) => -HALF + k * CELL;
export const mid = (i) => line(i) + CELL / 2;
export const AVENUES = new Set([2, 5]);

// Carteles inventados (sin marcas). [texto, color]
export const SIGNS = [
  ['PAD THAI 24H', '#ff3fa4'], ['Masajes Sonrisa', '#00e5ff'], ['Zumos Locos', '#b8ff3a'], ['Mango Sticky', '#ffb02e'],
  ['Hostal Mochila', '#00e5ff'], ['Karaoke Gamba', '#c77dff'], ['Noodles Abuela', '#ff5e5e'], ['Sastre Rápido', '#7ab8ff'],
  ['Fruta Fresca', '#5dff9b'], ['Pinchitos 10 B', '#ff3fa4'],
  ['Templo Dorado', '#ffd23f'], ['ESTADIO', '#ff4040'], ['Mercado Nocturno', '#ffd23f'], ['MIRADOR', '#00e5ff'],
  ['Barrio Chino', '#ff4040'], ['MUELLE', '#00e5ff'], ['Parque Lagartos', '#5dff9b'], ['Calle Mochila', '#ff3fa4'],
];
const VSIGNS = [['SPA', '#00e5ff'], ['WOK', '#ff3fa4'], ['TÉ', '#b8ff3a'], ['HOTEL', '#ffd23f'], ['FOTO', '#c77dff'], ['ROPA', '#ff5e5e'], ['SOPA', '#ffb02e'], ['24H', '#00e5ff']];
const GENERIC = [0, 1, 2, 3, 5, 6, 7, 8, 9];

// Destinos. side = lado de la manzana que da a la calle donde se para.
export const LANDMARKS = {
  templo: { name: 'Templo Dorado', block: [5, 1], side: 's', color: '#ffd23f' },
  mochila: { name: 'Calle Mochila', block: [1, 1], side: 's', color: '#ff3fa4' },
  mercado: { name: 'Mercado Nocturno', block: [2, 4], side: 'n', color: '#ffb02e' },
  mirador: { name: 'Mirador', block: [3, 2], side: 'e', color: '#00e5ff' },
  lagartos: { name: 'Parque de los Lagartos', block: [5, 5], side: 'w', color: '#5dff9b' },
  chino: { name: 'Barrio Chino', block: [1, 5], side: 'e', color: '#ff4040' },
  estadio: { name: 'Estadio de Muay Thai', block: [6, 3], side: 'w', color: '#ff6b6b' },
  muelle: { name: 'Muelle del Río', block: [-1, 3], side: 'e', color: '#7ab8ff' },
};
const SPECIAL = {};
for (const [id, l] of Object.entries(LANDMARKS)) SPECIAL[l.block.join(',')] = id;

// Punto de parada junto a un lado de una manzana (i,j).
// Devuelve { x, z, sx, sz (dónde espera el turista), face (yaw hacia la calle), edge }
export function sidePoint(i, j, side, f = 0.5) {
  if (side === 'n' || side === 's') {
    const k = side === 'n' ? j : j + 1, sgn = side === 'n' ? 1 : -1;
    const x = line(i) + f * CELL;
    return { x, z: line(k) + sgn * CURB, sx: x, sz: line(k) + sgn * 8.6, face: sgn > 0 ? Math.PI : 0, edge: { a: [i, k], b: [i + 1, k], f } };
  }
  const k = side === 'w' ? i : i + 1, sgn = side === 'w' ? 1 : -1;
  const z = line(j) + f * CELL;
  return { x: line(k) + sgn * CURB, z, sx: line(k) + sgn * 8.6, sz: z, face: sgn > 0 ? -Math.PI / 2 : Math.PI / 2, edge: { a: [k, j], b: [k, j + 1], f } };
}

// ───────── utilidades de geometría ─────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
class Bucket {
  constructor(uv = false) { this.geos = []; this.uv = uv; }
  add(geo, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (geo.index) geo.dispose();
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    if (!this.uv) g.deleteAttribute('uv');
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.geos.push(g);
    return g;
  }
  box(x, y, z, w, h, d, color, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry); }
  cyl(x, y, z, rt, rb, h, color, seg = 6) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z); }
  mesh(mat) {
    if (!this.geos.length) return null;
    const g = mergeGeometries(this.geos, false);
    for (const x of this.geos) x.dispose();
    this.geos = [];
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// Quads a pelo (carteles, halos, reflejos): posición, uv, color
class Quads {
  constructor() { this.p = []; this.uv = []; this.c = []; }
  // centro c, ejes u (ancho) y v (alto) ya escalados a la mitad
  add(cx, cy, cz, ux, uy, uz, vx, vy, vz, color, uvr = [0, 0, 1, 1], bright = 1) {
    const col = new THREE.Color(color).multiplyScalar(bright);
    const P = [
      [cx - ux - vx, cy - uy - vy, cz - uz - vz], [cx + ux - vx, cy + uy - vy, cz + uz - vz],
      [cx + ux + vx, cy + uy + vy, cz + uz + vz], [cx - ux + vx, cy - uy + vy, cz - uz + vz],
    ];
    const [u0, v0, u1, v1] = uvr;
    const UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[k]); this.uv.push(...UV[k]); this.c.push(col.r, col.g, col.b); }
  }
  mesh(mat) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false;
    return m;
  }
}

// ───────── texturas ─────────
function signAtlas() {
  return canvasTexture(1024, 1024, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    const neon = (text, color, x, y, w, h, vertical) => {
      g.save();
      g.fillStyle = 'rgba(14,6,30,0.92)';
      rr(g, x + 4, y + 4, w - 8, h - 8, 14); g.fill();
      g.shadowColor = color; g.shadowBlur = 14; g.strokeStyle = color; g.lineWidth = 5;
      rr(g, x + 9, y + 9, w - 18, h - 18, 10); g.stroke();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!vertical) {
        let fs = h * 0.5; g.font = `${fs}px Bungee, Impact, sans-serif`;
        while (g.measureText(text).width > w - 50 && fs > 12) { fs -= 2; g.font = `${fs}px Bungee, Impact, sans-serif`; }
        g.shadowBlur = 22; g.fillStyle = color; g.fillText(text, x + w / 2, y + h / 2 + 3);
        g.shadowBlur = 6; g.fillStyle = mix(color); g.fillText(text, x + w / 2, y + h / 2 + 3);
      } else {
        const chars = [...text], fs = Math.min(70, (h - 40) / chars.length);
        g.font = `${fs}px Bungee, Impact, sans-serif`;
        chars.forEach((ch, i) => {
          const yy = y + 20 + fs * (i + 0.5) + ((h - 40) - fs * chars.length) / 2;
          g.shadowBlur = 20; g.fillStyle = color; g.fillText(ch, x + w / 2, yy);
          g.shadowBlur = 5; g.fillStyle = mix(color); g.fillText(ch, x + w / 2, yy);
        });
      }
      g.restore();
    };
    SIGNS.forEach(([t, c], k) => neon(t, c, (k % 2) * 512, Math.floor(k / 2) * 80, 512, 80, false));
    VSIGNS.forEach(([t, c], k) => neon(t, c, k * 128, 736, 128, 288, true));
  });
}
const mix = (c) => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.65).getHexString();
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const hUV = (k) => { const x = (k % 2) * 512, y = Math.floor(k / 2) * 80; return [x / 1024, 1 - (y + 80) / 1024, (x + 512) / 1024, 1 - y / 1024]; };
const vUV = (k) => { const x = k * 128, y = 736; return [x / 1024, 1 - (y + 288) / 1024, (x + 128) / 1024, 1 - y / 1024]; };

// Escaparates: 4 variantes de 512×64 (tiendas iluminadas por dentro)
function shopAtlas() {
  const t = canvasTexture(512, 256, (g) => {
    const items = ['#ff5e5e', '#ffd23f', '#5dff9b', '#00e5ff', '#ff3fa4', '#c77dff', '#ffffff', '#ff9f1c'];
    for (let k = 0; k < 4; k++) {
      const y = k * 64;
      const gr = g.createLinearGradient(0, y, 0, y + 64); gr.addColorStop(0, '#d8d0c8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#bdb2aa');
      g.fillStyle = gr; g.fillRect(0, y, 512, 64);
      // estanterías con cosas de colores
      for (let r = 0; r < 3; r++) {
        const sy = y + 14 + r * 15;
        g.fillStyle = '#6d6470'; g.fillRect(0, sy + 9, 512, 2);
        for (let x = 4; x < 512; x += 7 + ((x * 13 + r * 7 + k) % 9)) { g.fillStyle = items[(x + r * 3 + k) % items.length]; g.fillRect(x, sy + 9 - (4 + ((x + r) % 5)), 4 + ((x >> 3) % 3), 4 + ((x + r) % 5)); }
      }
      // gente dentro (siluetas) y lámparas
      for (let p = 0; p < 5; p++) {
        const px = 40 + ((p * 97 + k * 53) % 440);
        g.fillStyle = 'rgba(40,24,60,0.75)'; g.beginPath(); g.arc(px, y + 30, 6, 0, 7); g.fill();
        g.beginPath(); g.ellipse(px, y + 58, 11, 20, 0, Math.PI, 0); g.fill();
      }
      for (let x = 30; x < 512; x += 90) { g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(x, y + 6, 4, 0, 7); g.fill(); }
      // marcos del escaparate
      g.fillStyle = '#2a2236';
      for (let x = 0; x < 512; x += 64) g.fillRect(x, y, 4, 64);
      g.fillRect(0, y, 512, 4); g.fillRect(0, y + 60, 512, 4);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function blobTexture() {
  return canvasTexture(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

function windowTextures(rng) {
  const W = 384, H = 192, cols = 12, rows = 6, cw = W / cols, ch = H / rows;
  const lit = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = rng() < 0.42, k = rng();
    lit.push(on ? (k < 0.6 ? '#ffd89a' : k < 0.8 ? '#9fe8ff' : k < 0.9 ? '#ff9ad5' : '#d6ff9a') : null);
  }
  const draw = (emis) => (g) => {
    g.fillStyle = emis ? '#000' : '#9a93a8'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const L = lit[r * cols + c], x = c * cw, y = r * ch;
      if (!emis) { g.fillStyle = '#7d768c'; g.fillRect(x, y + ch - 4, cw, 3); }
      g.fillStyle = L ? L : (emis ? '#000' : '#232030');
      if (emis && L) g.globalAlpha = 0.75 + ((r * 7 + c * 3) % 5) * 0.06;
      g.fillRect(x + 7, y + 8, cw - 14, ch - 15);
      g.globalAlpha = 1;
    }
  };
  const map = canvasTexture(W, H, draw(false)); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const em = canvasTexture(W, H, draw(true)); em.wrapS = em.wrapT = THREE.RepeatWrapping;
  return { map, em };
}

function asphaltTexture() {
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2a2536'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) { const v = 30 + Math.floor(Math.random() * 30); g.fillStyle = `rgb(${v},${v - 4},${v + 10})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    // manchas de charco
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(10,8,20,0.35)'; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 30, 10 + Math.random() * 16, Math.random() * 3, 0, 7); g.fill(); }
  }, { repeat: [60, 60] });
  return t;
}

// ───────── construcción de la ciudad ─────────
export function buildCity(scene, rng, { quality = 1, wet = true } = {}) {
  const B = new Bucket(true);          // edificios con ventanas
  const P = new Bucket();              // accesorios (Lambert, color por vértice)
  const G = new Bucket();              // dorado iluminado
  const NE = new Bucket();             // neón / cosas que se iluminan solas
  const M = new Bucket();              // marcas viales
  const signs = new Quads(), halos = new Quads(), refl = new Quads(), shops = new Quads();
  const cables = [];                   // segmentos de línea
  const peds = [];                     // peatones que pasean { path, s, speed }
  const colliders = [];                // AABB { x0, x1, z0, z1 }
  const circles = [];                  // obstáculos redondos { x, z, r }
  const anims = { boats: [], beacons: [] };
  const dense = quality;               // 0.4..1
  const rngD = makeRng(77731);         // decoración que depende de la calidad (no altera el trazado)

  const BCOL = ['#b8a9c9', '#9fb4c7', '#c9b29b', '#a3c4bc', '#d4a5a5', '#8e8aa8', '#c2c2c2', '#e0c9a6', '#a9b8d9', '#c7a3bf'];
  const SHOP = ['#ffcf8a', '#ffe7b0', '#9ff0ff', '#ffb0d8', '#d0ffb0', '#fff2d0'];
  const AWN = ['#e63946', '#2a9d8f', '#f4a261', '#7b5cff', '#ef476f', '#118ab2', '#ffd166'];

  const building = (x, z, w, d, h, color) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, ou = Math.floor(rng() * 12) / 12, ov = 0;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.99); continue; }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 21.6 + ou, uv.getY(i) * h / 18 + ov);
    }
    B.add(g, color, x, h / 2, z);
  };

  // cartel horizontal pegado a una fachada: centro (x,y,z), normal (nx,nz) hacia fuera
  const wallSign = (x, y, z, nx, nz, w, k, bright = 1) => {
    const h = w / 6.4, ux = nz * w / 2, uz = -nx * w / 2; // u = up × n
    const col = SIGNS[k][1];
    signs.add(x + nx * 0.12, y, z + nz * 0.12, ux, 0, uz, 0, h / 2, 0, '#ffffff', hUV(k), bright);
    halos.add(x + nx * 0.08, y, z + nz * 0.08, ux * 1.5, 0, uz * 1.5, 0, h * 1.6, 0, col, [0, 0, 1, 1], 0.55);
    // reflejo en el asfalto mojado
    const rx = x + nx * 6.5, rz = z + nz * 6.5;
    refl.add(rx, 0.03, rz, ux * 0.7, 0, uz * 0.7, nx * 4.2, 0, nz * 4.2, col, [0, 0, 1, 1], 0.6);
  };
  // cartel vertical saliente (dos caras)
  const sideSign = (x, y, z, nx, nz, k) => {
    const w = 1.3, h = 2.9, cx = x + nx * 0.9, cz = z + nz * 0.9;
    const col = VSIGNS[k][1];
    // plano perpendicular a la fachada: su "u" es la normal de la fachada
    signs.add(cx, y, cz, nx * w / 2, 0, nz * w / 2, 0, h / 2, 0, '#ffffff', vUV(k));
    signs.add(cx, y, cz, -nx * w / 2, 0, -nz * w / 2, 0, h / 2, 0, '#ffffff', vUV(k));
    halos.add(cx, y, cz, nx * w, 0, nz * w, 0, h * 0.9, 0, col, [0, 0, 1, 1], 0.4);
    halos.add(cx, y, cz, -nx * w, 0, -nz * w, 0, h * 0.9, 0, col, [0, 0, 1, 1], 0.4);
    refl.add(x + nx * 6, 0.03, z + nz * 6, -nz * 0.9, 0, nx * 0.9, nx * 3.5, 0, nz * 3.5, col, [0, 0, 1, 1], 0.5);
  };
  const facade = (x, z, nx, nz, len, avenue, kind) => {
    // escaparate iluminado + toldo + carteles
    const ux = -nz, uz = nx;
    if (rng() < 0.8) {
      const shop = SHOP[Math.floor(rng() * SHOP.length)], sw = len * 0.8;
      const k = Math.floor(rng() * 4), u0 = rng() * 0.4;
      shops.add(x + nx * 0.06, 1.55, z + nz * 0.06, nz * sw / 2, 0, -nx * sw / 2, 0, 1.25, 0, shop, [u0, 1 - (k + 1) / 4, u0 + sw / 20, 1 - k / 4]);
      if (!avenue || rng() < 0.4) { const a = P.box(x + nx * 0.7, 2.9, z + nz * 0.7, Math.abs(ux) * sw + Math.abs(nx) * 1.4, 0.18, Math.abs(uz) * sw + Math.abs(nz) * 1.4, AWN[Math.floor(rng() * AWN.length)]); void a; }
      refl.add(x + nx * 4, 0.03, z + nz * 4, ux * sw * 0.5, 0, uz * sw * 0.5, nx * 2.2, 0, nz * 2.2, shop, [0, 0, 1, 1], 0.28);
    }
    if (rng() < (avenue ? 0.95 : 0.6) * (kind === 'mochila' ? 1.6 : 1)) {
      const k = GENERIC[Math.floor(rng() * GENERIC.length)];
      wallSign(x, 4.6 + rng() * 3.5, z, nx, nz, Math.min(len * 0.85, 5 + rng() * 2.5), k);
    }
    if (rng() < (kind === 'mochila' || kind === 'chino' ? 0.9 : 0.4)) {
      const o = (rng() - 0.5) * len * 0.7;
      sideSign(x + ux * o, 6.5 + rng() * 3, z + uz * o, nx, nz, Math.floor(rng() * VSIGNS.length));
    }
  };

  // Lotes de edificios dentro de un rectángulo (manzana o anillo exterior)
  const fillLots = (x0, x1, z0, z1, avenueSides, kind, tallMul = 1, tint = null) => {
    const ins = 2.4; // acera
    const ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
    const nx = rng() < 0.5 ? 2 : 3, nz = rng() < 0.5 ? 2 : 3;
    const cw = (ax1 - ax0) / nx, cd = (az1 - az0) / nz;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const outer = a === 0 || b === 0 || a === nx - 1 || b === nz - 1;
      if (!outer && rng() < 0.6) continue; // patio interior
      const w = cw - 0.5, d = cd - 0.5;
      const cx = ax0 + cw * (a + 0.5), cz = az0 + cd * (b + 0.5);
      let h = (7 + rng() * 16) * tallMul;
      if (rng() < 0.12) h = 30 + rng() * 22;
      const col = tint ? tint[Math.floor(rng() * tint.length)] : BCOL[Math.floor(rng() * BCOL.length)];
      building(cx, cz, w, d, h, col);
      if (rng() < 0.35 && h > 12) building(cx, cz, w * 0.6, d * 0.6, h + 4 + rng() * 8, col);
      if (rng() < 0.3) P.cyl(cx + w * 0.25, h, cz - d * 0.2, 0.9, 0.9, 1.6, '#6d6a7a', 7); // depósito de agua
      if (rng() < 0.08 && h < 26) { // valla publicitaria en la azotea
        const k = GENERIC[Math.floor(rng() * GENERIC.length)], dir = rng() < 0.5 ? 1 : -1;
        const sx = cx, sz = cz;
        signs.add(sx, h + 3, sz + dir * 0.2, 4.5 * dir, 0, 0, 0, 0.7, 0, '#ffffff', hUV(k));
        halos.add(sx, h + 3, sz + dir * 0.1, 6.5 * dir, 0, 0, 0, 1.6, 0, SIGNS[k][1], [0, 0, 1, 1], 0.5);
      }
      // fachadas a la calle
      const sides = [];
      if (a === 0) sides.push([-1, 0, ax0 - 0.25, cz, d, 'w']);
      if (a === nx - 1) sides.push([1, 0, ax1 + 0.25, cz, d, 'e']);
      if (b === 0) sides.push([0, -1, cx, az0 - 0.25, w, 'n']);
      if (b === nz - 1) sides.push([0, 1, cx, az1 + 0.25, w, 's']);
      for (const [fx, fz, px, pz, len, sd] of sides) facade(px, pz, fx, fz, len, avenueSides.includes(sd), kind);
    }
  };

  const poleH = 7.2;
  const sag = (x0, y0, z0, x1, y1, z1, drop) => {
    const n = 8;
    for (let q = 0; q < n; q++) {
      const t0 = q / n, t1 = (q + 1) / n;
      const yA = y0 + (y1 - y0) * t0 - Math.sin(Math.PI * t0) * drop, yB = y0 + (y1 - y0) * t1 - Math.sin(Math.PI * t1) * drop;
      cables.push(x0 + (x1 - x0) * t0, yA, z0 + (z1 - z0) * t0, x0 + (x1 - x0) * t1, yB, z0 + (z1 - z0) * t1);
    }
  };
  const sidewalk = (x0, x1, z0, z1, color = '#4d4762') => {
    P.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.25, z1 - z0, color);
  };

  // ── manzanas ──
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x0 = line(i) + ROAD / 2, x1 = line(i + 1) - ROAD / 2, z0 = line(j) + ROAD / 2, z1 = line(j + 1) - ROAD / 2;
    colliders.push({ x0, x1, z0, z1, i, j });
    const kind = SPECIAL[i + ',' + j] || 'normal';
    const av = [];
    if (AVENUES.has(i)) av.push('w'); if (AVENUES.has(i + 1)) av.push('e'); if (AVENUES.has(j)) av.push('n'); if (AVENUES.has(j + 1)) av.push('s');
    if (kind === 'templo') { sidewalk(x0, x1, z0, z1, '#d8d0c0'); temple(mid(i), mid(j)); continue; }
    if (kind === 'mercado') { sidewalk(x0, x1, z0, z1, '#5b4a3a'); market(x0, x1, z0, z1); continue; }
    if (kind === 'lagartos') { sidewalk(x0, x1, z0, z1, '#2f6b3a'); park(x0, x1, z0, z1); continue; }
    if (kind === 'estadio') { sidewalk(x0, x1, z0, z1); stadium(mid(i), mid(j)); continue; }
    sidewalk(x0, x1, z0, z1);
    if (kind === 'mirador') { tower(mid(i), mid(j)); continue; }
    fillLots(x0, x1, z0, z1, av, kind, AVENUES.has(i) || AVENUES.has(j) ? 1.25 : 1,
      kind === 'chino' ? ['#c0392b', '#a93226', '#d4a017', '#8e2a2a', '#b8860b'] : null);
    if (kind === 'chino') chinaTown(i, j);
    if (kind === 'mochila') mochila(i, j);
  }

  // ── anillo exterior (norte, sur, este). Al oeste está el río ──
  const ring = [];
  for (let k = 0; k < N; k++) {
    ring.push([line(k) + ROAD / 2, line(k + 1) - ROAD / 2, -EDGE - 30, -EDGE, ['s']]);
    ring.push([line(k) + ROAD / 2, line(k + 1) - ROAD / 2, EDGE, EDGE + 30, ['n']]);
    ring.push([EDGE, EDGE + 30, line(k) + ROAD / 2, line(k + 1) - ROAD / 2, ['w']]);
  }
  ring.push([EDGE, EDGE + 30, -EDGE - 30, -EDGE, []], [EDGE, EDGE + 30, EDGE, EDGE + 30, []]);
  for (const [x0, x1, z0, z1, av] of ring) { sidewalk(x0, x1, z0, z1); fillLots(x0, x1, z0, z1, av, 'normal', 1.4); }
  // la calle que sale de la ciudad se tapa con edificios más lejos
  for (let k = 1; k < N; k++) {
    for (const [x, z] of [[line(k), -EDGE - 52], [line(k), EDGE + 52], [EDGE + 52, line(k)]]) building(x, z, 16, 16, 20 + rng() * 20, BCOL[k % BCOL.length]);
  }

  // ── río y orilla oeste ──
  P.box(-EDGE - 2.2, -1.2, 0, 4.4, 1.45, EDGE * 2 + 60, '#5a536e'); // paseo
  for (let z = -EDGE - 28; z <= EDGE + 28; z += 3) P.box(-EDGE - 4.1, 0.25, z, 0.15, 1.0, 0.15, '#c9c3d9'); // barandilla
  P.box(-EDGE - 4.1, 1.2, 0, 0.12, 0.12, EDGE * 2 + 56, '#e6e0f5');
  // muelle
  P.box(-EDGE - 12, -0.1, 0, 16, 0.35, 5, '#7a5a3a');
  for (let k = 0; k < 4; k++) { P.cyl(-EDGE - 6 - k * 4, 0.25, 2.4, 0.06, 0.06, 1.3, '#3b3650', 4); NE.add(new THREE.OctahedronGeometry(0.22), '#ffd27a', -EDGE - 6 - k * 4, 1.75, 2.4); halos.add(-EDGE - 6 - k * 4, 1.75, 2.4, 0.9, 0, 0, 0, 0.9, 0, '#ffb35a', [0, 0, 1, 1], 0.6); }
  // orilla de enfrente con el gran templo
  P.box(-420, -1, 0, 160, 1.2, 800, '#2a2340');
  bigPrang(-370, -40);
  for (let k = 0; k < 14; k++) building(-360 - rng() * 60, -300 + k * 46 + (k > 5 && k < 9 ? 160 : 0), 14, 14, 10 + rng() * 25, BCOL[k % BCOL.length]);
  // barcas de cola larga con luces
  for (let k = 0; k < 3; k++) {
    const boat = new Bucket();
    boat.box(0, 0, 0, 1.6, 0.6, 7, '#6b3d1f');
    boat.box(0, 0.6, -0.5, 1.4, 0.12, 4, '#e63946');
    const mb = boat.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mb.matrixAutoUpdate = true;
    const lights = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 4.4), new THREE.MeshBasicMaterial({ color: ['#ff3fa4', '#00e5ff', '#ffd23f'][k], toneMapped: false }));
    lights.position.y = 1.15; lights.position.z = -0.5; mb.add(lights);
    mb.position.set(-EDGE - 30 - k * 22, -0.6, -120 + k * 110);
    scene.add(mb);
    anims.boats.push({ m: mb, z0: mb.position.z, sp: 4 + k * 1.5, dir: k % 2 ? 1 : -1 });
  }

  // ── skyline lejano (sin niebla: siluetas con ventanas) ──
  const SK = new Bucket(true);
  for (let k = 0; k < 70; k++) {
    const a = (k / 70) * Math.PI * 2, r = 250 + rng() * 120;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x < -200) continue; // al oeste se ve el río y el templo
    const h = 30 + rng() * 80, w = 12 + rng() * 14;
    const g = new THREE.BoxGeometry(w, h, w);
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let q = 0; q < 4; q++) { const i = f * 4 + q; if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.99); else uv.setXY(i, uv.getX(i) * w / 21.6, uv.getY(i) * h / 18); }
    SK.add(g, '#4a4466', x, h / 2, z, rng() * 3);
    if (h > 70) { NE.add(new THREE.OctahedronGeometry(0.8), '#ff2a2a', x, h + 1, z); anims.beacons.push([x, h + 1, z]); }
  }

  // ── calles: marcas, farolas, árboles, postes y cables ──
  const markLines = () => {
    for (let k = 0; k <= N; k++) {
      const avk = AVENUES.has(k);
      for (let s = 0; s < N; s++) {
        const a = line(s) + ROAD / 2 + 1, b = line(s + 1) - ROAD / 2 - 1;
        for (const vert of [true, false]) {
          const at = (u, len, off, w, col) => {
            const geo = new THREE.PlaneGeometry(vert ? w : len, vert ? len : w); geo.rotateX(-Math.PI / 2);
            if (vert) M.add(geo, col, line(k) + off, 0.02, u); else M.add(geo, col, u, 0.02, line(k) + off);
          };
          if (avk) { at((a + b) / 2, b - a, -0.25, 0.18, '#ffc93c'); at((a + b) / 2, b - a, 0.25, 0.18, '#ffc93c'); }
          else for (let u = a + 1.5; u < b - 1.5; u += 5) at(u + 1.25, 2.5, 0, 0.2, '#d8d8e8');
          // pasos de cebra a la entrada de los cruces
          for (const end of [a + 1.2, b - 1.2]) for (let q = -5; q <= 5; q += 1.6) {
            const geo = new THREE.PlaneGeometry(vert ? 0.8 : 2, vert ? 2 : 0.8); geo.rotateX(-Math.PI / 2);
            if (vert) M.add(geo, '#e8e8f0', line(k) + q, 0.021, end); else M.add(geo, '#e8e8f0', end, 0.021, line(k) + q);
          }
        }
      }
    }
  };
  markLines();

  // farolas (avenidas) con charco de luz
  for (const k of AVENUES) for (let s = 0; s < N; s++) for (const t of [0.3, 0.7]) for (const side of [-1, 1]) {
    const u = line(s) + t * CELL, off = side * (ROAD / 2 + 0.8);
    for (const vert of [true, false]) {
      const x = vert ? line(k) + off : u, z = vert ? u : line(k) + off;
      P.cyl(x, 0, z, 0.1, 0.14, 7, '#3b3650', 5);
      const hx = vert ? x - side * 1.4 : x, hz = vert ? z : z - side * 1.4;
      P.box((x + hx) / 2, 6.9, (z + hz) / 2, vert ? 1.5 : 0.12, 0.12, vert ? 0.12 : 1.5, '#3b3650');
      NE.add(new THREE.BoxGeometry(0.7, 0.18, 0.4), '#fff1c8', hx, 6.85, hz);
      refl.add(hx - (vert ? side * 1.2 : 0), 0.035, hz - (vert ? 0 : side * 1.2), 3.6, 0, 0, 0, 0, 3.6, '#ffb36b', [0, 0, 1, 1], 0.35);
      if (rngD() < 0.5 * dense) { // árbol en la acera
        const tx = vert ? line(k) + side * (ROAD / 2 + 1.4) : u + 7, tz = vert ? u + 7 : line(k) + side * (ROAD / 2 + 1.4);
        tree(tx, tz, 0.9 + rngD() * 0.4);
      }
    }
  }

  // postes con cables colgando por las calles normales
  for (let k = 0; k <= N; k++) {
    if (AVENUES.has(k)) continue;
    for (let s = 0; s < N; s++) {
      const a = line(s) + ROAD / 2 + 2, b = line(s + 1) - ROAD / 2 - 2;
      for (const vert of [true, false]) for (const side of [-1, 1]) {
        if (vert && k === 0 && side < 0) continue; // junto al río no
        const off = side * (ROAD / 2 + 0.7);
        const pts = [a, (a + b) / 2, b];
        const P3 = pts.map((u) => (vert ? [line(k) + off, u] : [u, line(k) + off]));
        for (const [x, z] of P3) { P.cyl(x, 0, z, 0.13, 0.17, poleH, '#5c5668', 5); if (rng() < 0.3) P.box(x, poleH - 1.6, z, 0.6, 0.7, 0.5, '#4a4a55'); }
        for (let q = 0; q < P3.length - 1; q++) for (let c = 0; c < (dense > 0.6 ? 4 : 2); c++) {
          const y = poleH - 0.3 - c * 0.35;
          sag(P3[q][0], y, P3[q][1], P3[q + 1][0], y - 0.1 * c, P3[q + 1][1], 0.6 + c * 0.35 + rngD() * 0.4);
        }
        // cable que cruza la calle (a veces con bombillas)
        if (side > 0 && rng() < 0.55) {
          const u = (a + b) / 2, A = vert ? [line(k) - off, u] : [u, line(k) - off], Bp = vert ? [line(k) + off, u] : [u, line(k) + off];
          sag(A[0], poleH - 0.5, A[1], Bp[0], poleH - 0.5, Bp[1], 1.4);
          if (rng() < 0.6) bulbsAlong(A[0], poleH - 0.5, A[1], Bp[0], poleH - 0.5, Bp[1], 1.4, 9);
        }
      }
    }
  }
  function bulbsAlong(x0, y0, z0, x1, y1, z1, drop, n, colors = ['#ffd27a', '#ff6fb5', '#7fe8ff', '#b8ff6a']) {
    for (let q = 1; q < n; q++) {
      const t = q / n, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * drop;
      NE.add(new THREE.OctahedronGeometry(0.13), colors[q % colors.length], x0 + (x1 - x0) * t, y - 0.15, z0 + (z1 - z0) * t);
    }
  }
  function lanterns(x0, y0, z0, x1, y1, z1, drop, n) {
    sag(x0, y0, z0, x1, y1, z1, drop);
    for (let q = 1; q < n; q++) {
      const t = q / n, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * drop;
      NE.add(new THREE.SphereGeometry(0.42, 7, 5), '#ff2d2d', x0 + (x1 - x0) * t, y - 0.6, z0 + (z1 - z0) * t, 0, 0, 0, 1, 1.25, 1);
      halos.add(x0 + (x1 - x0) * t, y - 0.6, z0 + (z1 - z0) * t, 1.1, 0, 0, 0, 1.1, 0, '#ff3b3b', [0, 0, 1, 1], 0.5);
    }
  }
  function tree(x, z, s = 1) {
    P.cyl(x, 0, z, 0.15 * s, 0.22 * s, 2.6 * s, '#5a3b26', 5);
    P.add(new THREE.IcosahedronGeometry(1.5 * s, 0), '#1f6b45', x, 3.2 * s, z, rngD() * 3);
    P.add(new THREE.IcosahedronGeometry(1.0 * s, 0), '#2c8a57', x + 0.3, 4.2 * s, z - 0.2, rngD() * 3);
  }

  // ── lugares especiales ──
  function temple(cx, cz) {
    P.box(cx, 0.25, cz, 22, 0.8, 18, '#efe6d6');
    P.box(cx, 1.05, cz, 18, 0.6, 14, '#f6efe2');
    P.box(cx, 1.65, cz + 1, 10, 5, 12, '#f2e9dc');            // salón
    P.box(cx, 1.65, cz + 7.05, 10.2, 3.2, 0.2, '#b3262a');   // puerta roja
    const roof = (y, w, d, hgt, col) => {
      const g = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(w * 0.71, hgt, d * 0.71);
      P.add(g, col, cx, y + hgt / 2, cz + 1);
      G.box(cx, y - 0.05, cz + 1, w + 0.2, 0.18, d + 0.2, '#ffcc3a');
      NE.add(new THREE.BoxGeometry(w + 0.3, 0.08, 0.08), '#ffd23f', cx, y + 0.12, cz + 1 + d / 2 + 0.1);
    };
    roof(6.65, 13, 15, 3.4, '#d1452b'); roof(8.9, 10, 12, 3.0, '#2a7a5a'); roof(10.9, 7, 9, 2.6, '#d1452b');
    G.cyl(cx, 13.3, cz + 1, 0.05, 0.25, 2.2, '#ffd23f', 5);
    for (const sx of [-7, 7]) for (const sz of [-5, 7]) G.cyl(cx + sx, 1.35, cz + sz, 0.0, 0.7, 4, '#ffcc3a', 6);
    // estupa dorada detrás
    const sx = cx, sz = cz - 5.5;
    G.cyl(sx, 1.35, sz, 3.2, 3.6, 1.5, '#ffcc3a', 10);
    G.add(new THREE.SphereGeometry(3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffcc3a', sx, 2.8, sz);
    G.cyl(sx, 5.6, sz, 0.9, 1.2, 1.2, '#ffd23f', 8);
    G.cyl(sx, 6.8, sz, 0.02, 0.8, 8, '#ffd23f', 8);
    halos.add(sx, 7, sz + 3.5, 9, 0, 0, 0, 9, 0, '#ffbf3a', [0, 0, 1, 1], 0.35);
    halos.add(cx, 6, cz + 8, 12, 0, 0, 0, 7, 0, '#ffbf3a', [0, 0, 1, 1], 0.3);
    refl.add(cx, 0.035, cz + 17, 9, 0, 0, 0, 0, 5, '#ffcc4a', [0, 0, 1, 1], 0.45);
    wallSign(cx, 5.6, cz + 7.15, 0, 1, 7, 10, 1.1);
  }
  function market(x0, x1, z0, z1) {
    const cols = ['#e63946', '#2a9d8f', '#f4a261', '#7b5cff', '#ef476f', '#118ab2', '#ffd166', '#06d6a0'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = x0 + 4 + c * 5.5, z = z0 + 4.5 + r * 7;
      P.box(x, 0.25, z, 3.6, 0.9, 1.6, '#7a5a3a');
      for (let q = 0; q < 3; q++) P.box(x - 1.1 + q * 1.1, 1.15, z, 0.7, 0.35, 0.9, cols[(r * 5 + c + q) % cols.length]);
      for (const sx of [-1.7, 1.7]) P.cyl(x + sx, 0.25, z + 0.9, 0.05, 0.05, 2.4, '#ddd', 4);
      const g = new THREE.BoxGeometry(4.2, 0.12, 2.6);
      P.add(g, cols[(r + c) % cols.length], x, 2.75, z + 0.3, 0, 0.18);
      NE.add(new THREE.OctahedronGeometry(0.18), '#ffe1a0', x, 2.4, z + 0.2);
      halos.add(x, 2.3, z + 1.2, 1.6, 0, 0, 0, 1.2, 0, '#ffcf7a', [0, 0, 1, 1], 0.4);
    }
    // guirnaldas de bombillas en zigzag
    for (let r = 0; r < 5; r++) {
      const z = z0 + 1.5 + r * 6.8;
      sag(x0 + 1, 4.2, z, x1 - 1, 4.2, z, 0.9);
      bulbsAlong(x0 + 1, 4.2, z, x1 - 1, 4.2, z, 0.9, 16);
    }
    for (const [x, z] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5]]) P.cyl(x, 0, z, 0.15, 0.15, 4.6, '#4a4458', 5);
    // arco de entrada con cartel
    const cx = (x0 + x1) / 2;
    P.box(cx - 6, 0, z0 + 0.4, 0.5, 6, 0.5, '#3b3650'); P.box(cx + 6, 0, z0 + 0.4, 0.5, 6, 0.5, '#3b3650');
    wallSign(cx, 6.6, z0 + 0.2, 0, -1, 11, 12, 1.1);
    refl.add(cx, 0.035, z0 - 5, 8, 0, 0, 0, 0, 4, '#ffcf6a', [0, 0, 1, 1], 0.4);
    // gente
    for (let k = 0; k < 26 * dense; k++) peds.push({ x: x0 + 2 + rngD() * (x1 - x0 - 4), z: z0 + 2 + rngD() * (z1 - z0 - 4), still: true });
  }
  function park(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    P.box(cx + 3, 0.2, cz + 3, 14, 0.1, 12, '#1d3f5e'); // estanque
    refl.add(cx + 3, 0.33, cz + 3, 5, 0, 0, 0, 0, 4, '#00e5ff', [0, 0, 1, 1], 0.35);
    for (let k = 0; k < 16 * Math.max(0.6, dense); k++) {
      const x = x0 + 2 + rngD() * (x1 - x0 - 4), z = z0 + 2 + rngD() * (z1 - z0 - 4);
      if (Math.abs(x - cx - 3) < 8 && Math.abs(z - cz - 3) < 7) continue;
      tree(x, z, 1 + rngD() * 0.6);
    }
    // estatua del lagarto gigante (simpático)
    const lx = cx - 7, lz = cz - 6, LC = '#6f8f4e';
    P.box(lx, 0.25, lz, 5, 0.8, 3, '#9a93a8');
    P.add(new THREE.IcosahedronGeometry(1, 0), LC, lx, 2.2, lz, 0, 0, 0, 2.2, 0.8, 0.9);
    P.add(new THREE.IcosahedronGeometry(0.6, 0), LC, lx + 2.4, 2.6, lz, 0, 0, 0, 1.4, 0.8, 0.9);
    P.add(new THREE.ConeGeometry(0.5, 3, 5), LC, lx - 3.2, 1.9, lz, 0, 0, Math.PI / 2 + 0.2);
    for (const [ox, oz] of [[1, 0.8], [1, -0.8], [-1, 0.8], [-1, -0.8]]) P.box(lx + ox, 1.05, lz + oz, 0.35, 0.8, 0.35, LC);
    for (const oz of [-0.25, 0.25]) NE.add(new THREE.OctahedronGeometry(0.1), '#ffee55', lx + 3.1, 2.8, lz + oz);
    halos.add(lx, 2.5, lz + 2, 4, 0, 0, 0, 3, 0, '#5dff9b', [0, 0, 1, 1], 0.35);
    // arco con cartel en el lado oeste (donde se para)
    P.box(x0 + 0.3, 0, cz - 6, 0.5, 6.5, 0.5, '#3b3650'); P.box(x0 + 0.3, 0, cz + 6, 0.5, 6.5, 0.5, '#3b3650');
    wallSign(x0 + 0.1, 7, cz, -1, 0, 11, 16, 1.1);
  }
  function stadium(cx, cz) {
    P.cyl(cx, 0.25, cz, 12, 13, 11, '#3d3550', 16);
    P.cyl(cx, 11.25, cz, 11, 12, 1.2, '#2a2438', 16);
    const ring = new THREE.TorusGeometry(12.6, 0.18, 4, 32); ring.rotateX(Math.PI / 2);
    NE.add(ring, '#ff4040', cx, 9, cz);
    const ring2 = new THREE.TorusGeometry(12.1, 0.14, 4, 32); ring2.rotateX(Math.PI / 2);
    NE.add(ring2, '#ffd23f', cx, 11.6, cz);
    wallSign(cx - 13.2, 5.5, cz, -1, 0, 9, 11, 1.1);
    halos.add(cx - 13.5, 4, cz, 0, 0, 10, 0, 6, 0, '#ff4040', [0, 0, 1, 1], 0.3);
  }
  function tower(cx, cz) {
    building(cx, cz, 18, 18, 62, '#7d8db0');
    building(cx, cz, 13, 13, 78, '#8d9dc0');
    building(cx, cz, 8, 8, 90, '#9dadd0');
    G.cyl(cx, 90, cz, 0.05, 0.6, 12, '#d0e0ff', 6);
    for (const [ox, oz, w] of [[9.05, 9.05, 62], [6.55, 6.55, 78], [4.05, 4.05, 90]]) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) NE.add(new THREE.BoxGeometry(0.25, w - 4, 0.25), sx * sz > 0 ? '#00e5ff' : '#ff3fa4', cx + sx * ox, w / 2 + 1, cz + sz * oz);
    }
    const crown = new THREE.TorusGeometry(6, 0.25, 4, 24); crown.rotateX(Math.PI / 2);
    NE.add(crown, '#00e5ff', cx, 79, cz); NE.add(new THREE.OctahedronGeometry(0.9), '#ff2a2a', cx, 102.5, cz);
    anims.beacons.push([cx, 102.5, cz]);
    wallSign(cx + 9.3, 4.5, cz, 1, 0, 9, 13, 1.1);
    halos.add(cx, 85, cz, 14, 0, 0, 0, 14, 0, '#00e5ff', [0, 0, 1, 1], 0.25);
  }
  function chinaTown(i, j) {
    // portada roja sobre la calle del este (i+1)
    const gx = line(i + 1), gz = mid(j);
    for (const s of [-1, 1]) { P.cyl(gx + s * 7.6, 0, gz, 0.4, 0.45, 7.5, '#b3262a', 8); }
    P.box(gx, 7.3, gz, 17.5, 0.9, 1.2, '#b3262a');
    const g = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(13.5, 1.5, 1.6);
    G.add(g, '#ffcc3a', gx, 8.95, gz);
    NE.add(new THREE.BoxGeometry(17.6, 0.12, 0.1), '#ffd23f', gx, 8.2, gz + 0.62);
    signs.add(gx, 6.6, gz + 0.65, 3.6, 0, 0, 0, 0.56, 0, '#fff', hUV(14), 1.1);
    signs.add(gx, 6.6, gz - 0.65, -3.6, 0, 0, 0, 0.56, 0, '#fff', hUV(14), 1.1);
    halos.add(gx, 7, gz, 9, 0, 0, 0, 4, 0, '#ff4040', [0, 0, 1, 1], 0.4);
    // farolillos rojos cruzando calles
    for (let q = 0; q < 3; q++) {
      const z = line(j) + 10 + q * 12;
      lanterns(gx - 7.7, 6.3, z, gx + 7.7, 6.3, z, 1.1, 6);
    }
    for (let q = 0; q < 3; q++) { const x = line(i) + 10 + q * 12; lanterns(x, 6.3, line(j + 1) - 7.7, x, 6.3, line(j + 1) + 7.7, 1.1, 6); }
  }
  function mochila(i, j) {
    // pancarta sobre la calle sur (j+1) y mil bombillas
    const bz = line(j + 1), bx = mid(i);
    for (const s of [-1, 1]) P.cyl(bx + s * 0.1, 0, bz + s * 7.6, 0.18, 0.2, 7.4, '#3b3650', 5);
    signs.add(bx, 6.9, bz, 0, 0, 3.8, 0, 0.6, 0, '#fff', hUV(17), 1.1);
    signs.add(bx, 6.9, bz, 0, 0, -3.8, 0, 0.6, 0, '#fff', hUV(17), 1.1);
    halos.add(bx, 6.9, bz, 0.01, 0, 6, 0, 2.2, 0, '#ff3fa4', [0, 0, 1, 1], 0.5);
    for (let q = 0; q < 4; q++) { const x = line(i) + 9 + q * 8.5; sag(x, 6.5, bz - 7.7, x + 3, 6.5, bz + 7.7, 1.2); bulbsAlong(x, 6.5, bz - 7.7, x + 3, 6.5, bz + 7.7, 1.2, 10); }
  }
  function bigPrang(cx, cz) {
    G.box(cx, 0, cz, 40, 3, 40, '#e8c56a');
    G.box(cx, 3, cz, 28, 4, 28, '#efcf78');
    G.cyl(cx, 7, cz, 7, 11, 22, '#f2d684', 12);
    G.cyl(cx, 29, cz, 3.5, 7, 12, '#f5dc8c', 12);
    G.cyl(cx, 41, cz, 0.3, 3.5, 14, '#ffe39a', 10);
    for (const [ox, oz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) { G.cyl(cx + ox, 3, cz + oz, 2.5, 4, 10, '#efcf78', 10); G.cyl(cx + ox, 13, cz + oz, 0.2, 2.5, 7, '#f5dc8c', 8); }
    halos.add(cx + 24, 22, cz, 0, 0, 34, 0, 34, 0, '#ffb43a', [0, 0, 1, 1], 0.35);
    refl.add(-EDGE - 60, -0.55, cz, 28, 0, 0, 0, 0, 10, '#ffb43a', [0, 0, 1, 1], 0.5);
  }

  // peatones paseando por las aceras de algunas manzanas
  for (let k = 0; k < 40 * dense; k++) {
    const i = Math.floor(rngD() * N), j = Math.floor(rngD() * N);
    const kind = SPECIAL[i + ',' + j];
    if (kind === 'templo' || kind === 'lagartos' || kind === 'estadio') continue;
    const x0 = line(i) + ROAD / 2 + 1.1, x1 = line(i + 1) - ROAD / 2 - 1.1, z0 = line(j) + ROAD / 2 + 1.1, z1 = line(j + 1) - ROAD / 2 - 1.1;
    peds.push({ loop: [x0, x1, z0, z1], s: rngD() * 4 * (x1 - x0), speed: (rngD() < 0.5 ? -1 : 1) * (1.1 + rngD() * 0.6), still: false });
  }

  // ── suelo y materiales ──
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture(), color: '#ffffff', roughness: wet ? 0.32 : 0.8, metalness: wet ? 0.35 : 0.05 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), asphalt);
  ground.rotation.x = -Math.PI / 2; ground.position.set(-EDGE - 4.4 + 450, 0, 0); ground.receiveShadow = true; scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 900), new THREE.MeshStandardMaterial({ color: '#1a1840', roughness: 0.15, metalness: 0.7 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-EDGE - 4.4 - 100, -0.6, 0); scene.add(water);

  const win = windowTextures(rng);
  const bMat = new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.em, emissive: '#ffffff', emissiveIntensity: 0.95, vertexColors: true });
  const skMat = new THREE.MeshBasicMaterial({ map: win.em, color: '#ffffff', vertexColors: true, fog: false });
  const pMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const gMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, emissive: '#a8740c', emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.35 });
  const nMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const mMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const atlas = signAtlas();
  const sMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false });
  const blob = blobTexture();
  const hMat = new THREE.MeshBasicMaterial({ map: blob, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const rMat = new THREE.MeshBasicMaterial({ map: blob, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: wet ? 1 : 0.45, side: THREE.DoubleSide });

  // skyline: siluetas oscuras con ventanas (el color base hace de "pared" muy oscura)
  const skyMesh = SK.mesh(skMat);
  const out = {};
  const add = (name, m, opts = {}) => { if (!m) return; Object.assign(m, opts); scene.add(m); out[name] = m; };
  add('buildings', B.mesh(bMat));
  add('skyline', skyMesh);
  add('props', P.mesh(pMat));
  add('gold', G.mesh(gMat));
  add('neon', NE.mesh(nMat));
  add('marks', M.mesh(mMat));
  add('signs', signs.mesh(sMat));
  add('shops', shops.mesh(new THREE.MeshBasicMaterial({ map: shopAtlas(), vertexColors: true })));
  add('halos', halos.mesh(hMat), { renderOrder: 2 });
  add('refl', refl.mesh(rMat), { renderOrder: 1 });
  if (out.props) out.props.receiveShadow = true;
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
  add('cables', new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: '#3d3458' })));
  // la luna
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }));
  moon.position.set(-300, 210, -420); scene.add(moon);
  const moonHalo = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: blob, color: '#b9a8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonHalo.position.copy(moon.position); moonHalo.lookAt(0, 0, 0); scene.add(moonHalo);

  // peatones: dos InstancedMesh (cuerpo, cabeza) con color por instancia
  const nP = peds.length;
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.1, 6); bodyGeo.translate(0, 0.8, 0);
  const headGeo = new THREE.IcosahedronGeometry(0.2, 0); headGeo.translate(0, 1.55, 0);
  const pedBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ flatShading: true }), nP);
  const pedHead = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ flatShading: true }), nP);
  const SK_C = ['#f6d3b3', '#e0ac7e', '#c68a5e', '#a86b43', '#7a4a2c'];
  const SH_C = ['#ff6f61', '#36c2b4', '#ffd166', '#7b5cff', '#ffffff', '#ef476f', '#8ac926', '#ff9f1c', '#118ab2'];
  const tmp = new THREE.Object3D();
  peds.forEach((p, k) => {
    pedBody.setColorAt(k, new THREE.Color(SH_C[Math.floor(rngD() * SH_C.length)]));
    pedHead.setColorAt(k, new THREE.Color(SK_C[Math.floor(rngD() * SK_C.length)]));
    p.ph = rngD() * 6;
    if (p.still) { tmp.position.set(p.x, 0.25, p.z); tmp.rotation.y = rngD() * 6; tmp.updateMatrix(); pedBody.setMatrixAt(k, tmp.matrix); pedHead.setMatrixAt(k, tmp.matrix); }
  });
  scene.add(pedBody, pedHead);
  const pedOnLoop = (p) => {
    const [x0, x1, z0, z1] = p.loop, w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
    let s = ((p.s % per) + per) % per;
    if (s < w) return [x0 + s, z0, p.speed > 0 ? Math.PI / 2 : -Math.PI / 2]; s -= w;
    if (s < d) return [x1, z0 + s, p.speed > 0 ? 0 : Math.PI]; s -= d;
    if (s < w) return [x1 - s, z1, p.speed > 0 ? -Math.PI / 2 : Math.PI / 2]; s -= w;
    return [x0, z1 - s, p.speed > 0 ? Math.PI : 0];
  };

  return {
    meshes: out, colliders, circles, rMat, hMat, blob, anims,
    update(dt, t) {
      for (const b of anims.boats) { b.m.position.z += b.dir * b.sp * dt; if (Math.abs(b.m.position.z - b.z0) > 160) b.dir *= -1; b.m.rotation.y = b.dir > 0 ? 0 : Math.PI; b.m.position.y = -0.6 + Math.sin(t * 2 + b.z0) * 0.05; }
      for (let k = 0; k < nP; k++) {
        const p = peds[k];
        if (p.still) continue;
        p.s += p.speed * dt;
        const [x, z, yaw] = pedOnLoop(p);
        tmp.position.set(x, 0.25 + Math.abs(Math.sin(t * 7 + p.ph)) * 0.08, z); tmp.rotation.set(0, yaw, Math.sin(t * 7 + p.ph) * 0.06); tmp.updateMatrix();
        pedBody.setMatrixAt(k, tmp.matrix); pedHead.setMatrixAt(k, tmp.matrix);
      }
      pedBody.instanceMatrix.needsUpdate = true; pedHead.instanceMatrix.needsUpdate = true;
    },
    setWet(w) { rMat.opacity = w ? 1 : 0.45; asphalt.roughness = w ? 0.32 : 0.8; asphalt.metalness = w ? 0.35 : 0.05; },
  };
}

// Mapa en 2D para el minimapa: devuelve canvas y escala (px por unidad)
export function minimapCanvas() {
  const S = 2, R = 175, W = R * 2 * S;
  const c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d');
  const X = (x) => (x + R) * S;
  g.fillStyle = '#1a1030'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#16305a'; g.fillRect(0, 0, X(-EDGE - 4), W); // río
  g.fillStyle = '#3c2f63'; g.fillRect(X(-EDGE), X(-EDGE), (EDGE * 2) * S, (EDGE * 2) * S); // asfalto
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const kind = SPECIAL[i + ',' + j];
    g.fillStyle = kind ? new THREE.Color(LANDMARKS[kind].color).lerp(new THREE.Color('#1a1030'), 0.55).getStyle() : '#1e1538';
    const x0 = X(line(i) + ROAD / 2), z0 = X(line(j) + ROAD / 2), w = (CELL - ROAD) * S;
    g.beginPath(); g.roundRect ? g.roundRect(x0, z0, w, w, 6) : g.rect(x0, z0, w, w); g.fill();
  }
  // avenidas un poco más claras
  g.fillStyle = '#4e3f80';
  for (const k of AVENUES) { g.fillRect(X(line(k) - ROAD / 2), X(-EDGE), ROAD * S, EDGE * 2 * S); g.fillRect(X(-EDGE), X(line(k) - ROAD / 2), EDGE * 2 * S, ROAD * S); }
  for (const [, l] of Object.entries(LANDMARKS)) {
    const [i, j] = l.block;
    const x = i < 0 ? X(-EDGE - 14) : X(mid(i)), z = X(mid(j));
    g.fillStyle = l.color; g.beginPath(); g.arc(x, z, 7, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  }
  return { canvas: c, S, R };
}
