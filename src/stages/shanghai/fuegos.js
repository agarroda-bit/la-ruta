// Fuegos artificiales calculados en la GPU: cada chispa guarda dónde y cuándo nació y su
// velocidad; el shader calcula su posición (con rozamiento y gravedad) y la estela.
// La CPU solo escribe al lanzar: cero coste por fotograma aunque haya miles de chispas.
import * as THREE from 'three';

const TRAIL_DT = 0.035;
const PALETA = ['#ff4fa3', '#4cc9f0', '#ffd166', '#ffffff', '#b388ff', '#7cff6b', '#ff7b3a', '#ff2d55'];

const VS = `
uniform float uTime; uniform float uScale; uniform float uMirror;
attribute vec3 aP0; attribute vec3 aV0; attribute vec4 aT; attribute vec3 aCol; attribute vec3 aMisc;
varying vec3 vC; varying float vA;
void main(){
  float j = aMisc.y;
  float age = uTime - aT.x - j * ${TRAIL_DT.toFixed(3)};
  float life = aT.y;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = vec3(0.0); return; }
  float k = aT.z;
  float e = exp(-k * age);
  vec3 gk = vec3(0.0, -aT.w / k, 0.0);
  vec3 p = aP0 + (aV0 - gk) * (1.0 - e) / k + gk * age;
  if (uMirror > 0.5) p.y = -p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float f = age / life;
  float tr = 1.0 - j / 8.0;
  float st = aMisc.z > 0.5 ? step(0.45, fract(sin(dot(aV0.xy, vec2(12.9898, 78.233)) + floor(uTime * 22.0)) * 43758.5453)) : 1.0;
  vA = (1.0 - f * f) * tr * st * (uMirror > 0.5 ? 0.32 : 1.0);
  vC = aCol * (1.0 + (1.0 - f) * 1.4 * tr);
  gl_PointSize = aMisc.x * uScale / max(1.0, -mv.z) * (1.0 - j * 0.1);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec3 vC; varying float vA;
void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5 || vA <= 0.0) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC, a * a * vA); }`;

const raw = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

export class Fireworks {
  constructor(scene, { quality = 1, max = 16000, onBurst = null } = {}) {
    const n = this.max = Math.max(4000, Math.round(max * quality));
    this.q = Math.max(0.45, quality);
    this.onBurst = onBurst;
    this.aP0 = new Float32Array(n * 3); this.aV0 = new Float32Array(n * 3); this.aT = new Float32Array(n * 4);
    this.aCol = new Float32Array(n * 3); this.aMisc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.aT[i * 4] = -1e6; this.aT[i * 4 + 1] = 0.001; this.aT[i * 4 + 2] = 1; }
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.attrs = {
      aP0: new THREE.BufferAttribute(this.aP0, 3), aV0: new THREE.BufferAttribute(this.aV0, 3), aT: new THREE.BufferAttribute(this.aT, 4),
      aCol: new THREE.BufferAttribute(this.aCol, 3), aMisc: new THREE.BufferAttribute(this.aMisc, 3),
    };
    for (const [k, a] of Object.entries(this.attrs)) { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
    const mk = (mirror) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.uTime || (this.uTime = { value: 0 }), uScale: this.uScale || (this.uScale = { value: 400 }), uMirror: { value: mirror } },
      vertexShader: VS, fragmentShader: FS,
    });
    this.points = new THREE.Points(geo, mk(0)); this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.mirror = new THREE.Points(geo, mk(1)); this.mirror.frustumCulled = false; this.mirror.renderOrder = 1;
    scene.add(this.points, this.mirror);
    this.time = 0; this.i = 0; this.events = []; this.dFrom = Infinity; this.dTo = -1;
    this.show = null; this.acc = 0;
    this._v = new THREE.Vector3(); this._c = new THREE.Color();
    this.launched = 0;
  }

  _w(p, v, life, drag, grav, col, size, j, strobe = 0, delay = 0) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.aP0[i * 3] = p.x; this.aP0[i * 3 + 1] = p.y; this.aP0[i * 3 + 2] = p.z;
    this.aV0[i * 3] = v.x; this.aV0[i * 3 + 1] = v.y; this.aV0[i * 3 + 2] = v.z;
    this.aT[i * 4] = this.time + delay; this.aT[i * 4 + 1] = life; this.aT[i * 4 + 2] = drag; this.aT[i * 4 + 3] = grav;
    this.aCol[i * 3] = col.r; this.aCol[i * 3 + 1] = col.g; this.aCol[i * 3 + 2] = col.b;
    this.aMisc[i * 3] = size; this.aMisc[i * 3 + 1] = j; this.aMisc[i * 3 + 2] = strobe;
    if (i < this.dFrom) this.dFrom = i; if (i > this.dTo) this.dTo = i;
  }
  _spark(p, v, life, drag, grav, col, size, trail, strobe = 0, delay = 0) {
    for (let j = 0; j < trail; j++) this._w(p, v, life + j * TRAIL_DT, drag, grav, col, size, j, strobe, delay);
  }

  static posAt(out, p, v, k, g, t) {
    const e = Math.exp(-k * t), f = (1 - e) / k, gk = -g / k;
    out.set(p.x + v.x * f, p.y + (v.y - gk) * f + gk * t, p.z + v.z * f);
    return out;
  }

  // Cohete que sube desde "from" y explota en "apex" tras tUp segundos
  rocket(from, apex, tUp = 1.3, opts = {}) {
    const k = 0.5, g = 16, e = Math.exp(-k * tUp), f = (1 - e) / k, gk = -g / k;
    const v = new THREE.Vector3((apex.x - from.x) / f, (apex.y - from.y - gk * tUp) / f + gk, (apex.z - from.z) / f);
    this._spark(from, v, tUp, k, g, raw('#ffd9a0'), 3.2, 8);
    this.launched++;
    const at = apex.clone();
    this.events.push({ t: this.time + tUp, fn: () => this.burst(at, opts) });
  }

  burst(p, { type, colors, scale = 1 } = {}) {
    const R = Math.random;
    type ||= ['peonia', 'peonia', 'anillo', 'sauce', 'palmera', 'crepitante', 'doble'][Math.floor(R() * 7)];
    const cs = (colors || [PALETA[Math.floor(R() * PALETA.length)], PALETA[Math.floor(R() * PALETA.length)]]).map(raw);
    const q = this.q, v = this._v;
    // destello central
    this._w(p, v.set(0, 0, 0), 0.22, 1, 0, raw('#4a4030'), 46 * scale, 0);
    const sphere = (n, speed, life, drag, grav, size, trail, colFn, strobe = 0) => {
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996 + R() * 0.3;
        const s = speed * (0.9 + R() * 0.2) * scale;
        v.set(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s);
        this._spark(p, v, life * (0.85 + R() * 0.3), drag, grav, colFn(i), size, trail, strobe);
      }
    };
    if (type === 'peonia') {
      sphere(Math.round(110 * q), 62, 2.0, 1.25, 14, 4.6, 5, (i) => cs[i % 2 ? 0 : 1]);
    } else if (type === 'doble') {
      sphere(Math.round(90 * q), 66, 2.0, 1.25, 14, 4.4, 5, () => cs[0]);
      sphere(Math.round(50 * q), 30, 1.7, 1.25, 12, 4.2, 4, () => cs[1]);
    } else if (type === 'anillo') {
      const ax = new THREE.Vector3(R() - 0.5, 1.5, R() - 0.5).normalize();
      const u = new THREE.Vector3(1, 0, 0).cross(ax).normalize(), w = ax.clone().cross(u);
      const n = Math.round(70 * q);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, s = 64 * scale;
        v.copy(u).multiplyScalar(Math.cos(a) * s).addScaledVector(w, Math.sin(a) * s);
        this._spark(p, v, 1.9, 1.3, 10, cs[0], 4.8, 5);
      }
      sphere(Math.round(30 * q), 20, 1.4, 1.2, 10, 4, 3, () => cs[1]);
    } else if (type === 'sauce') {
      const gold = raw('#ffc45e');
      sphere(Math.round(90 * q), 48, 3.6, 1.9, 18, 3.8, 7, () => gold, 0);
    } else if (type === 'palmera') {
      const arms = 8, gold = raw('#ffd27a');
      for (let a = 0; a < arms; a++) {
        const th = (a / arms) * Math.PI * 2 + R() * 0.3, ph = 0.35 + R() * 0.5;
        const dir = new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
        for (let k = 0; k < Math.round(8 * q + 2); k++) {
          v.copy(dir).multiplyScalar((30 + k * 6) * scale).add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(4));
          this._spark(p, v, 2.6, 1.4, 15, k % 3 ? gold : cs[0], 5, 6);
        }
      }
    } else if (type === 'crepitante') {
      sphere(Math.round(60 * q), 52, 1.4, 1.3, 12, 4, 4, () => raw('#fff1c0'));
      // segunda explosión: chispas blancas que parpadean donde acabó cada brazo
      const kids = Math.round(14 * q), tmp = new THREE.Vector3(), base = p.clone();
      for (let c = 0; c < kids; c++) {
        const y = R() * 2 - 1, r = Math.sqrt(1 - y * y), a = R() * Math.PI * 2, s = 52 * scale;
        const v0 = new THREE.Vector3(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s);
        const t = 1.0 + R() * 0.3;
        Fireworks.posAt(tmp, base, v0, 1.3, 12, t);
        const at = tmp.clone();
        this.events.push({ t: this.time + t, fn: () => {
          for (let i = 0; i < Math.round(9 * q + 2); i++) {
            v.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(14 * scale);
            this._spark(at, v, 0.9, 2, 8, raw('#ffffff'), 3.4, 2, 1);
          }
          if (this.onBurst && c % 5 === 0) this.onBurst(at, 0.3);
        } });
      }
    }
    if (this.onBurst) this.onBurst(p, scale, cs[0]);
  }

  // Programa automático: rate cohetes por segundo sobre la zona indicada
  setShow(show) { this.show = show; this.acc = 0; }

  launchRandom(s = this.show) {
    const R = Math.random;
    const from = new THREE.Vector3(s.x + (R() - 0.5) * s.w, 0, s.z + (R() - 0.5) * s.d);
    const apex = new THREE.Vector3(from.x + (R() - 0.5) * 30, s.minH + R() * (s.maxH - s.minH), from.z + (R() - 0.5) * 30);
    this.rocket(from, apex, 1.1 + R() * 0.6, { scale: s.scale || 1 });
  }

  salvo(n = 5, s = this.show) { for (let i = 0; i < n; i++) this.launchRandom(s); }

  update(dt, scalePx) {
    this.time += dt;
    this.uTime.value = this.time;
    if (scalePx) this.uScale.value = scalePx;
    if (this.events.length) {
      const due = this.events.filter((e) => e.t <= this.time);
      if (due.length) { this.events = this.events.filter((e) => e.t > this.time); for (const e of due) e.fn(); }
    }
    if (this.show && this.show.rate > 0) {
      this.acc += dt * this.show.rate;
      while (this.acc >= 1) { this.acc -= 1; this.launchRandom(); }
    }
    if (this.dTo >= 0) {
      const from = this.dFrom, count = this.dTo - from + 1;
      for (const a of Object.values(this.attrs)) {
        a.clearUpdateRanges(); a.addUpdateRange(from * a.itemSize, count * a.itemSize); a.needsUpdate = true;
      }
      this.dFrom = Infinity; this.dTo = -1;
    }
  }

  dispose() {
    this.geo.dispose(); this.points.material.dispose(); this.mirror.material.dispose();
    this.points.parent && this.points.parent.remove(this.points); this.mirror.parent && this.mirror.parent.remove(this.mirror);
  }
}
