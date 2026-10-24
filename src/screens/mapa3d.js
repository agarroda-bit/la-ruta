// Mapa ilustrado 3D de Tailandia y el sur de China con la ruta del viaje.
// Sirve de portada (el avión cruza y la ruta se dibuja sola) y de pantalla principal.
import * as THREE from 'three';
import { flat, glow, makeSky, damp, clamp, easeInOut, lerp } from '../core/util.js';

// lon/lat → mundo (1 grado = 1 unidad; el norte es -Z)
const LON0 = 108.5, LAT0 = 18.5;
export const geo = (lon, lat, y = 0) => new THREE.Vector3(lon - LON0, y, -(lat - LAT0));

// Contornos simplificados a mano (lon, lat)
const MAINLAND = [
  [93.6, 34.5], [120.6, 34.5], [120.3, 33.6], [120.9, 32.6], [121.9, 31.7], [121.9, 30.9], [121.5, 30.2], [122.1, 29.8], [121.4, 28.5],
  [120.6, 27.5], [119.6, 26.1], [119.4, 25.4], [118.5, 24.5], [117.5, 23.7], [116.5, 23.0], [115.4, 22.7], [114.3, 22.3], [113.6, 22.1],
  [112.9, 21.8], [111.7, 21.5], [110.6, 21.2], [110.2, 20.3], [109.7, 21.5], [108.5, 21.6], [107.5, 21.3], [106.7, 20.7], [106.1, 19.8],
  [105.7, 18.8], [106.5, 17.5], [107.2, 16.6], [108.2, 16.1], [108.9, 15.2], [109.2, 13.8], [109.2, 12.3], [109.0, 11.4], [108.0, 10.8],
  [106.8, 10.4], [106.4, 9.5], [105.2, 8.6], [104.8, 9.5], [104.9, 10.4], [104.4, 10.4], [103.5, 10.6], [103.1, 11.3], [102.6, 12.1],
  [102.0, 12.4], [101.4, 12.7], [100.9, 12.7], [100.95, 13.4], [100.5, 13.5], [100.0, 13.4], [99.95, 12.6], [99.6, 11.5], [99.2, 10.4],
  [99.3, 9.5], [99.9, 9.2], [100.3, 8.4], [100.6, 7.2], [101.3, 6.9], [102.1, 6.2], [102.9, 5.6], [103.4, 4.8], [103.5, 3.0],
  [100.7, 3.0], [100.6, 4.0], [100.4, 5.2], [100.2, 6.4], [99.7, 6.9], [99.3, 7.4], [98.7, 8.2], [98.3, 8.9], [98.5, 9.9],
  [98.6, 10.8], [98.7, 12.0], [98.2, 13.2], [97.7, 15.2], [97.4, 16.6], [96.4, 16.8], [95.4, 15.8], [94.4, 16.2], [94.2, 18.0], [93.6, 19.5],
];
const ISLANDS = [
  [[98.28, 8.12], [98.42, 8.05], [98.43, 7.82], [98.33, 7.75], [98.26, 7.9]], // Phuket
  [[99.95, 9.58], [100.1, 9.6], [100.12, 9.45], [99.98, 9.42]], // Koh Samui
  [[108.6, 19.2], [109.5, 18.2], [110.5, 18.6], [111.0, 19.7], [110.5, 20.1], [109.6, 20.0], [108.7, 19.7]], // Hainan
  [[120.1, 23.0], [120.7, 22.0], [121.0, 22.6], [121.9, 24.5], [121.5, 25.3], [120.7, 24.5], [120.2, 23.6]], // Taiwán
  [[119.8, 16.0], [120.5, 18.6], [122.3, 18.4], [122.2, 16.5], [121.5, 15.0], [122.0, 14.0], [124.2, 13.6], [123.5, 12.7], [121.0, 13.6], [120.6, 14.5], [119.9, 15.3]], // Luzón
  [[109.6, 3.0], [109.7, 4.0], [111.5, 4.0], [113.9, 4.6], [115.4, 5.3], [116.8, 7.0], [117.9, 6.0], [119.2, 5.2], [119.3, 3.0]], // Borneo
];

export const STOPS = {
  phuket: { lon: 98.39, lat: 7.88, label: 'Phuket' },
  samui: { lon: 100.06, lat: 9.51, label: 'Koh Samui' },
  bangkok: { lon: 100.5, lat: 13.75, label: 'Bangkok' },
  muaythai: { lon: 102.9, lat: 15.4, label: 'Estadio' },
  macao: { lon: 113.54, lat: 22.19, label: 'Macao' },
  shanghai: { lon: 121.47, lat: 31.23, label: 'Shanghái' },
};
const ORDER = ['phuket', 'samui', 'bangkok', 'muaythai', 'macao', 'shanghai'];

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([lon, lat], i) => { const x = lon - LON0, y = lat - LAT0; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  s.closePath();
  return s;
}
function inPoly(lon, lat, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function makePlane() {
  const g = new THREE.Group();
  const white = flat('#fbf7ef'), coral = flat('#ff6f61'), dark = flat('#2b2d42');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 1.5, 8), white); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white); nose.position.z = 0.75; nose.scale.z = 1.4; g.add(nose);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.15, 0.5, 8), coral); stripe.rotation.x = Math.PI / 2; stripe.position.z = -0.1; g.add(stripe);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.38), white); wing.position.set(0, -0.04, 0.05); g.add(wing);
  const tailW = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.22), white); tailW.position.set(0, 0.02, -0.68); g.add(tailW);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.3), coral); fin.position.set(0, 0.2, -0.66); g.add(fin);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), dark); e.rotation.x = Math.PI / 2; e.position.set(0.5 * s, -0.12, 0.12); g.add(e); }
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.14), dark); win.position.set(0, 0.1, 0.72); g.add(win);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Monumentos pequeños para cada parada
function landmark(id) {
  const g = new THREE.Group();
  const M = flat;
  if (id === 'phuket') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 5), M('#8a5a2b')); trunk.position.y = 0.4; trunk.rotation.z = 0.2; g.add(trunk);
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 3), M('#3fae49')); l.position.set(0.08, 0.8, 0); l.rotation.set(Math.PI / 2.4, (i / 5) * Math.PI * 2, 0); l.translateY(0.25); g.add(l); }
    const villa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), M('#fff1d6')); villa.position.set(-0.4, 0.13, 0.2); g.add(villa);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.22, 4), M('#d65a31')); roof.position.set(-0.4, 0.36, 0.2); roof.rotation.y = Math.PI / 4; g.add(roof);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.2), glow('#3fe0ff', 1.2)); pool.position.set(-0.4, 0.02, 0.55); g.add(pool);
  } else if (id === 'samui') {
    for (const [x, z, s] of [[0, 0, 1], [0.35, 0.2, 0.7], [-0.3, 0.25, 0.6]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.22 * s, 0.9 * s, 6), M('#8d8a7a')); r.position.set(x, 0.45 * s, z); g.add(r);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * s, 0), M('#3c9a4a')); top.position.set(x, 0.92 * s, z); g.add(top);
    }
    const boat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.5), M('#c0392b')); boat.position.set(0.1, 0.03, 0.55); g.add(boat);
  } else if (id === 'bangkok') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.2, 8), M('#f2e3c6')); base.position.y = 0.1; g.add(base);
    const prang = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 0.9, 8), M('#f7d774')); prang.position.y = 0.65; g.add(prang);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), glow('#ffd166', 1.3)); tip.position.y = 1.3; g.add(tip);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), M('#f7d774')); p.position.set(0.45 * s, 0.35, 0); g.add(p); }
  } else if (id === 'muaythai') {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), M('#2b2d42')); ring.position.y = 0.06; g.add(ring);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), M('#1d4ed8')); mat.position.y = 0.13; g.add(mat);
    for (const [x, z, c] of [[-0.3, -0.3, '#e63946'], [0.3, 0.3, '#1d4ed8'], [0.3, -0.3, '#fff'], [-0.3, 0.3, '#fff']]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), M(c)); p.position.set(x, 0.3, z); g.add(p); }
    for (const y of [0.24, 0.34, 0.44]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.008, 3, 4), M('#e63946')); r.rotation.set(Math.PI / 2, 0, Math.PI / 4); r.position.y = y; g.add(r); }
  } else if (id === 'macao') {
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.6, 6), M('#d9d9e3')); needle.position.y = 0.8; g.add(needle);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.18, 10), glow('#c77dff', 1.1)); pod.position.y = 1.3; g.add(pod);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), M('#ffffff')); ant.position.y = 1.85; g.add(ant);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.1), M('#ffb703')); bridge.position.set(0.3, 0.12, 0.5); bridge.rotation.y = 0.5; g.add(bridge);
  } else if (id === 'shanghai') {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.9, 6), M('#e0e0f0')); n.position.y = 0.95; g.add(n);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow('#ff4fa3', 1.1)); s1.position.y = 0.55; g.add(s1);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glow('#ff4fa3', 1.1)); s2.position.y = 1.35; g.add(s2);
    for (const [x, hh] of [[0.45, 1.2], [0.7, 0.8], [-0.45, 1.0], [-0.7, 0.6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, hh, 0.18), M('#7aa2d6')); b.position.set(x, hh / 2, 0.15); g.add(b); }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createMap3D() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fe3e8');
  scene.fog = new THREE.Fog('#bff0ee', 70, 190);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);

  scene.add(new THREE.HemisphereLight('#fff6e0', '#3a7a8a', 1.4));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.2);
  sun.position.set(-15, 30, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  scene.add(sun); scene.add(sun.target);

  // océano con olitas
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, deep: { value: new THREE.Color('#1fa5b8') }, shallow: { value: new THREE.Color('#7fe0d8') } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float t; uniform vec3 deep; uniform vec3 shallow; varying vec2 vUv; varying vec3 vW;
      void main(){
        float w = sin(vW.x*1.7 + t*0.9)*sin(vW.z*1.3 - t*0.7) + sin((vW.x+vW.z)*0.6 + t*0.5)*0.6;
        float d = clamp(length(vUv-0.5)*1.6, 0.0, 1.0);
        vec3 c = mix(shallow, deep, d*0.7 + 0.15);
        c += smoothstep(1.1, 1.5, w) * 0.18;
        float grid = (1.0 - smoothstep(0.0, 0.03, abs(fract(vW.x/5.0)-0.5)*2.0 - 0.97)) + (1.0 - smoothstep(0.0, 0.03, abs(fract(vW.z/5.0)-0.5)*2.0 - 0.97));
        c = mix(c, vec3(1.0), clamp(grid,0.0,1.0)*0.06);
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), oceanMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.05; ocean.receiveShadow = true;
  scene.add(ocean);

  // tierras extruidas con borde de playa
  const landTop = flat('#a8d672'), landSide = flat('#f1d9a0');
  const extrude = { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.12, bevelSegments: 1, curveSegments: 1 };
  const polys = [MAINLAND, ...ISLANDS];
  for (const p of polys) {
    const g = new THREE.ExtrudeGeometry(shapeFrom(p), extrude);
    const m = new THREE.Mesh(g, [landTop, landSide]);
    m.rotation.x = -Math.PI / 2; m.position.y = -0.1;
    m.receiveShadow = true; m.castShadow = false;
    scene.add(m);
  }

  // árboles y montañas instanciados dentro de la tierra
  const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const treeGeo = new THREE.ConeGeometry(0.22, 0.6, 5); treeGeo.translate(0, 0.3, 0);
  const trees = new THREE.InstancedMesh(treeGeo, flat('#3f9d4f'), 520);
  const mtGeo = new THREE.ConeGeometry(1, 1, 5); mtGeo.translate(0, 0.5, 0);
  const mts = new THREE.InstancedMesh(mtGeo, flat('#8fb06a'), 70);
  const snowGeo = new THREE.ConeGeometry(0.38, 0.38, 5); snowGeo.translate(0, 0.81, 0);
  const snows = new THREE.InstancedMesh(snowGeo, flat('#fbfbff'), 70);
  const tmp = new THREE.Object3D();
  let ti = 0, mi = 0;
  for (let k = 0; k < 6000 && (ti < 520 || mi < 70); k++) {
    const lon = 94 + rnd() * 28, lat = 4 + rnd() * 30;
    const land = polys.some((p) => inPoly(lon, lat, p));
    if (!land) continue;
    // no tapar las paradas
    if (ORDER.some((id) => Math.hypot(STOPS[id].lon - lon, STOPS[id].lat - lat) < (lat > 23 ? 3.2 : 1.3))) continue;
    const p = geo(lon, lat, 0.33);
    if (lat > 23 && rnd() < 0.25 && mi < 70) {
      const s = 0.8 + rnd() * 1.6;
      tmp.position.copy(p); tmp.scale.set(s, s * (0.8 + rnd() * 0.6), s); tmp.rotation.y = rnd() * 3; tmp.updateMatrix();
      mts.setMatrixAt(mi, tmp.matrix); snows.setMatrixAt(mi, tmp.matrix); mi++;
    } else if (ti < 520) {
      const s = 0.6 + rnd() * 0.8;
      tmp.position.copy(p); tmp.scale.setScalar(s); tmp.rotation.y = rnd() * 3; tmp.updateMatrix();
      trees.setMatrixAt(ti++, tmp.matrix);
    }
  }
  trees.count = ti; mts.count = mi; snows.count = mi;
  trees.castShadow = mts.castShadow = true;
  scene.add(trees, mts, snows);

  // nubes
  const clouds = [];
  const cloudMat = flat('#ffffff', { roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.5, 0), cloudMat); b.position.set(j * 0.7 - 1, Math.random() * 0.3, Math.random() * 0.5); c.add(b); }
    c.position.set((Math.random() - 0.5) * 50, 4 + Math.random() * 3, (Math.random() - 0.5) * 50);
    c.userData.v = 0.3 + Math.random() * 0.4;
    c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(c); clouds.push(c);
  }

  // paradas con monumentos y peana
  const pins = {};
  for (const id of ORDER) {
    const s = STOPS[id];
    const g = new THREE.Group();
    g.position.copy(geo(s.lon, s.lat, 0.35));
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 16), flat('#fff8ec')); ped.position.y = 0.06; ped.receiveShadow = true; g.add(ped);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const lm = landmark(id); lm.position.y = 0.12; g.add(lm);
    scene.add(g);
    pins[id] = { group: g, ring, lm, pos: g.position.clone() };
  }

  // ruta: arcos de vuelo entre paradas
  const pts = [];
  for (let i = 0; i < ORDER.length - 1; i++) {
    const a = pins[ORDER[i]].pos, b = pins[ORDER[i + 1]].pos;
    const d = a.distanceTo(b);
    for (let k = 0; k < 12; k++) {
      const t = k / 12;
      const p = a.clone().lerp(b, t); p.y = 0.6 + Math.sin(t * Math.PI) * Math.min(5, 0.8 + d * 0.3);
      pts.push(p);
    }
  }
  const last = pins[ORDER[ORDER.length - 1]].pos.clone(); last.y = 0.6; pts.push(last);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
  const tubeSeg = 400;
  const routeGeo = new THREE.TubeGeometry(curve, tubeSeg, 0.06, 5, false);
  const route = new THREE.Mesh(routeGeo, glow('#ff6f61', 1.25));
  scene.add(route);
  const dashGeo = new THREE.TubeGeometry(curve, tubeSeg, 0.035, 4, false);
  const routeGhost = new THREE.Mesh(dashGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
  scene.add(routeGhost);
  const routeIdx = routeGeo.index.count;
  const stopU = {};
  // u de cada parada sobre la curva (aprox. por índice de punto)
  // u (por longitud de arco) del punto de la curva más cercano a cada parada
  ORDER.forEach((id) => {
    const target = pins[id].pos; let best = 0, bd = Infinity;
    for (let k = 0; k <= 2000; k++) { const u = k / 2000, q = curve.getPointAt(u); const d = (q.x - target.x) ** 2 + (q.z - target.z) ** 2; if (d < bd) { bd = d; best = u; } }
    stopU[id] = best;
  });

  const plane = makePlane();
  plane.scale.setScalar(0.9);
  scene.add(plane);
  const trail = []; // estela de puntitos
  const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 });
  for (let i = 0; i < 18; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), trailMat); scene.add(t); trail.push(t); }
  let trailI = 0, trailAcc = 0;

  const state = {
    mode: 'portada', t: 0, routeDraw: 0, planeU: 0, planeTarget: 0, focus: 'phuket',
    camPos: new THREE.Vector3(0, 40, 30), camLook: new THREE.Vector3(0, 0, 0),
    portadaT: 0, flyResolve: null, completed: {}, zoom: 1, zoomTarget: 1,
  };

  function setDraw(u) { route.geometry.setDrawRange(0, Math.floor(clamp(u, 0, 1) * routeIdx / 3) * 3); }
  setDraw(0);

  const look = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const ctrl = {
    scene, camera, pins, curve, stopU, order: ORDER,
    setMode(m) { state.mode = m; state.portadaT = 0; state.zoom = state.zoomTarget = m === 'mapa' ? 1.6 : 1; if (m === 'mapa') state.zoomTarget = 1; },
    // acercar la cámara a la parada antes de entrar en la etapa
    zoomIn() { state.zoomTarget = 0.28; },
    setProgress(doneIds) { state.completed = {}; for (const id of doneIds) state.completed[id] = true; },
    focusStage(id) { state.focus = id; },
    // el avión vuela hasta la parada; devuelve promesa al llegar
    flyTo(id) {
      state.planeTarget = stopU[id];
      state.focus = id;
      return new Promise((r) => { state.flyResolve = r; });
    },
    placePlane(id) { state.planeU = state.planeTarget = stopU[id]; },
    // posición en pantalla de una parada (para las etiquetas DOM)
    screenPos(id) {
      const p = pins[id].pos.clone(); p.y += 1.9;
      p.project(camera);
      return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, visible: p.z < 1 };
    },
    update(dt) {
      state.t += dt;
      oceanMat.uniforms.t.value = state.t;
      for (const c of clouds) {
        c.position.x += c.userData.v * dt; if (c.position.x > 28) c.position.x = -28;
        // al acercarse a una parada, las nubes se apartan para no tapar
        const k = state.zoomTarget < 1 || state.mode === 'mapa' ? 0.001 : 1;
        c.scale.setScalar(damp(c.scale.x, k, 6, dt));
      }
      // pulso de los anillos
      for (const id of ORDER) {
        const pin = pins[id];
        const sel = id === state.focus && state.mode === 'mapa';
        const k = sel ? 1 + Math.sin(state.t * 4) * 0.08 : 1;
        pin.ring.scale.setScalar(k);
        pin.ring.material.color.set(state.completed[id] ? '#ffd166' : sel ? '#ff6f61' : '#ffffff');
        pin.lm.rotation.y = sel ? pin.lm.rotation.y + dt * 0.6 : damp(pin.lm.rotation.y, 0, 2, dt);
        pin.group.position.y = damp(pin.group.position.y, pin.pos.y + (sel ? 0.25 : 0), 6, dt);
      }
      if (state.mode === 'portada') {
        // cinemática: la ruta se dibuja y el avión la recorre en bucle
        state.portadaT += dt;
        const u = ((state.portadaT * 0.09) % 1.25);
        state.planeU = clamp(u, 0, 1);
        setDraw(state.planeU + 0.002);
        const p = curve.getPointAt(state.planeU);
        camTarget.set(p.x * 0.4, 0, p.z * 0.5 + 2);
        state.camLook.lerp(camTarget, 1 - Math.exp(-dt * 1.5));
        const ang = state.portadaT * 0.12;
        const por = innerHeight > innerWidth ? 1.7 : 1;
        camera.position.set(state.camLook.x + Math.sin(ang) * 6, 30 * por, state.camLook.z + (24 + Math.cos(ang) * 4) * por + (por > 1 ? 10 : 0));
        camera.lookAt(state.camLook);
      } else {
        // mapa: el avión va hacia su objetivo; la cámara sigue a la parada elegida
        const diff = state.planeTarget - state.planeU;
        if (Math.abs(diff) > 0.0005) {
          state.planeU += Math.sign(diff) * Math.min(Math.abs(diff), dt * (0.12 + Math.abs(diff) * 0.9));
        } else if (state.flyResolve) { const r = state.flyResolve; state.flyResolve = null; r(); }
        state.routeDraw = damp(state.routeDraw, Math.max(state.routeDraw, state.planeU), 4, dt);
        setDraw(Math.max(state.routeDraw, maxDoneU()) + 0.002);
        const f = pins[state.focus].pos;
        const portrait = innerHeight > innerWidth;
        camTarget.set(f.x, 0, f.z + (portrait ? 1.5 : 0.5));
        state.camLook.lerp(camTarget, 1 - Math.exp(-dt * 2.2));
        state.zoom = damp(state.zoom, state.zoomTarget, 3.5, dt);
        const dist = (portrait ? 20 : 14) * state.zoom;
        state.camPos.set(state.camLook.x - 2, dist * 0.95, state.camLook.z + dist * 0.75);
        camera.position.lerp(state.camPos, 1 - Math.exp(-dt * 2.2));
        camera.lookAt(state.camLook);
      }
      // avión sobre la curva, mirando hacia delante, con un balanceo
      const u = clamp(state.planeU, 0, 0.999);
      const p = curve.getPointAt(u), p2 = curve.getPointAt(Math.min(1, u + 0.004));
      plane.position.copy(p); plane.position.y += 1.5 + Math.sin(state.t * 2) * 0.08;
      // cerca de una parada, el avión se aparta a un lado para no tapar la maqueta
      let near = 0; for (const id of ORDER) near = Math.max(near, 1 - Math.min(1, Math.abs(stopU[id] - u) / 0.02));
      plane.position.x += near * 1.3; plane.position.z += near * 0.6;
      // rumbo solo en horizontal (el avión siempre nivelado); aparcado mira hacia la siguiente parada
      const p3 = curve.getPointAt(Math.min(1, u + 0.02)), p0 = curve.getPointAt(Math.max(0, u - 0.02));
      look.set(plane.position.x + (p3.x - p0.x), plane.position.y, plane.position.z + (p3.z - p0.z));
      if ((p3.x - p0.x) ** 2 + (p3.z - p0.z) ** 2 > 1e-6) plane.lookAt(look);
      plane.rotateX(-clamp((p2.y - p.y) * 6, -0.35, 0.35));
      plane.rotateZ(Math.sin(state.t * 1.3) * 0.12);
      trailAcc += dt;
      if (trailAcc > 0.06) { trailAcc = 0; const tr = trail[trailI++ % trail.length]; tr.position.copy(plane.position); tr.scale.setScalar(1); }
      for (const tr of trail) tr.scale.multiplyScalar(Math.exp(-dt * 2.5));
      sun.target.position.copy(state.camLook); sun.position.set(state.camLook.x - 15, 30, state.camLook.z + 12);
    },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
  };
  function maxDoneU() { let m = 0; for (const id of ORDER) if (state.completed[id]) m = Math.max(m, stopU[ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(id) + 1)]]); return m; }
  ctrl.resize();
  return ctrl;
}
