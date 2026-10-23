// Motor: renderer de Three.js, bucle, calidad automática, modo ahorro y "jugo"
// (temblor de cámara, cámara lenta, partículas).
import * as THREE from 'three';
import { input } from './input.js';
import { save } from './save.js';

const QUALITY = {
  baja: { pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, particles: 0.4, drawDistance: 0.6 },
  media: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: false, particles: 0.7, drawDistance: 0.8 },
  alta: { pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true, particles: 1, drawDistance: 1 },
};

class Engine {
  constructor() {
    this.scene = null; this.camera = null; this.controller = null;
    this.timeScale = 1; this._slowT = 0; this._slowScale = 1;
    this.shakeAmt = 0; this.paused = false;
    this.fps = 60; this._fpsAcc = 0; this._fpsN = 0; this._fpsHist = [];
    this.elapsed = 0;
    this.onFrame = new Set();
  }

  init(container) {
    const s = save.data.settings;
    const isMobile = matchMedia('(pointer: coarse)').matches;
    this.qualityName = s.quality === 'auto' ? (isMobile ? 'media' : 'alta') : s.quality;
    this.auto = s.quality === 'auto';
    this.renderer = new THREE.WebGLRenderer({ antialias: QUALITY[this.qualityName].antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.applyQuality();
    addEventListener('resize', () => this.resize());
    this.resize();
    this._last = performance.now();
    this._lastRender = 0;
    const loop = (t) => { requestAnimationFrame(loop); this._frame(t); };
    requestAnimationFrame(loop);
  }

  get q() { return QUALITY[this.qualityName]; }
  get battery() { return !!save.data.settings.battery; }

  applyQuality() {
    const q = this.q;
    const pr = Math.min(devicePixelRatio || 1, this.battery ? 1 : q.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q.shadows && !this.battery;
    this.resize();
    if (this.scene) this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  setQuality(name) {
    save.data.settings.quality = name; save.touch();
    this.auto = name === 'auto';
    if (name !== 'auto') this.qualityName = name;
    this.applyQuality();
  }

  resize() {
    if (!this.renderer) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    if (this.camera && this.camera.isPerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.controller && this.controller.resize) this.controller.resize(w, h);
  }

  // controller = { scene, camera, update(dt, t), render?(renderer), resize?(w,h) }
  setController(c) {
    this.controller = c;
    this.scene = c ? c.scene : null;
    this.camera = c ? c.camera : null;
    this.timeScale = 1; this._slowT = 0; this.shakeAmt = 0;
    this._fpsHist = [];
    this.resize();
  }

  // Cámara lenta durante "secs" (tiempo real) a escala "scale"
  slowmo(secs = 1, scale = 0.25) { this._slowT = secs; this._slowScale = scale; }
  shake(amount = 0.3) { this.shakeAmt = Math.min(1.5, this.shakeAmt + amount); }

  _frame(now) {
    let realDt = (now - this._last) / 1000;
    // modo ahorro: 30 fps
    if (this.battery && realDt < 1 / 31) return;
    this._last = now;
    realDt = Math.max(0, Math.min(realDt, 0.1));
    this._measure(realDt);
    input.update();
    if (this._slowT > 0) { this._slowT -= realDt; this.timeScale = this._slowScale; } else this.timeScale = 1;
    const dt = this.paused ? 0 : Math.min(realDt, 1 / 20) * this.timeScale;
    this.elapsed += dt;
    const c = this.controller;
    if (c && !this.paused) c.update(dt, realDt);
    for (const f of this.onFrame) f(dt, realDt);
    if (c && c.scene && c.camera) {
      // temblor de cámara aplicado solo durante el render
      let ox = 0, oy = 0;
      if (this.shakeAmt > 0.001 && !this.paused) {
        ox = (Math.random() - 0.5) * this.shakeAmt * 0.6; oy = (Math.random() - 0.5) * this.shakeAmt * 0.6;
        c.camera.position.x += ox; c.camera.position.y += oy;
        this.shakeAmt *= Math.exp(-realDt * 8);
      }
      if (c.render) c.render(this.renderer, realDt); else this.renderer.render(c.scene, c.camera);
      if (this._snap) { const f = this._snap; this._snap = null; f(this.canvas); }
      c.camera.position.x -= ox; c.camera.position.y -= oy;
    }
    input.endFrame();
  }

  // Llama a fn(canvas) justo después del siguiente render (para fotos: el buffer aún es válido)
  snapshot() { return new Promise((r) => { this._snap = r; }); }

  _measure(dt) {
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsN / this._fpsAcc;
      this._fpsAcc = 0; this._fpsN = 0;
      if (this.controller && !this.paused) {
        this._fpsHist.push(this.fps);
        // calidad automática: tras unos segundos de juego, si va lento, bajamos un escalón
        if (this.auto && !this.battery && this._fpsHist.length >= 6) {
          const avg = this._fpsHist.slice(-6).reduce((a, b) => a + b, 0) / 6;
          if (avg < 40 && this.qualityName !== 'baja') {
            this.qualityName = this.qualityName === 'alta' ? 'media' : 'baja';
            this.applyQuality(); this._fpsHist = [];
          } else if (avg > 58 && this.qualityName === 'baja' && this._fpsHist.length > 30) {
            this.qualityName = 'media'; this.applyQuality(); this._fpsHist = [];
          }
        }
      }
    }
  }
}

export const engine = new Engine();

// ───────── partículas ─────────
// Sistema de partículas con un único THREE.Points por escena (barato en móvil).
export class Particles {
  constructor(scene, max = 600, { size = 0.35, additive = false, texture = null } = {}) {
    max = Math.round(max * (engine.q ? engine.q.particles : 1));
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.grav = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: innerHeight / 2 } },
      vertexShader: 'attribute float size; varying vec3 vC; varying float vS; uniform float scale; void main(){ vC = color; vS = size; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vS; void main(){ if (vS <= 0.0) discard; vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.2, d); gl_FragColor = vec4(vC, a); }',
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.baseSize = size;
    this.i = 0;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  // emit(n, posición, {spread, vel, velSpread, color, colors, life, size, gravity})
  emit(n, p, o = {}) {
    n = Math.max(1, Math.round(n * (engine.q ? engine.q.particles : 1)));
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      const sp = o.spread ?? 0.3, vs = o.velSpread ?? 2;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * sp;
      const v = o.vel || { x: 0, y: 2, z: 0 };
      this.vel[i * 3] = v.x + (Math.random() - 0.5) * vs;
      this.vel[i * 3 + 1] = v.y + (Math.random() - 0.5) * vs;
      this.vel[i * 3 + 2] = v.z + (Math.random() - 0.5) * vs;
      const col = o.colors ? o.colors[Math.floor(Math.random() * o.colors.length)] : (o.color || '#ffffff');
      this._c.set(col);
      this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
      this.maxLife[i] = this.life[i] = (o.life ?? 0.8) * (0.7 + Math.random() * 0.6);
      this.size[i] = (o.size ?? this.baseSize) * (0.6 + Math.random() * 0.8);
      this.grav[i] = o.gravity ?? -6;
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.size[i] = 0;
      else if (this.life[i] < this.maxLife[i] * 0.3) this.size[i] *= 0.92;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.mat.uniforms.scale.value = innerHeight / 2;
  }
  dispose() { this.points.parent && this.points.parent.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}
