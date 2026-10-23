// Carretera a partir de una curva: malla del asfalto con líneas, arcenes, y consultas
// rápidas de "¿dónde estoy en la carretera?" (distancia recorrida y desvío lateral).
// Uso:
//   const road = new Road(points, { width: 8 });   points = [Vector3...] (curva cerrada o abierta)
//   scene.add(road.mesh);
//   const q = road.locate(pos, q.i)   → { s (m recorridos), lateral (m, + = derecha), i (índice), t: tangente }
//   road.at(s) → { p: Vector3, t: tangente, n: normal derecha }
import * as THREE from 'three';
import { canvasTexture } from './util.js';

export class Road {
  constructor(points, { width = 8, closed = false, step = 2, color = '#3b3b48', line = '#ffffff', edge = '#ffd166', shoulder = 1.2, shoulderColor = '#c9b28a', texture = null } = {}) {
    this.width = width; this.closed = closed;
    this.curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
    this.length = this.curve.getLength();
    const n = Math.max(8, Math.round(this.length / step));
    this.n = n;
    this.pts = []; this.tans = []; this.nors = []; this.dist = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = this.curve.getPointAt(closed ? u % 1 : u);
      const t = this.curve.getTangentAt(closed ? u % 1 : Math.min(u, 0.9999)).normalize();
      const nr = new THREE.Vector3().crossVectors(t, up).normalize(); // derecha
      this.pts.push(p); this.tans.push(t); this.nors.push(nr); this.dist.push(u * this.length);
    }
    this.mesh = this._build(color, line, edge, shoulder, shoulderColor, texture);
  }

  _build(color, line, edge, shoulder, shoulderColor, texture) {
    const g = new THREE.Group();
    const w = this.width / 2;
    const tex = texture || canvasTexture(64, 128, (c, W, H) => {
      c.fillStyle = color; c.fillRect(0, 0, W, H);
      // grano del asfalto
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; c.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
      c.fillStyle = edge; c.fillRect(1, 0, 3, H); c.fillRect(W - 4, 0, 3, H);
      c.fillStyle = line; c.fillRect(W / 2 - 1.5, 0, 3, H * 0.5);
    }, { repeat: null });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const strip = (offA, offB, y, mat, vScale) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= this.n; i++) {
        const p = this.pts[i], nr = this.nors[i];
        pos.push(p.x + nr.x * offA, p.y + y, p.z + nr.z * offA, p.x + nr.x * offB, p.y + y, p.z + nr.z * offB);
        const v = this.dist[i] / vScale;
        uv.push(0, v, 1, v);
        if (i < this.n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
      return m;
    };
    const asphalt = strip(-w, w, 0.02, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 8);
    g.add(asphalt);
    if (shoulder > 0) {
      const sm = new THREE.MeshStandardMaterial({ color: shoulderColor, roughness: 1, flatShading: true });
      g.add(strip(-w - shoulder, -w, 0.01, sm, 8), strip(w, w + shoulder, 0.01, sm, 8));
    }
    this.asphalt = asphalt;
    return g;
  }

  at(s) {
    const L = this.length;
    if (this.closed) s = ((s % L) + L) % L; else s = Math.max(0, Math.min(L, s));
    const f = (s / L) * this.n, i = Math.min(this.n - 1, Math.floor(f)), k = f - i;
    return {
      p: this.pts[i].clone().lerp(this.pts[i + 1], k),
      t: this.tans[i].clone().lerp(this.tans[i + 1], k).normalize(),
      n: this.nors[i].clone().lerp(this.nors[i + 1], k).normalize(),
      i,
    };
  }

  // Busca el punto más cercano partiendo de una pista (búsqueda local, barata)
  locate(pos, hint = -1) {
    let best = 0, bd = Infinity;
    if (hint < 0) {
      for (let i = 0; i <= this.n; i += 1) { const d = (this.pts[i].x - pos.x) ** 2 + (this.pts[i].z - pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
    } else {
      for (let o = -12; o <= 12; o++) {
        let i = hint + o;
        if (this.closed) i = ((i % this.n) + this.n) % this.n; else if (i < 0 || i > this.n) continue;
        const d = (this.pts[i].x - pos.x) ** 2 + (this.pts[i].z - pos.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    // proyección sobre el segmento
    const i = Math.min(best, this.n - 1);
    const a = this.pts[i], b = this.pts[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    const px = a.x + abx * k, pz = a.z + abz * k;
    const nr = this.nors[i];
    const lateral = (pos.x - px) * nr.x + (pos.z - pz) * nr.z;
    return { i: best, s: this.dist[i] + (this.dist[i + 1] - this.dist[i]) * k, lateral, t: this.tans[i], n: nr, y: a.y + (b.y - a.y) * k };
  }
}
