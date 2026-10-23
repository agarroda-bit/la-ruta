// Tuk-tuk del jugador, tráfico con IA por carriles (se circula por la izquierda),
// estelas de neón y "horneado" de personajes quietos en una sola malla multimaterial.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { N, CELL, LANE, line } from './ciudad.js';
import { canvasTexture } from '../../core/util.js';

// ───────── personajes horneados ─────────
// Junta todas las piezas visibles por material: ~10 draw calls en vez de ~35.
export function bake(ch) {
  ch.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(ch.group.matrixWorld).invert();
  const byMat = new Map();
  ch.group.traverse((o) => {
    if (!o.isMesh) return;
    let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; }
    if (!v) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const mats = [], geos = [];
  for (const [m, list] of byMat) { mats.push(m); const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); geos.push(g); }
  const merged = mergeGeometries(geos, true);
  geos.forEach((g) => g.dispose());
  ch.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  const mesh = new THREE.Mesh(merged, mats);
  mesh.castShadow = false;
  return mesh;
}

// ───────── tuk-tuk del jugador ─────────
const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const NEON = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

function roofSignTexture(text, color) {
  return canvasTexture(256, 64, (g) => {
    g.fillStyle = '#12081f'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 12; g.strokeRect(6, 6, 244, 52);
    g.font = '34px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.shadowBlur = 16; g.fillText(text, 128, 34);
    g.fillStyle = '#fff'; g.shadowBlur = 4; g.fillText(text, 128, 34);
  });
}

export function buildTukTuk(ctx, blob) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body); // se inclina (balanceo) sin mover las ruedas
  const pink = M('#ff2e88'), dark = M('#1c1a2b'), chrome = M('#d8d8e8'), seatM = M('#2d1b4e'), cream = M('#ffe9c9');
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.BoxGeometry(1.5, 0.22, 2.9), dark, 0, 0.45, -0.1);           // chasis
  add(new THREE.BoxGeometry(1.0, 0.85, 0.75), pink, 0, 0.95, 1.25);          // morro
  add(new THREE.BoxGeometry(0.9, 0.12, 0.8), cream, 0, 1.42, 1.25);          // tapa del morro
  add(new THREE.BoxGeometry(1.6, 0.62, 1.35), pink, 0, 0.86, -0.7);          // caja trasera
  add(new THREE.BoxGeometry(1.62, 0.1, 1.37), cream, 0, 1.2, -0.7);          // ribete
  add(new THREE.BoxGeometry(0.6, 0.35, 0.7), seatM, 0, 0.75, 0.35);          // asiento conductor
  add(new THREE.BoxGeometry(1.45, 0.3, 0.6), seatM, 0, 1.0, -0.75);          // banco trasero
  add(new THREE.BoxGeometry(1.45, 0.38, 0.12), seatM, 0, 1.3, -1.32);        // respaldo bajo (se ve a los pasajeros)
  add(new THREE.BoxGeometry(0.5, 0.16, 0.04), M('#f4f4f4'), 0, 0.68, -1.42);   // matrícula
  const roof = add(new THREE.BoxGeometry(1.75, 0.14, 2.75), M('#3a2766'), 0, 2.2, -0.15);
  void roof;
  for (const [x, z] of [[-0.78, 1.0], [0.78, 1.0], [-0.78, -1.4], [0.78, -1.4]]) add(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5), chrome, x, 1.68, z);
  // parabrisas
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(0, 1.78, 1.12); glass.rotation.x = -0.2; body.add(glass);
  // tiras de neón del techo
  const cy = NEON('#00e5ff'), pk = NEON('#ff3fa4');
  add(new THREE.BoxGeometry(1.8, 0.06, 0.06), cy, 0, 2.12, 1.24);
  add(new THREE.BoxGeometry(1.8, 0.06, 0.06), cy, 0, 2.12, -1.53);
  add(new THREE.BoxGeometry(0.06, 0.06, 2.8), pk, 0.89, 2.12, -0.15);
  add(new THREE.BoxGeometry(0.06, 0.06, 2.8), pk, -0.89, 2.12, -0.15);
  add(new THREE.BoxGeometry(1.62, 0.05, 0.05), pk, 0, 0.6, -1.39);
  // faros
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), NEON('#fff6d8'), 0, 1.15, 1.64).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.12, 0.05), NEON('#ff2a3a'), s * 0.62, 0.86, -1.4);
  // cartel del techo LIBRE / OCUPADO
  const texFree = roofSignTexture('LIBRE', '#5dff9b'), texBusy = roofSignTexture('OCUPADO', '#ff3fa4');
  const signMat = new THREE.MeshBasicMaterial({ map: texFree, toneMapped: false });
  const sign = add(new THREE.BoxGeometry(1.1, 0.3, 0.08), [dark, dark, dark, dark, signMat, signMat], 0, 2.45, 0.6);
  sign.castShadow = false;
  // ruedas
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10); wheelGeo.rotateZ(Math.PI / 2);
  const wm = M('#151515');
  const front = new THREE.Group(); front.position.set(0, 0.32, 1.35); g.add(front);
  const wf = new THREE.Mesh(wheelGeo, wm); front.add(wf);
  const wl = new THREE.Mesh(wheelGeo, wm); wl.position.set(-0.75, 0.32, -0.95); g.add(wl);
  const wr = new THREE.Mesh(wheelGeo, wm); wr.position.set(0.75, 0.32, -0.95); g.add(wr);
  // luz de bajos y haz del faro (planos aditivos)
  const under = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), new THREE.MeshBasicMaterial({ map: blob, color: '#00e5ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.05; g.add(under);
  const beamGeo = new THREE.PlaneGeometry(4.5, 11); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0.06, 7);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ map: blob, color: '#fff1c0', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.add(beam);

  // conductor (horneado) y compi (con esqueleto: anima la cabeza y los brazos)
  const driver = ctx.makeCharacter(ctx.looks[0], { scale: 0.85 });
  driver.pose('ride');
  const dMesh = bake(driver); dMesh.position.set(0, 0.5, 0.42); dMesh.scale.setScalar(0.85); body.add(dMesh);
  const compi = ctx.makeCharacter(ctx.looks[1], { scale: 0.85 });
  compi.pose('sit');
  compi.group.position.set(-0.4, 0.73, -0.8); body.add(compi.group);
  compi.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const seats = [[0.42, 0.73, -0.8], [0.02, 0.76, -0.95]]; // huecos para turistas
  return {
    group: g, body, front, wheels: [wf, wl, wr], under, beam, compi,
    seats,
    setBusy(b) { signMat.map = b ? texBusy : texFree; signMat.needsUpdate = true; under.material.color.set(b ? '#ff3fa4' : '#00e5ff'); },
    dispose() { texFree.dispose(); texBusy.dispose(); },
  };
}

// ───────── estela de neón (cinta aditiva) ─────────
export class Trail {
  constructor(scene, color, n = 26, width = 0.22) {
    this.n = n; this.w = width; this.pts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.col = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false;
    this.color = new THREE.Color(color); this.on = 0;
    scene.add(this.mesh);
  }
  push(p, strength) {
    this.on += (strength - this.on) * 0.25;
    this.pts.unshift([p.x, p.y, p.z]);
    if (this.pts.length > this.n) this.pts.pop();
    const c = this.color;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)] || [p.x, p.y, p.z];
      const k = (1 - i / this.n) * this.on;
      this.pos.set([q[0], q[1] - this.w, q[2], q[0], q[1] + this.w, q[2]], i * 6);
      this.col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

// ───────── tráfico ─────────
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const valid = (i, j) => i >= 0 && j >= 0 && i <= N && j <= N;

function carGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); paint(g, c); parts.push(g); };
  box(1.9, 0.7, 4.2, 0, 0.62, 0, '#ffffff');          // carrocería (la tiñe el color de instancia)
  box(1.7, 0.6, 2.2, 0, 1.25, -0.2, '#2a3550');        // cabina/cristales
  box(1.72, 0.12, 2.0, 0, 1.6, -0.2, '#ffffff');        // techo
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) { const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 8).toNonIndexed(); g.rotateZ(Math.PI / 2); g.translate(x, 0.36, z); paint(g, '#111111'); parts.push(g); }
  return finish(parts);
}
function tukGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); paint(g, c); parts.push(g); };
  box(1.4, 0.2, 2.7, 0, 0.45, 0, '#222222');
  box(0.95, 0.8, 0.7, 0, 0.95, 1.1, '#ffffff');
  box(1.5, 0.6, 1.3, 0, 0.85, -0.65, '#ffffff');
  box(1.65, 0.14, 2.6, 0, 2.1, -0.1, '#ffffff');
  for (const [x, z] of [[-0.72, 0.95], [0.72, 0.95], [-0.72, -1.3], [0.72, -1.3]]) box(0.06, 1.0, 0.06, x, 1.6, z, '#cccccc');
  box(0.5, 0.6, 0.4, 0, 1.4, 0.4, '#e0ac7e'); // conductor (silueta)
  box(0.36, 0.36, 0.36, 0, 1.85, 0.4, '#e0ac7e');
  for (const [x, z] of [[0, 1.25], [-0.72, -0.9], [0.72, -0.9]]) { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8).toNonIndexed(); g.rotateZ(Math.PI / 2); g.translate(x, 0.3, z); paint(g, '#111111'); parts.push(g); }
  return finish(parts);
}
function lightsGeometry(len, w, h) {
  const parts = [];
  const box = (bw, bh, bd, x, y, z, c) => { const g = new THREE.BoxGeometry(bw, bh, bd).toNonIndexed(); g.translate(x, y, z); paint(g, c); parts.push(g); };
  for (const s of [-1, 1]) { box(0.36, 0.16, 0.06, s * w * 0.32, h, len / 2 + 0.02, '#fff4d0'); box(0.36, 0.14, 0.06, s * w * 0.32, h, -len / 2 - 0.02, '#ff2030'); }
  return finish(parts);
}
function paint(g, c) { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); }
function finish(parts) { const g = mergeGeometries(parts, false); parts.forEach((p) => p.dispose()); return g; }

export function createTraffic(scene, rng, blob, count, avoid = null) {
  const types = [
    { geo: carGeometry(), lights: lightsGeometry(4.2, 1.9, 0.75), len: 4.2, r: 1.15, colors: ['#ff4fa3', '#ff4fa3', '#7ddc3a', '#f1f1f1', '#c0c4d0', '#e63946', '#3a86ff', '#ffd166'], speed: [10, 13], n: Math.round(count * 0.65) },
    { geo: tukGeometry(), lights: lightsGeometry(2.7, 1.4, 0.9), len: 2.8, r: 0.95, colors: ['#00c2d1', '#ffb703', '#8ac926', '#7b5cff', '#ff6f61'], speed: [9, 12], n: Math.round(count * 0.35) },
  ];
  const beamGeo = new THREE.PlaneGeometry(3.6, 8); beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ map: blob, color: '#fff0c0', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const cars = [];
  const meshes = [];
  for (const t of types) {
    t.body = new THREE.InstancedMesh(t.geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), t.n);
    t.light = new THREE.InstancedMesh(t.lights, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), t.n);
    t.beam = new THREE.InstancedMesh(beamGeo, beamMat, t.n);
    t.body.castShadow = true;
    for (const m of [t.body, t.light, t.beam]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); meshes.push(m); }
    for (let k = 0; k < t.n; k++) {
      t.body.setColorAt(k, new THREE.Color(t.colors[Math.floor(rng() * t.colors.length)]));
      let i, j;
      do { i = Math.floor(rng() * (N + 1)); j = Math.floor(rng() * (N + 1)); } while (avoid && Math.hypot(line(i) - avoid.x, line(j) - avoid.z) < avoid.r);
      const c = { t, k, x: 0, z: 0, yaw: 0, speed: 0, max: t.speed[0] + rng() * (t.speed[1] - t.speed[0]), stun: 0, wait: 0, ghost: 0, honk: 0 };
      // primer tramo
      let d;
      do { d = DIRS[Math.floor(rng() * 4)]; } while (!valid(i + d[0], j + d[1]));
      startEdge(c, i, j, d, rng() * 0.8);
      const pc = c.piece, tt = c.s / pc.len;
      c.x = pc.ax + (pc.bx - pc.ax) * tt; c.z = pc.az + (pc.bz - pc.az) * tt; c.yaw = Math.atan2(d[0], d[1]);
      cars.push(c);
    }
  }
  const tmp = new THREE.Object3D();

  function laneOff(d) { return [d[1] * LANE, -d[0] * LANE]; } // izquierda = (dz, -dx)
  function startEdge(c, i, j, d, t0 = 0) {
    const [lx, lz] = laneOff(d);
    const ax = line(i) + d[0] * 9 + lx, az = line(j) + d[1] * 9 + lz;
    const bx = line(i + d[0]) - d[0] * 9 + lx, bz = line(j + d[1]) - d[1] * 9 + lz;
    c.node = [i + d[0], j + d[1]]; c.dir = d;
    c.piece = { kind: 'line', ax, az, bx, bz, len: Math.hypot(bx - ax, bz - az) };
    c.s = t0 * c.piece.len;
  }
  function startTurn(c, rnd) {
    const [i, j] = c.node, d = c.dir;
    const opts = DIRS.filter((e) => !(e[0] === -d[0] && e[1] === -d[1]) && valid(i + e[0], j + e[1]));
    const straight = opts.find((e) => e[0] === d[0] && e[1] === d[1]);
    const d2 = straight && rnd() < 0.45 ? straight : opts[Math.floor(rnd() * opts.length)];
    const [lx, lz] = laneOff(d), [lx2, lz2] = laneOff(d2);
    const p0 = [line(i) - d[0] * 9 + lx, line(j) - d[1] * 9 + lz];
    const p2 = [line(i) + d2[0] * 9 + lx2, line(j) + d2[1] * 9 + lz2];
    const p1 = d2 === straight ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [line(i) + lx + lx2, line(j) + lz + lz2];
    let len = 0, prev = p0;
    for (let q = 1; q <= 8; q++) { const p = bez(p0, p1, p2, q / 8); len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    c.piece = { kind: 'curve', p0, p1, p2, len, next: d2 };
    c.s = 0;
  }
  const bez = (a, b, c, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; };
  function posOf(c) {
    const p = c.piece, t = Math.min(1, c.s / p.len);
    if (p.kind === 'line') return [p.ax + (p.bx - p.ax) * t, p.az + (p.bz - p.az) * t];
    return bez(p.p0, p.p1, p.p2, t);
  }

  return {
    cars, meshes,
    // player = { x, z, vx, vz } · onHit(car, nx, nz, impact) se llama al chocar
    update(dt, player, rnd, onHit, onNear) {
      for (const c of cars) {
        if (c.stun > 0) c.stun -= dt;
        // ¿algo delante?
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        let block = false;
        const check = (ox, oz, r) => {
          const dx = ox - c.x, dz = oz - c.z, ahead = dx * fx + dz * fz;
          if (ahead > 0.5 && ahead < 6 + c.speed * 0.35) { const side = Math.abs(dx * fz - dz * fx); if (side < r) return true; }
          return false;
        };
        if (check(player.x, player.z, 2.3)) { block = true; if (c.honk <= 0 && player.speed < 3) { c.honk = 3 + Math.random() * 3; c.honked = true; } }
        if (c.ghost <= 0) for (const o of cars) { if (o !== c && check(o.x, o.z, 1.8)) { block = true; break; } }
        c.honk -= dt;
        c.wait = block ? c.wait + dt : 0;
        if (c.wait > 2.5) { c.ghost = 1.2; c.wait = 0; }
        if (c.ghost > 0) c.ghost -= dt;
        const target = c.stun > 0 || (block && c.ghost <= 0) ? 0 : c.max * (c.piece.kind === 'curve' ? 0.6 : 1);
        c.speed += (target - c.speed) * Math.min(1, dt * (target < c.speed ? 6 : 1.5));
        c.s += c.speed * dt;
        if (c.s >= c.piece.len) {
          const over = c.s - c.piece.len;
          if (c.piece.kind === 'line') startTurn(c, rnd);
          else startEdge(c, c.node[0], c.node[1], c.piece.next, 0);
          c.s = Math.min(over, c.piece.len * 0.9);
        }
        const [x, z] = posOf(c);
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz > 1e-6) { const ty = Math.atan2(dx, dz); let dd = ty - c.yaw; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2; c.yaw += dd * Math.min(1, dt * 12); }
        c.x = x; c.z = z;
        // choque con el jugador: dos círculos a lo largo del coche
        const half = c.t.len * 0.3;
        for (const s of [-half, half]) {
          const cx = c.x + Math.sin(c.yaw) * s, cz = c.z + Math.cos(c.yaw) * s;
          const ex = player.x - cx, ez = player.z - cz, dist = Math.hypot(ex, ez), min = c.t.r + 1.25;
          if (dist < min && dist > 0.001) { const nx = ex / dist, nz = ez / dist; onHit(c, nx, nz, min - dist); break; }
          else if (dist < min + 1.6 && player.speed > 14 && !c.nearT) { c.nearT = 1.5; onNear && onNear(c); }
        }
        if (c.nearT) { c.nearT -= dt; if (c.nearT <= 0) c.nearT = 0; }
        tmp.position.set(c.x, 0, c.z); tmp.rotation.set(0, c.yaw, 0); tmp.updateMatrix();
        c.t.body.setMatrixAt(c.k, tmp.matrix); c.t.light.setMatrixAt(c.k, tmp.matrix);
        tmp.position.set(c.x + Math.sin(c.yaw) * (c.t.len / 2 + 4), 0.05, c.z + Math.cos(c.yaw) * (c.t.len / 2 + 4)); tmp.updateMatrix();
        c.t.beam.setMatrixAt(c.k, tmp.matrix);
      }
      for (const t of types) { t.body.instanceMatrix.needsUpdate = true; t.light.instanceMatrix.needsUpdate = true; t.beam.instanceMatrix.needsUpdate = true; }
    },
  };
}
