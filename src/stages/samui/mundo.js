// Mundo de Koh Samui: recorrido entre islas de roca caliza (karst), puertas de boyas, 3 calas
// escondidas, playas con palmeras, barcas de pescadores, gaviotas, un mono y nubes.
// Todo lo que afecta a la partida usa el rng con semilla; los detalles visuales, otro rng (vr).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKINS, HAIRS, SHIRTS } from '../../core/chars.js';
import { buildBoat } from './barca.js';

export const CHANNEL = 28;     // media anchura del canal libre
export const CALA_R = 24;      // radio del anillo de rocas de una cala
export const CALA_OFF = 64;    // distancia del centro de la cala al recorrido
const GAP = 0.8;               // ángulo de las bocas de la cala respecto al canal
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const col = (c) => new THREE.Color(c);

// ───────── recorrido ─────────
export function makePath(rng) {
  const ctrl = [];
  let x = 0, z = 0, h = Math.PI;
  const SEG = 112, N = 14;
  for (let i = 0; i < N; i++) {
    ctrl.push(new THREE.Vector3(x, 0, z));
    if (i >= 2) h += rng.range(-0.8, 0.8) * (i === 2 ? 0.5 : 1);
    h = clamp(h, Math.PI - 1.25, Math.PI + 1.25);
    x += Math.sin(h) * SEG; z += Math.cos(h) * SEG;
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const step = 2;
  const n = Math.floor(curve.getLength() / step) + 1;
  const sp = curve.getSpacedPoints(n - 1);
  const px = new Float32Array(n), pz = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = sp[i].x; pz[i] = sp[i].z; }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = px[b] - px[a], dz = pz[b] - pz[a]; const l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
  }
  const L = (n - 1) * step;
  const path = {
    n, px, pz, tx, tz, L, step,
    // punto en s: posición, tangente y normal (derecha del sentido de la marcha)
    at(s) {
      const f = clamp(s / step, 0, n - 1.001), i = Math.floor(f), k = f - i;
      const x = px[i] + (px[i + 1] - px[i]) * k, z = pz[i] + (pz[i + 1] - pz[i]) * k;
      const ttx = tx[i] + (tx[i + 1] - tx[i]) * k, ttz = tz[i] + (tz[i + 1] - tz[i]) * k; const l = Math.hypot(ttx, ttz) || 1;
      return { x, z, tx: ttx / l, tz: ttz / l, nx: -ttz / l, nz: ttx / l };
    },
    // punto más cercano (búsqueda local alrededor de hint)
    locate(x, z, hint = -1) {
      let a = 0, b = n - 1;
      if (hint >= 0) { a = Math.max(0, hint - 70); b = Math.min(n - 1, hint + 70); }
      let best = a, bd = Infinity;
      for (let i = a; i <= b; i++) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      const dx = x - px[best], dz = z - pz[best];
      const along = dx * tx[best] + dz * tz[best];
      const lat = dx * -tz[best] + dz * tx[best];
      return { i: best, s: clamp(best * step + along, 0, L), lat };
    },
    distTo(x, z, stride = 3) {
      let bd = Infinity;
      for (let i = 0; i < n; i += stride) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) bd = d; }
      return Math.sqrt(bd);
    },
  };
  return path;
}

// ───────── geometría utilitaria ─────────
// deja una geometría sin índice, solo con posición + color, transformada al mundo
function prep(geo, matrix, color) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'color') g.deleteAttribute(k);
  if (matrix) g.applyMatrix4(matrix);
  if (!g.attributes.color) {
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    const fn = typeof color === 'function' ? color : null; const cc = fn ? null : col(color);
    for (let t = 0; t < n; t += 3) {
      const cTri = fn ? fn(g.attributes.position, t) : cc;
      for (let v = 0; v < 3; v++) { c[(t + v) * 3] = cTri.r; c[(t + v) * 3 + 1] = cTri.g; c[(t + v) * 3 + 2] = cTri.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { E.set(rx, ry, rz); Q.setFromEuler(E); return M4.clone().compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); }

function n3(x, y, z) { return Math.sin(x * 1.7 + y * 0.9) * 0.5 + Math.sin(y * 2.3 - z * 1.3) * 0.3 + Math.sin(z * 2.9 + x * 1.1 + y * 0.4) * 0.2; }

const ROCK = { light: col('#e6d6b6'), warm: col('#d6915a'), dark: col('#8a7f72'), wet: col('#6e6656'), moss: col('#6a9a3c') };
const GREENS = ['#2f8f3a', '#3fa34d', '#1f6e30', '#58b04a', '#2a7d3f', '#6cbf4a'].map(col);

// Torre de karst: cilindro deformado con muesca en la línea de flotación, copa de selva, lianas y cueva.
function karst(x, z, r, h, vr, { canopy = true, lianas = true, cave = false, caveAng = 0, bright = false } = {}) {
  const out = [];
  const seg = 9 + Math.floor(vr() * 4), hs = 9;
  const g = new THREE.CylinderGeometry(1, 1, 1, seg, hs, false);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position;
  const ph = vr() * 100, top = 0.85 + vr() * 0.4, lean = (vr() - 0.5) * 0.18, leanA = vr() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const a = Math.atan2(pz, px);
    let prof = py < 0.07 ? 0.8 + py * 2.5 : 1;
    prof *= 1 + (top - 1) * py;
    if (py > 0.82) prof *= 1 - (py - 0.82) * 1.3;
    prof *= 0.82 + 0.36 * (0.5 + 0.5 * n3(Math.cos(a) * 2.2 + ph, py * 4.5, Math.sin(a) * 2.2 - ph));
    let wy = py * h - 2.5;
    if (py > 0.99 && Math.hypot(px, pz) < 0.01) wy += h * 0.05;
    const lx = Math.cos(leanA) * lean * py * h * 0.25, lz = Math.sin(leanA) * lean * py * h * 0.25;
    pos.setXYZ(i, px * prof * r + lx, wy, pz * prof * r + lz);
  }
  const rockGeo = prep(g, mat(x, 0, z), (p, t) => {
    const ax = p.getX(t), ay = p.getY(t), az = p.getZ(t), bx = p.getX(t + 1), by = p.getY(t + 1), bz = p.getZ(t + 1), cx = p.getX(t + 2), cy = p.getY(t + 2), cz = p.getZ(t + 2);
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1;
    const yN = ((ay + by + cy) / 3 + 2.5) / h;
    const ang = Math.atan2((az + bz + cz) / 3 - z, (ax + bx + cx) / 3 - x);
    const c = new THREE.Color();
    const up = ny / nl;
    // color por "celda" (columna, fila) para que los dos triángulos de cada cara coincidan
    const colI = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * seg), rowI = Math.floor(yN * hs);
    const hsh = Math.abs(Math.sin(colI * 12.9898 + rowI * 78.233 + ph) * 43758.5453) % 1;
    const st = Math.sin(colI * 2.1 + ph) + Math.sin(colI * 0.7 + ph * 1.7) * 0.6;
    const caveD = cave ? Math.abs(Math.atan2(Math.sin(ang - caveAng), Math.cos(ang - caveAng))) : 9;
    const hW = yN * h - 2.5; // altura real sobre el agua
    if (caveD < 0.16 && hW < 3.5 - caveD * 8) c.set('#5a4a3c');
    else if (hW < 0.6) c.copy(ROCK.wet);
    else if (up > 0.45 || yN > 0.84 || (yN > 0.62 && hsh < 0.22)) c.copy(GREENS[Math.floor(hsh * 4)]);
    else {
      c.copy(ROCK.light);
      if (st > 0.85) c.lerp(ROCK.warm, 0.55 + hsh * 0.3); else if (st < -0.9) c.lerp(ROCK.dark, 0.5 + hsh * 0.3);
      if (bright) c.set('#f2e6cc').lerp(ROCK.warm, st > 0.85 ? 0.4 : 0);
      else if (hW < 3.5) c.lerp(ROCK.wet, ((3.5 - hW) / 3.5) * 0.45);
      c.multiplyScalar(0.94 + hsh * 0.12);
    }
    return c;
  });
  out.push(rockGeo);
  const topY = h * 0.97 - 2.5, topR = r * top * 0.75;
  if (canopy) {
    const blobs = 4 + Math.floor(r / 4);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + vr(), d = i === 0 ? 0 : topR * (0.55 + vr() * 0.4);
      const br = r * (0.28 + vr() * 0.2);
      const ico = new THREE.IcosahedronGeometry(br, 0);
      out.push(prep(ico, mat(x + Math.cos(a) * d, topY + br * 0.25 + vr() * 1.5, z + Math.sin(a) * d, vr(), vr(), 0, 1, 0.7 + vr() * 0.4, 1), GREENS[Math.floor(vr() * GREENS.length)]));
    }
    // matas colgadas en las paredes
    const side = 2 + Math.floor(vr() * 3);
    for (let i = 0; i < side; i++) {
      const a = vr() * 6.28, yy = h * (0.35 + vr() * 0.45) - 2.5;
      const br = r * (0.15 + vr() * 0.1);
      out.push(prep(new THREE.IcosahedronGeometry(br, 0), mat(x + Math.cos(a) * r * 0.95, yy, z + Math.sin(a) * r * 0.95, 0, vr() * 3, 0, 1.2, 0.6, 1.2), GREENS[Math.floor(vr() * GREENS.length)]));
    }
  }
  if (lianas) {
    const nl = 3 + Math.floor(r / 3);
    for (let i = 0; i < nl; i++) {
      const a = vr() * 6.28, len = h * (0.18 + vr() * 0.3);
      const rr = topR * 1.05 + 0.3;
      out.push(prep(new THREE.BoxGeometry(0.22, len, 0.22), mat(x + Math.cos(a) * rr, topY - len / 2, z + Math.sin(a) * rr, 0, 0, (vr() - 0.5) * 0.15), vr() < 0.5 ? '#2d5a2a' : '#3e7a34'));
    }
  }
  return out;
}

// Arena: montículo aplanado
function beachGeo(x, z, rx, rz, ang) {
  const g = new THREE.CylinderGeometry(0.62, 1, 1, 14, 1);
  return prep(g, mat(x, -0.32, z, 0, ang, 0, rx, 0.9, rz), (p, t) => (p.getY(t) + p.getY(t + 1) + p.getY(t + 2) > 0.5 ? col('#f6edd3') : col('#e9d9ad')));
}

// ───────── palmeras (instanciadas) ─────────
function palmGeos() {
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, 8, 6, 8);
  trunk.translate(0, 4, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 8; p.setX(i, p.getX(i) + y * y * 1.8); }
  trunk.computeVertexNormals();
  const leaves = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const pts = [];
    const L = 3.6, W = 0.55;
    // hoja: tira de 4 tramos que cae
    for (let s = 0; s <= 4; s++) {
      const u = s / 4, d = u * L, y = 0.5 * Math.sin(u * Math.PI * 0.6) - u * u * 1.6, w = W * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.08));
      pts.push([d, y, -w], [d, y + 0.05, w]);
    }
    const pos = [];
    for (let s = 0; s < 4; s++) { const [a0, a1] = [pts[s * 2], pts[s * 2 + 1]], [b0, b1] = [pts[s * 2 + 2], pts[s * 2 + 3]]; pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    leaves.push(prep(g, mat(1.8, 8, 0, 0, a, -0.1), GREENS[k % GREENS.length]));
  }
  for (let k = 0; k < 3; k++) leaves.push(prep(new THREE.IcosahedronGeometry(0.22, 0), mat(1.8 + Math.cos(k * 2.1) * 0.25, 7.7, Math.sin(k * 2.1) * 0.25), '#6b4a22'));
  const crown = mergeGeometries(leaves); crown.computeVertexNormals();
  return { trunk, crown };
}

// ───────── personajes simpáticos ─────────
function randomLook(vr) {
  const pick = (a) => a[Math.floor(vr() * a.length)];
  return { skin: pick(SKINS.slice(1)), hair: pick(HAIRS.slice(0, 5)), shirt: pick(SHIRTS), pattern: Math.floor(vr() * 4), shorts: pick(['#2e4a7d', '#3a3a3a', '#7a5230', '#1f8a8a']), hairStyle: Math.floor(vr() * 5), cap: vr() < 0.4 ? pick(['#f4d35e', '#ee6c4d', '#2ec4b6']) : null, glasses: vr() < 0.2 };
}

// Mono simpático en una roca
function buildMonkey() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#8d6346', flatShading: true }), face = new THREE.MeshStandardMaterial({ color: '#e0b48a', flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: '#1b1b22' });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), fur); body.position.y = 0.5; body.scale.set(1, 1.2, 0.9); g.add(body);
  const head = new THREE.Group(); head.position.y = 1.1; g.add(head);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), fur));
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), face); f.position.set(0, -0.04, 0.17); f.scale.set(1, 0.85, 0.7); head.add(f);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), face); e.position.set(0.3 * s, 0.05, 0); head.add(e);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), dark); eye.position.set(0.08 * s, 0.06, 0.3); head.add(eye);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(0.36 * s, 0.75, 0); g.add(piv);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 5), fur); a.position.y = -0.3; piv.add(a);
    arms.push(piv);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 4, 10, Math.PI * 1.3), fur); tail.position.set(0, 0.35, -0.42); tail.rotation.y = Math.PI / 2; g.add(tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, head, arms };
}

function buildTurtle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: '#3d7a4a', flatShading: true }));
  shell.scale.set(1, 0.38, 1.2); g.add(shell);
  const skin = new THREE.MeshStandardMaterial({ color: '#8fbf7a', flatShading: true });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), skin); head.position.set(0, 0.05, 0.92); g.add(head);
  const fl = [];
  for (const [x, z] of [[0.6, 0.45], [-0.6, 0.45], [0.45, -0.6], [-0.45, -0.6]]) {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.25), skin); m.position.x = Math.sign(x) * 0.28; p.add(m);
    fl.push(p);
  }
  return { group: g, fl };
}

function textTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = 'bold 84px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 70);
  for (let i = 0; i < 16; i++) { g.fillStyle = ['#ff4f9a', '#ffd23f', '#ffffff', '#2ec4b6'][i % 4]; g.beginPath(); g.arc(16 + i * 32, 10, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(16 + i * 32, 118, 8, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, inner); gr.addColorStop(0.5, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────── construcción ─────────
export function buildWorld({ scene, rng, vr, quality, makeCharacter }) {
  const path = makePath(rng);
  const L = path.L;
  const obstacles = [];   // { x, z, r, kind }
  const islands = [];     // para el mapa de bajíos
  const beaches = [];
  const chunks = new Map();
  const farGeos = [];
  const addGeo = (g, x, z) => { const k = Math.floor(x / 260) + ',' + Math.floor(z / 260); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(g); };
  const palms = [];       // { x, y, z, ry, tilt, s }

  // calas
  const CALA_TYPES = [
    { id: 'tortugas', name: 'Cala de las Tortugas', emoji: '🐢' },
    { id: 'cueva', name: 'La Cueva de Luz', emoji: '🏮' },
    { id: 'columpio', name: 'Cala del Columpio', emoji: '🌴' },
  ];
  const calas = [];
  let side = rng.chance(0.5) ? 1 : -1;
  for (let k = 0; k < 3; k++) {
    let s = L * [0.25, 0.53, 0.8][k];
    let best = null;
    for (let tries = 0; tries < 12 && !best; tries++) {
      for (const sd of [side, -side]) {
        const a = path.at(s);
        const cx = a.x + a.nx * sd * CALA_OFF, cz = a.z + a.nz * sd * CALA_OFF;
        if (path.distTo(cx, cz, 2) > CALA_OFF - 6 && calas.every((c) => Math.hypot(c.x - cx, c.z - cz) > 140)) { best = { s, side: sd, a, x: cx, z: cz }; break; }
      }
      s += 18;
    }
    if (!best) { const a = path.at(s); best = { s, side, a, x: a.x + a.nx * side * CALA_OFF, z: a.z + a.nz * side * CALA_OFF }; }
    const { a } = best, sd = best.side;
    const tox = -a.nx * sd, toz = -a.nz * sd;  // del centro hacia el canal
    const cg = Math.cos(GAP), sg = Math.sin(GAP);
    const entry = { x: tox * cg - a.tx * sg, z: toz * cg - a.tz * sg };
    const exit = { x: tox * cg + a.tx * sg, z: toz * cg + a.tz * sg };
    calas.push({ ...CALA_TYPES[k], idx: k, s: best.s, side: sd, x: best.x, z: best.z, entry, exit, back: { x: -tox, z: -toz }, tan: { x: a.tx, z: a.tz }, found: false });
    side = -sd;
  }

  // puertas
  const gates = [];
  let gs = 85;
  while (gs < L - 70) {
    if (calas.some((c) => Math.abs(c.s - gs) < 48)) { gs += 12; continue; }
    const a = path.at(gs);
    const off = gates.length === 0 ? 0 : rng.range(-8, 8);
    gates.push({ s: gs, off, half: 9, x: a.x + a.nx * off, z: a.z + a.nz * off, tx: a.tx, tz: a.tz, nx: a.nx, nz: a.nz, state: 0 });
    gs += rng.range(82, 108);
  }
  {
    const s = L - 14, a = path.at(s);
    gates.push({ s, off: 0, half: 13, x: a.x, z: a.z, tx: a.tx, tz: a.tz, nx: a.nx, nz: a.nz, state: 0, finish: true });
  }

  // anillos de roca de las calas (con arco en la entrada)
  const calaRock = (x, z, r, h, extra) => { obstacles.push({ x, z, r: r * 0.9, kind: 'roca' }); islands.push({ x, z, r }); for (const g of karst(x, z, r, h, vr, extra)) addGeo(g, x, z); };
  for (const c of calas) {
    const aEntry = Math.atan2(c.entry.z, c.entry.x), aExit = Math.atan2(c.exit.z, c.exit.x), aBack = Math.atan2(c.back.z, c.back.x);
    const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    let edgeA = null, edgeB = null;
    for (let a = 0; a < Math.PI * 2 - 0.01; a += 0.3) {
      if (angDist(a, aEntry) < 0.56 || angDist(a, aExit) < 0.56) continue;
      const r = 5.6 + rng() * 1.8, rr = CALA_R + r * 0.55;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      const h = 16 + rng() * 18;
      calaRock(x, z, r, h);
      const d = Math.atan2(Math.sin(a - aEntry), Math.cos(a - aEntry));
      if (d > 0 && (!edgeA || d < edgeA.d)) edgeA = { x, z, d, h };
      if (d < 0 && (!edgeB || -d < edgeB.d)) edgeB = { x, z, d: -d, h };
    }
    // arco de piedra sobre la entrada
    if (edgeA && edgeB) {
      const mx = (edgeA.x + edgeB.x) / 2, mz = (edgeA.z + edgeB.z) / 2, len = Math.hypot(edgeA.x - edgeB.x, edgeA.z - edgeB.z) + 4;
      const ang = Math.atan2(edgeA.z - edgeB.z, edgeA.x - edgeB.x);
      const lg = new THREE.BoxGeometry(len, 3.2, 4, 6, 2, 2);
      const p = lg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - Math.pow(x / (len / 2), 2) * -1.8 + n3(x, p.getY(i), p.getZ(i)) * 0.5); p.setZ(i, p.getZ(i) * (1 + n3(x * 0.7, 1, 2) * 0.2)); }
      addGeo(prep(lg, mat(mx, 11.5, mz, 0, -ang, 0), (pp, t) => (pp.getY(t) > 12.6 ? GREENS[1] : ROCK.light.clone().lerp(ROCK.warm, vr() * 0.5))), mx, mz);
      for (let i = 0; i < 4; i++) addGeo(prep(new THREE.BoxGeometry(0.2, 3 + vr() * 3, 0.2), mat(mx + Math.cos(ang) * (i - 1.5) * 2.5, 8.5, mz + Math.sin(ang) * (i - 1.5) * 2.5), '#2d5a2a'), mx, mz);
    }
    // interior
    if (c.id === 'cueva') {
      const bx = c.x + c.back.x * (CALA_R + 13), bz = c.z + c.back.z * (CALA_R + 13);
      calaRock(bx, bz, 11, 44);
      c.cave = { x: c.x + c.back.x * (CALA_R - 3.8), z: c.z + c.back.z * (CALA_R - 3.8), ang: Math.atan2(-c.back.z, -c.back.x) };
    } else {
      const bx = c.x + c.back.x * 15, bz = c.z + c.back.z * 15;
      beaches.push({ x: bx, z: bz, rx: 9, rz: 5.5, ang: Math.atan2(c.back.x, c.back.z) });
      addGeo(beachGeo(bx, bz, 9.5, 5.5, Math.atan2(c.back.x, c.back.z)), bx, bz);
      const px = -c.back.z, pz = c.back.x;
      for (const k of [-1, 1]) palms.push({ x: bx + px * k * 5 + c.back.x * 2, y: 0.3, z: bz + pz * k * 5 + c.back.z * 2, ry: Math.atan2(c.back.z, -c.back.x) + (vr() - 0.5) * 0.8, tilt: 0.12, s: 0.9 + vr() * 0.3 });
      c.beach = { x: bx, z: bz };
    }
  }

  // ¿choca una isla candidata con algo que debe quedar libre?
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const corridors = [];
  for (const c of calas) {
    for (const g of [c.entry, c.exit]) {
      const gx = c.x + g.x * CALA_R, gz = c.z + g.z * CALA_R;
      const q = path.locate(gx, gz);
      const a = path.at(q.s);
      corridors.push([gx + g.x * 6, gz + g.z * 6, a.x + a.nx * c.side * 18, a.z + a.nz * c.side * 18]);
      corridors.push([c.x, c.z, gx + g.x * 8, gz + g.z * 8]);
    }
  }
  const free = (x, z, r, minPath) => {
    if (path.distTo(x, z, 2) < minPath) return false;
    for (const c of calas) if (Math.hypot(x - c.x, z - c.z) < CALA_R + 10 + r) return false;
    for (const k of corridors) if (segDist(x, z, ...k) < r + 9) return false;
    for (const o of islands) if (Math.hypot(x - o.x, z - o.z) < (o.r + r) * 0.8) return false;
    if (Math.hypot(x, z) < r + 30) return false;
    return true;
  };

  // islas que bordean el canal
  for (let s = 0; s < L + 60; s += 15) {
    for (const sd of [-1, 1]) {
      if (!rng.chance(0.55)) continue;
      const r = rng.range(7, 21), lat = sd * (CHANNEL + r + rng.range(3, 60));
      const a = path.at(Math.min(s, L)), x = a.x + a.nx * lat + a.tx * rng.range(-6, 6), z = a.z + a.nz * lat + a.tz * rng.range(-6, 6);
      if (!free(x, z, r, CHANNEL + r)) continue;
      const h = Math.min(78, r * rng.range(2, 3.4) + 10);
      const cave = vr() < 0.3;
      islands.push({ x, z, r }); obstacles.push({ x, z, r: r * 0.9, kind: 'roca' });
      for (const g of karst(x, z, r, h, vr, { cave, caveAng: Math.atan2(a.z - z, a.x - x) + (vr() - 0.5) })) addGeo(g, x, z);
      // playa mirando al canal
      if (r > 9 && Math.abs(lat) < 70 && vr() < 0.4) {
        const q = path.locate(x, z), pa = path.at(q.s);
        const dx = pa.x - x, dz = pa.z - z, dl = Math.hypot(dx, dz);
        const ux = dx / dl, uz = dz / dl;
        const bx = x + ux * (r * 0.85 + 3), bz = z + uz * (r * 0.85 + 3);
        if (path.distTo(bx, bz, 2) > CHANNEL + 4) {
          const ang = Math.atan2(ux, uz);
          beaches.push({ x: bx, z: bz, rx: r * 0.9, rz: 6, ang });
          addGeo(beachGeo(bx, bz, r * 0.95, 6, ang), bx, bz);
          const np = 2 + Math.floor(vr() * 3);
          for (let i = 0; i < np; i++) { const t = (i / Math.max(1, np - 1) - 0.5) * r * 1.1; palms.push({ x: bx - uz * t, y: 0.3, z: bz + ux * t, ry: Math.atan2(-uz, ux) + (vr() - 0.5) * 0.9, tilt: 0.1 + vr() * 0.2, s: 0.8 + vr() * 0.4 }); }
        }
      }
    }
  }
  // segunda fila (paisaje)
  for (let s = -100; s < L + 200; s += 22) {
    for (const sd of [-1, 1]) {
      const r = rng.range(14, 34), lat = sd * rng.range(95, 260);
      const a = path.at(clamp(s, 0, L)), x = a.x + a.nx * lat + a.tx * (s < 0 ? s : s > L ? s - L : 0), z = a.z + a.nz * lat + a.tz * (s < 0 ? s : s > L ? s - L : 0);
      if (!free(x, z, r, 70 + r)) continue;
      const h = r * rng.range(2.2, 3.6) + 15;
      islands.push({ x, z, r }); obstacles.push({ x, z, r: r * 0.9, kind: 'roca' });
      for (const g of karst(x, z, r, h, vr, { lianas: r < 24 })) addGeo(g, x, z);
    }
  }
  // detrás de la salida y de la meta, que no se vea el fin del mundo
  for (const s of [-40, L + 70]) {
    const a = path.at(clamp(s, 0, L));
    for (let k = -3; k <= 3; k++) {
      const r = rng.range(16, 26), x = a.x + a.nx * k * 32 + a.tx * (s < 0 ? -30 : 40), z = a.z + a.nz * k * 32 + a.tz * (s < 0 ? -30 : 40);
      if (!free(x, z, r, r + 8)) continue;
      const h = r * 2.6 + 20;
      islands.push({ x, z, r }); obstacles.push({ x, z, r: r * 0.9, kind: 'roca' });
      for (const g of karst(x, z, r, h, vr)) addGeo(g, x, z);
    }
  }

  // rocas sueltas en el canal (obstáculos)
  const rocks = [];
  const headAt = (s) => { const a = path.at(clamp(s, 0, L)); return Math.atan2(a.tx, a.tz); };
  const turnBefore = (s) => { let m = 0; for (let k = 10; k <= 60; k += 10) m = Math.max(m, Math.abs(Math.atan2(Math.sin(headAt(s) - headAt(s - k)), Math.cos(headAt(s) - headAt(s - k))))); return m; };
  for (let s = 110; s < L - 45; s += rng.range(62, 95)) {
    const lat = rng.range(-15, 15), r = rng.range(2.2, 3.4), h = rng.range(8, 14);
    if (gates.some((g) => Math.abs(g.s - s) < 24) || calas.some((c) => Math.abs(c.s - s) < 50)) continue;
    if (turnBefore(s) > 0.3) continue; // nada justo a la salida de una curva cerrada
    const a = path.at(s);
    const x = a.x + a.nx * lat, z = a.z + a.nz * lat;
    rocks.push({ x, z, r }); obstacles.push({ x, z, r: r * 0.95, kind: 'roca' }); islands.push({ x, z, r: r * 0.8 });
    for (const g of karst(x, z, r, h, vr, { canopy: true, lianas: false, bright: true })) addGeo(g, x, z);
  }

  // el mono en su roca, al borde del canal
  const monkeyRock = (() => {
    const s = L * 0.42, a = path.at(s), sd = calas[1].side === 1 ? -1 : 1;
    const x = a.x + a.nx * sd * (CHANNEL - 3), z = a.z + a.nz * sd * (CHANNEL - 3);
    obstacles.push({ x, z, r: 2.6, kind: 'roca' }); islands.push({ x, z, r: 2.4 });
    for (const g of karst(x, z, 2.8, 4.5, vr, { canopy: false, lianas: false })) addGeo(g, x, z);
    return { x, z, y: 4.5 * 0.97 - 2.5 + 0.1, face: Math.atan2(-a.nx * sd, -a.nz * sd) };
  })();

  // islas lejanas (silueta en la calima)
  const cx0 = (Math.min(...path.px) + Math.max(...path.px)) / 2, cz0 = (Math.min(...path.pz) + Math.max(...path.pz)) / 2;
  for (let i = 0; i < 46; i++) {
    const ang = (i / 46) * Math.PI * 2 + vr() * 0.1, d = 650 + vr() * 450;
    const x = cx0 + Math.cos(ang) * d, z = cz0 + Math.sin(ang) * d, r = 30 + vr() * 45;
    farGeos.push(...karst(x, z, r, r * (1.8 + vr() * 1.6) + 30, vr, { lianas: false }));
  }

  // mallas de roca fusionadas por trozos (frustum culling)
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const groupRocks = new THREE.Group(); scene.add(groupRocks);
  for (const list of chunks.values()) {
    const g = mergeGeometries(list); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, rockMat); m.castShadow = true; m.receiveShadow = true; groupRocks.add(m);
    for (const x of list) x.dispose();
  }
  { const g = mergeGeometries(farGeos); g.computeVertexNormals(); const m = new THREE.Mesh(g, rockMat); groupRocks.add(m); for (const x of farGeos) x.dispose(); }

  // palmeras
  const pg = palmGeos();
  const trunkI = new THREE.InstancedMesh(pg.trunk, new THREE.MeshStandardMaterial({ color: '#9a6a3a', flatShading: true }), Math.max(1, palms.length + 1));
  const crownI = new THREE.InstancedMesh(pg.crown, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), Math.max(1, palms.length + 1));
  palms.forEach((p, i) => { const m = mat(p.x, p.y, p.z, 0, p.ry, -p.tilt, p.s); trunkI.setMatrixAt(i, m); crownI.setMatrixAt(i, m); });
  trunkI.count = crownI.count = palms.length;
  trunkI.castShadow = crownI.castShadow = true;
  scene.add(trunkI, crownI);

  // ───────── calas: contenido ─────────
  const anims = [];
  for (const c of calas) {
    // gaviotas que delatan la cala
    c.gullCenter = { x: c.x, z: c.z };
    if (c.id === 'tortugas') {
      c.turtles = [];
      for (let i = 0; i < 3; i++) { const t = buildTurtle(); t.group.scale.setScalar(1.7); scene.add(t.group); c.turtles.push({ ...t, r: 6 + i * 2.5, ph: i * 2.1, sp: 0.35 + i * 0.07 }); }
    } else if (c.id === 'cueva') {
      const g = new THREE.Group(); g.position.set(c.cave.x, 0, c.cave.z); g.rotation.y = Math.atan2(-c.back.x, -c.back.z); scene.add(g);
      // boca de la cueva: oscuro + resplandor + farolillos
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(7, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#120a08' }));
      mouth.scale.y = 1.2; mouth.position.set(0, -0.5, -0.2); g.add(mouth);
      const glowM = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,236,170,1)', 'rgba(255,140,60,0.75)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 10), glowM); glow.position.set(0, 3.5, 0.3); g.add(glow);
      const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(120,255,230,0.9)', 'rgba(40,160,200,0.4)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      glow2.rotation.x = -Math.PI / 2; glow2.position.set(0, 0.35, 3.5); g.add(glow2);
      const lanterns = [];
      const lc = ['#ff4f6d', '#ffb347', '#ffe066', '#ff7bd5', '#7cf5ff'];
      for (let i = 0; i < 7; i++) {
        const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(lc[i % 5]).multiplyScalar(2.2), toneMapped: false }));
        l.position.set((i - 3) * 1.8, 6.8 - Math.abs(i - 3) * 0.6, 1.2); g.add(l); lanterns.push(l);
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.04), new THREE.MeshBasicMaterial({ color: '#222' })); cord.position.set((i - 3) * 1.8, 7.5 - Math.abs(i - 3) * 0.6, 1.2); g.add(cord);
      }
      // estalactitas
      const stal = new THREE.MeshStandardMaterial({ color: '#b9a98e', flatShading: true });
      for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.4 + vr() * 0.3, 1.5 + vr() * 2, 5), stal); s.rotation.x = Math.PI; s.position.set((i - 4) * 1.45, 7.8 - Math.abs(i - 4) * 0.55 - vr(), 0.6); g.add(s); }
      c.lanterns = lanterns; c.caveGroup = g;
    } else if (c.id === 'columpio') {
      // palmera inclinada sobre el agua con un columpio
      const b = c.beach;
      const g = new THREE.Group(); g.position.set(b.x + c.back.x * -1.5, 0.2, b.z + c.back.z * -1.5); g.rotation.y = Math.atan2(c.back.z, -c.back.x); scene.add(g);
      const trunk = new THREE.Mesh(pg.trunk, trunkI.material); trunk.rotation.z = -0.55; trunk.scale.setScalar(1.15); trunk.castShadow = true; g.add(trunk);
      const crown = new THREE.Mesh(pg.crown, crownI.material); crown.rotation.z = -0.55; crown.scale.setScalar(1.15); g.add(crown);
      // rama de la que cuelga (en coordenadas de la palmera inclinada: ~ (5.5, 6.2))
      const swing = new THREE.Group(); swing.position.set(5.3, 6.4, 0); g.add(swing);
      const rope = new THREE.MeshStandardMaterial({ color: '#e8d9b0' });
      for (const z of [-0.45, 0.45]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5, 4), rope); r.position.set(0, -2.5, z); swing.add(r); }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: '#ff6f61', flatShading: true })); seat.position.y = -5; swing.add(seat);
      c.swing = swing;
    }
  }

  // ───────── puertas de boyas ─────────
  const buoyParts = [];
  {
    const body = new THREE.CylinderGeometry(0.42, 0.5, 1.0, 8); body.translate(0, 0.1, 0);
    const band = new THREE.CylinderGeometry(0.44, 0.46, 0.25, 8); band.translate(0, 0.15, 0);
    const top = new THREE.ConeGeometry(0.42, 0.5, 8); top.translate(0, 0.85, 0);
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5); pole.translate(0, 2.1, 0);
    buoyParts.push(prep(body, null, '#ff3b3b'), prep(band, null, '#ffffff'), prep(top, null, '#ff3b3b'), prep(pole, null, '#eeeeee'));
  }
  const buoyGeo = mergeGeometries(buoyParts); buoyGeo.computeVertexNormals();
  const nB = gates.length * 2;
  const buoyI = new THREE.InstancedMesh(buoyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }), nB);
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.4, 0, 0, 2.5, 0, 1.3, 2.95, 0, 0, 3.4, 0, 1.3, 2.95, 0, 0, 2.5, 0], 3)); flagGeo.computeVertexNormals();
  const flagI = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, flatShading: true, emissive: '#222222' }), nB);
  buoyI.castShadow = true;
  scene.add(buoyI, flagI);
  const tmpC = new THREE.Color();
  for (let i = 0; i < nB; i++) flagI.setColorAt(i, tmpC.set('#ffd23f'));
  // flecha sobre la siguiente puerta
  const arrow = new THREE.Group();
  const arrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe14d').multiplyScalar(1.6), toneMapped: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 4), arrowMat); cone.rotation.x = Math.PI; arrow.add(cone);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), arrowMat); stem.position.y = 1.5; arrow.add(stem);
  scene.add(arrow);
  // arco de meta
  const fin = gates[gates.length - 1];
  const finish = new THREE.Group(); finish.position.set(fin.x, 0, fin.z); finish.rotation.y = Math.atan2(fin.tx, fin.tz); scene.add(finish);
  {
    const bam = new THREE.MeshStandardMaterial({ color: '#d8b15a', flatShading: true });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 10, 6), bam); p.position.set(s * (fin.half + 1), 3.5, 0); p.castShadow = true; finish.add(p);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 1.2, 8), new THREE.MeshStandardMaterial({ color: '#ff3b3b', flatShading: true })); f.position.set(s * (fin.half + 1), -0.1, 0); finish.add(f);
    }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(fin.half * 2 + 2, 3), new THREE.MeshBasicMaterial({ map: textTexture('META', '#ff4f9a', '#ffffff'), side: THREE.DoubleSide }));
    ban.position.y = 7.2; finish.add(ban);
  }

  // ───────── barcas de pescadores ─────────
  const boats = [];
  const stripes = ['#ff4f9a', '#ffd23f', '#2ec4b6', '#ff7b39', '#7b5cff'];
  const patrolS = [0.13, 0.36, 0.6, 0.88].map((f) => f * L);
  patrolS.forEach((s0, i) => {
    let s = s0;
    for (let k = 0; k < 10 && (gates.some((g) => Math.abs(g.s - s) < 26) || calas.some((c) => Math.abs(c.s - s) < 40)); k++) s += 12;
    const b = buildBoat({ stripe: stripes[i % stripes.length], wood: i % 2 ? '#7a4a2a' : '#9a6234', canopy: i % 2 === 0 });
    const owner = makeCharacter(randomLook(vr));
    owner.group.position.set(0, -0.15, -2.3); owner.group.traverse((o) => { o.castShadow = false; });
    b.pitch.add(owner.group);
    b.group.traverse((o) => { if (o.isMesh && o !== b.group) o.castShadow = o.castShadow && i < 2; });
    scene.add(b.group);
    boats.push({ b, owner, s, amp: rng.range(14, 20), ph: rng() * 6.28, sp: rng.range(0.16, 0.22), x: 0, z: 0, r: 2.6, yaw: 0, kind: 'barca', waved: false });
  });
  // amarradas junto a playas, con el dueño saludando
  const anchored = [];
  const nearBeaches = beaches.filter((b) => path.distTo(b.x, b.z, 2) < 60).slice(0, 6);
  for (let i = 0; i < Math.min(2, nearBeaches.length); i++) {
    const bc = nearBeaches[i * 2] || nearBeaches[i];
    const q = path.locate(bc.x, bc.z), pa = path.at(q.s);
    const ux = pa.x - bc.x, uz = pa.z - bc.z, ul = Math.hypot(ux, uz);
    const x = bc.x + (ux / ul) * 8, z = bc.z + (uz / ul) * 8;
    if (path.distTo(x, z, 2) < CHANNEL - 2) continue;
    const b = buildBoat({ stripe: stripes[(i + 2) % 5], canopy: i === 1 });
    const owner = makeCharacter(randomLook(vr));
    owner.group.position.set(0, -0.15, 0.4); owner.group.traverse((o) => { o.castShadow = false; });
    b.pitch.add(owner.group);
    b.group.position.set(x, 0, z); b.group.rotation.y = Math.atan2(-uz, ux);
    scene.add(b.group);
    anchored.push({ b, owner, x, z, yaw: b.group.rotation.y });
    obstacles.push({ x, z, r: 2.4, kind: 'barca' });
  }

  // mono
  const monkey = buildMonkey();
  monkey.group.position.set(monkeyRock.x, monkeyRock.y, monkeyRock.z); monkey.group.rotation.y = monkeyRock.face; monkey.group.scale.setScalar(1.3);
  scene.add(monkey.group);

  // gaviotas (alas instanciadas)
  const gulls = [];
  for (const c of calas) for (let i = 0; i < 3; i++) gulls.push({ cx: c.x, cz: c.z, r: 6 + i * 3, y: 20 + i * 3, ph: i * 2.1, sp: 0.5 + i * 0.1 });
  for (let i = 0; i < 9; i++) { const o = islands[Math.floor(vr() * islands.length)]; if (o) gulls.push({ cx: o.x, cz: o.z, r: 10 + vr() * 12, y: 30 + vr() * 25, ph: vr() * 6, sp: 0.3 + vr() * 0.3 }); }
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, 0, 0, -0.25, 1.3, 0, -0.05], 3)); wingGeo.computeVertexNormals();
  const gullMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, flatShading: true });
  const wingL = new THREE.InstancedMesh(wingGeo, gullMat, gulls.length), wingR = new THREE.InstancedMesh(wingGeo, gullMat, gulls.length);
  const bodyI = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.9, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f2f2f2', flatShading: true }), gulls.length);
  scene.add(wingL, wingR, bodyI);
  for (const m of [wingL, wingR, bodyI]) m.frustumCulled = false;

  // flotadores de zona de baño
  const floats = [];
  for (const b of beaches.slice(0, 8)) {
    const q = path.locate(b.x, b.z), pa = path.at(q.s);
    const ux = pa.x - b.x, uz = pa.z - b.z, ul = Math.hypot(ux, uz) || 1;
    for (let i = -3; i <= 3; i++) {
      const x = b.x + (ux / ul) * 11 - (uz / ul) * i * 2.2, z = b.z + (uz / ul) * 11 + (ux / ul) * i * 2.2;
      if (path.distTo(x, z, 2) > CHANNEL) floats.push({ x, z });
    }
  }
  const floatI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: '#ff8c1a', flatShading: true }), Math.max(1, floats.length));
  floatI.count = floats.length; scene.add(floatI);

  // nubes
  const cloudGeos = [];
  for (let i = 0; i < 18; i++) {
    const ang = vr() * Math.PI * 2, d = 650 + vr() * 500, y = 160 + vr() * 180;
    const x = cx0 + Math.cos(ang) * d, z = cz0 + Math.sin(ang) * d, s = 40 + vr() * 50;
    const nb = 4 + Math.floor(vr() * 4);
    for (let k = 0; k < nb; k++) {
      const g = new THREE.IcosahedronGeometry(s * (0.5 + vr() * 0.5), 1);
      cloudGeos.push(prep(g, mat(x + (k - nb / 2) * s * 0.7, y + vr() * s * 0.3, z + (vr() - 0.5) * s * 0.6, 0, vr() * 3, 0, 1, 0.6, 0.9), (p, t) => {
        const yy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3 - y;
        return yy > 0 ? col('#ffffff') : col('#dbeaf6');
      }));
    }
  }
  const clouds = new THREE.Mesh(mergeGeometries(cloudGeos), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  scene.add(clouds);

  // ───────── mapa de bajíos (R = poco fondo, G = espuma de orilla, B = arena) ─────────
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < path.n; i++) { minX = Math.min(minX, path.px[i]); maxX = Math.max(maxX, path.px[i]); minZ = Math.min(minZ, path.pz[i]); maxZ = Math.max(maxZ, path.pz[i]); }
  const size = Math.max(maxX - minX, maxZ - minZ) + 640;
  const x0 = (minX + maxX) / 2 - size / 2, z0 = (minZ + maxZ) / 2 - size / 2;
  const W = quality === 'baja' ? 1024 : 2048;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const g2 = cv.getContext('2d');
  g2.fillStyle = 'rgb(60,0,0)'; g2.fillRect(0, 0, W, W);
  g2.globalCompositeOperation = 'lighter';
  const toC = (x, z) => [((x - x0) / size) * W, ((z - z0) / size) * W];
  const k = W / size;
  const radial = (x, z, r0, r1, rgb, a = 1) => {
    const [cx, cz] = toC(x, z);
    const gr = g2.createRadialGradient(cx, cz, Math.max(0, r0 * k), cx, cz, Math.max(1, r1 * k));
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cz, r1 * k, 0, Math.PI * 2); g2.fill();
  };
  for (const o of islands) {
    radial(o.x, o.z, o.r * 0.8, o.r * 2.1 + 5, '255,0,0', 0.75);
    // anillo de espuma pegado a la roca (ancho fijo de ~4 m)
    const [cx, cz] = toC(o.x, o.z);
    const r0 = o.r * 0.75, r1 = o.r * 1.04 + 4;
    const gr = g2.createRadialGradient(cx, cz, r0 * k, cx, cz, r1 * k);
    gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(clamp((o.r * 1.04 - r0) / (r1 - r0), 0, 1), 'rgba(0,235,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cz, r1 * k, 0, Math.PI * 2); g2.fill();
  }
  for (const o of rocks) {
    const [cx, cz] = toC(o.x, o.z), r0 = o.r * 0.6, r1 = o.r + 7;
    const gr = g2.createRadialGradient(cx, cz, r0 * k, cx, cz, r1 * k);
    gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(0.45, 'rgba(0,255,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cz, r1 * k, 0, Math.PI * 2); g2.fill();
  }
  for (const b of beaches) {
    radial(b.x, b.z, 2, b.rx + 16, '255,0,0', 0.9);
    radial(b.x, b.z, 2, b.rx + 7, '0,0,255', 0.6);
    { // línea de espuma en la orilla (anillo, no disco)
      const [cx, cz] = toC(b.x, b.z), r1 = b.rx * 1.05 + 2.5, p0 = (b.rx * 0.8) / r1, p1 = (b.rx * 1.0) / r1;
      const gr = g2.createRadialGradient(cx, cz, 0, cx, cz, r1 * k);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(Math.max(p0, p1 - 0.08), 'rgba(0,0,0,1)'); gr.addColorStop(p1, 'rgba(0,120,0,1)'); gr.addColorStop(Math.min(1, p1 + 0.08), 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cz, r1 * k, 0, Math.PI * 2); g2.fill();
    }
  }
  for (const c of calas) { radial(c.x, c.z, 0, CALA_R + 4, '255,0,0', 0.7); radial(c.x, c.z, 0, CALA_R - 2, '0,0,255', 0.15); }
  // bancos de arena sueltos
  for (let i = 0; i < 26; i++) {
    const s = vr() * L, a = path.at(s), lat = (vr() < 0.5 ? -1 : 1) * (CHANNEL * 0.4 + vr() * 50);
    radial(a.x + a.nx * lat, a.z + a.nz * lat, 0, 10 + vr() * 18, '255,0,0', 0.55);
    radial(a.x + a.nx * lat, a.z + a.nz * lat, 0, 5 + vr() * 8, '0,0,255', 0.35);
  }
  const mapTex = new THREE.CanvasTexture(cv);
  mapTex.flipY = false; mapTex.colorSpace = THREE.NoColorSpace; mapTex.minFilter = THREE.LinearMipmapLinearFilter; mapTex.magFilter = THREE.LinearFilter; mapTex.generateMipmaps = true;
  mapTex.wrapS = mapTex.wrapT = THREE.ClampToEdgeWrapping;

  // muelle de salida con Nok, la de las barcas
  const dock = new THREE.Group();
  {
    const a = path.at(8), side = 3.9;
    dock.position.set(a.x + a.nx * side, 0, a.z + a.nz * side); dock.rotation.y = Math.atan2(a.tx, a.tz); scene.add(dock);
    const wood = new THREE.MeshStandardMaterial({ color: '#b07a45', flatShading: true }), post = new THREE.MeshStandardMaterial({ color: '#7a4f2a', flatShading: true });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 16), wood); deck.position.set(0.6, 0.9, -3); deck.castShadow = deck.receiveShadow = true; dock.add(deck);
    for (let z = -10; z <= 4; z += 3.5) for (const x of [-0.5, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3, 5), post); p.position.set(x, -0.3, z); dock.add(p); }
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 7), new THREE.MeshStandardMaterial({ color: ['#2ec4b6', '#ff6f61', '#ffd23f'][i], flatShading: true })); b.position.set(1.2, 1.3, -6 - i * 0.9); dock.add(b); }
    for (const z of [-10, 4]) { const lx = a.x + a.nx * (side + 0.6) + a.tx * z, lz = a.z + a.nz * (side + 0.6) + a.tz * z; obstacles.push({ x: lx, z: lz, r: 1.4, kind: 'roca' }); }
    obstacles.push({ x: dock.position.x - a.tx * 3, z: dock.position.z - a.tz * 3, r: 1.4, kind: 'roca' });
  }
  const nok = makeCharacter({ skin: '#c68a5e', hair: '#1a1210', shirt: '#ff6f61', pattern: 1, shorts: '#2e4a7d', hairStyle: 2, cap: '#ffd23f', glasses: false });
  nok.group.position.set(1.1, 0.99, 1.2); nok.group.rotation.y = Math.PI / 2; dock.add(nok.group);

  // rejilla espacial para colisiones
  const CELL = 40, grid = new Map();
  for (const o of obstacles) {
    const m = o.r + 4, a0 = Math.floor((o.x - m) / CELL), a1 = Math.floor((o.x + m) / CELL), b0 = Math.floor((o.z - m) / CELL), b1 = Math.floor((o.z + m) / CELL);
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const key = a + ',' + b; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(o); }
  }
  const near = (x, z) => grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || [];

  // ───────── animación del decorado ─────────
  const O = new THREE.Object3D();
  function update(t, gameT, sea, boatPos, nextGate) {
    // boyas de las puertas
    gates.forEach((g, gi) => {
      for (let k = 0; k < 2; k++) {
        const s = k ? 1 : -1;
        const x = g.x + g.nx * s * g.half, z = g.z + g.nz * s * g.half;
        const y = sea.heightAt(x, z) - 0.25;
        O.position.set(x, y, z); O.rotation.set(Math.sin(t * 1.7 + gi + k) * 0.12, Math.atan2(g.tx, g.tz) + (s < 0 ? Math.PI : 0), Math.cos(t * 1.3 + gi) * 0.12);
        O.scale.setScalar(g.finish ? 2.0 : 1.7); O.updateMatrix();
        buoyI.setMatrixAt(gi * 2 + k, O.matrix);
        O.rotation.y += Math.sin(t * 6 + gi * 3 + k) * 0.25; O.updateMatrix();
        flagI.setMatrixAt(gi * 2 + k, O.matrix);
        flagI.setColorAt(gi * 2 + k, tmpC.set(g.state === 1 ? '#3ddc84' : g.state === 2 ? '#7a7a7a' : gi === nextGate ? '#ffd23f' : '#ff4f6d'));
      }
    });
    buoyI.instanceMatrix.needsUpdate = true; flagI.instanceMatrix.needsUpdate = true; if (flagI.instanceColor) flagI.instanceColor.needsUpdate = true;
    const ng = gates[nextGate];
    arrow.visible = !!ng;
    if (ng) { arrow.position.set(ng.x, 7 + Math.sin(t * 3) * 0.6, ng.z); arrow.rotation.y = t * 1.5; }
    // barcas que cruzan el canal
    for (const bt of boats) {
      const a = path.at(bt.s);
      const lat = Math.sin(gameT * bt.sp + bt.ph) * bt.amp, v = Math.cos(gameT * bt.sp + bt.ph);
      bt.x = a.x + a.nx * lat; bt.z = a.z + a.nz * lat;
      bt.yaw = Math.atan2(a.nx * Math.sign(v || 1), a.nz * Math.sign(v || 1));
      const g = bt.b.group;
      g.position.set(bt.x, sea.heightAt(bt.x, bt.z) - 0.05, bt.z);
      g.rotation.y += Math.atan2(Math.sin(bt.yaw - g.rotation.y), Math.cos(bt.yaw - g.rotation.y)) * 0.05;
      g.rotation.z = Math.sin(t * 1.4 + bt.ph) * 0.06; bt.b.pitch.rotation.x = Math.sin(t * 1.1 + bt.ph) * 0.05;
      bt.b.animate(t, 0, 0.8, 6);
      const d = Math.hypot(boatPos.x - bt.x, boatPos.z - bt.z);
      bt.owner.pose(d < 32 ? 'wave' : 'sit', t);
      if (d >= 32) { bt.owner.rig.armR.shoulder.rotation.x = -1.0; }
    }
    for (const an of anchored) {
      const g = an.b.group; g.position.y = sea.heightAt(an.x, an.z) - 0.05; g.rotation.z = Math.sin(t * 1.2 + an.x) * 0.07;
      an.b.animate(t, 0, 0, 0);
      const d = Math.hypot(boatPos.x - an.x, boatPos.z - an.z);
      an.owner.pose(d < 45 ? 'wave' : 'idle', t);
    }
    // mono: se rasca; si pasas cerca, salta y saluda
    {
      const d = Math.hypot(boatPos.x - monkeyRock.x, boatPos.z - monkeyRock.z);
      const m = monkey;
      if (d < 30) { m.group.position.y = monkeyRock.y + Math.abs(Math.sin(t * 7)) * 0.6; m.arms[0].rotation.z = 2.6 + Math.sin(t * 12) * 0.4; m.arms[1].rotation.z = -2.6 - Math.sin(t * 12) * 0.4; m.head.rotation.z = Math.sin(t * 6) * 0.2; }
      else { m.group.position.y = monkeyRock.y; m.arms[0].rotation.z = 2.4 + Math.sin(t * 5) * 0.3; m.arms[1].rotation.z = -0.3; m.head.rotation.z = Math.sin(t * 2) * 0.15; }
      m.group.rotation.y = Math.atan2(boatPos.x - monkeyRock.x, boatPos.z - monkeyRock.z) * (d < 60 ? 1 : 0) + (d < 60 ? 0 : monkeyRock.face);
    }
    // calas
    for (const c of calas) {
      if (c.turtles) for (const tu of c.turtles) {
        const a = gameT * tu.sp + tu.ph;
        const x = c.x + Math.cos(a) * tu.r, z = c.z + Math.sin(a) * tu.r;
        tu.group.position.set(x, sea.heightAt(x, z) - 0.12, z);
        tu.group.rotation.y = -a; // tangente
        tu.fl.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.5 * (i < 2 ? 1 : -1); });
      }
      if (c.lanterns) c.lanterns.forEach((l, i) => { l.position.y = 6.8 - Math.abs(i - 3) * 0.6 + Math.sin(t * 2 + i) * 0.15; l.rotation.y = t + i; });
      if (c.swing) c.swing.rotation.z = Math.sin(t * 1.6) * 0.4;
    }
    // gaviotas
    gulls.forEach((gu, i) => {
      const a = t * gu.sp + gu.ph;
      const x = gu.cx + Math.cos(a) * gu.r, z = gu.cz + Math.sin(a) * gu.r, y = gu.y + Math.sin(t * 0.7 + i) * 1.5;
      const yaw = -a, flap = Math.sin(t * 9 + i) * 0.5;
      O.position.set(x, y, z); O.scale.setScalar(1.4);
      O.rotation.set(0, yaw, 0.3); O.updateMatrix(); bodyI.setMatrixAt(i, O.matrix);
      O.rotation.set(0, yaw, 0.3 + flap); O.updateMatrix(); wingL.setMatrixAt(i, O.matrix);
      O.rotation.set(0, yaw + Math.PI, -0.3 - flap); O.updateMatrix(); wingR.setMatrixAt(i, O.matrix);
    });
    wingL.instanceMatrix.needsUpdate = wingR.instanceMatrix.needsUpdate = bodyI.instanceMatrix.needsUpdate = true;
    floats.forEach((f, i) => { O.position.set(f.x, sea.heightAt(f.x, f.z), f.z); O.rotation.set(0, 0, 0); O.scale.setScalar(1); O.updateMatrix(); floatI.setMatrixAt(i, O.matrix); });
    floatI.instanceMatrix.needsUpdate = true;
    nok.pose('wave', t);
  }

  return {
    path, L, gates, calas, obstacles, near, boats, anchored, rocks, monkeyRock, dock,
    mapTex, mapRect: { x0, z0, size }, update,
    dispose() { mapTex.dispose(); pg.trunk.dispose(); pg.crown.dispose(); },
  };
}
