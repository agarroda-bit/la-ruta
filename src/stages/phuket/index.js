// ETAPA 1 · PHUKET — Scooter al atardecer (versión en bruto de la fase 0).
import * as THREE from 'three';
import { Road } from '../../core/carretera.js';
import { Particles } from '../../core/engine.js';
import { makeSky, flat, damp, clamp, fmtTime, disposeTree } from '../../core/util.js';

export default {
  id: 'phuket',
  music: 'phuket',
  ghost: true,
  controls: {
    joystick: 'steer',
    buttons: [
      { id: 'boost', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], pad: [0, 5], color: '#ff9f1c', size: 'big' },
      { id: 'b', label: 'FRENO', keys: ['Space', 'KeyS', 'ArrowDown'], pad: [1, 6], color: '#3a86ff' },
    ],
  },
  intro: [
    { who: 0, text: '¡Phuket! Treinta grados a la sombra y no hay sombra.' },
    { who: 1, text: 'La villa del cumple está al otro lado de la costa. Hay que llegar antes de que se ponga el sol.' },
    { who: 0, text: 'Coge cocos por el camino. Y cuidado con los monos, que roban gafas.' },
  ],

  async create(ctx) {
    const { rng } = ctx;
    const scene = new THREE.Scene();
    const sky = makeSky('#ff7e5f', '#ffd29d', '#ffb385');
    scene.add(sky);
    scene.fog = new THREE.Fog('#ffc89a', 60, 260);
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1000);
    const hemi = new THREE.HemisphereLight('#ffe2c0', '#5a7a6a', 1.3); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffd0a0', 2.4); sun.position.set(-40, 50, -60); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 200 });
    scene.add(sun, sun.target);

    // trazado de la costa
    const pts = []; let p = new THREE.Vector3(0, 0, 0), heading = 0;
    for (let i = 0; i < 34; i++) {
      pts.push(p.clone());
      heading += rng.range(-0.45, 0.45);
      heading = clamp(heading, -1.1, 1.1);
      p = p.clone().add(new THREE.Vector3(Math.sin(heading) * 55, 0, -Math.cos(heading) * 55));
    }
    const road = new Road(pts, { width: 9, shoulder: 2.5 });
    scene.add(road.mesh);
    const L = road.length;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), flat('#7fbf5a'));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#2fb3c4', roughness: 0.3, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-1530, 0.0, 0); scene.add(sea);

    // palmeras al lado derecho
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 5); trunkGeo.translate(0, 3.5, 0);
    const leafGeo = new THREE.ConeGeometry(1.2, 4.5, 3); leafGeo.rotateX(Math.PI / 2.2); leafGeo.translate(0, 7, 2);
    const nPalm = 160;
    const trunks = new THREE.InstancedMesh(trunkGeo, flat('#8a5a2b'), nPalm), leaves = [];
    for (let k = 0; k < 5; k++) leaves.push(new THREE.InstancedMesh(leafGeo, flat('#2f9e44'), nPalm));
    const tmp = new THREE.Object3D();
    for (let i = 0; i < nPalm; i++) {
      const a = road.at((i / nPalm) * L), side = i % 3 === 0 ? -1 : 1;
      tmp.position.copy(a.p).addScaledVector(a.n, side * rng.range(9, 22)); tmp.rotation.set(0, rng() * 6, rng.range(-0.15, 0.15)); tmp.scale.setScalar(rng.range(0.8, 1.3)); tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);
      for (let k = 0; k < 5; k++) { tmp.rotation.y += (Math.PI * 2) / 5; tmp.updateMatrix(); leaves[k].setMatrixAt(i, tmp.matrix); }
    }
    trunks.castShadow = true; scene.add(trunks, ...leaves);

    // scooter + piloto + compi de paquete
    const bike = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.6), flat('#ff6f61')); body.position.y = 0.55; bike.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.9), flat('#2b2d42')); seat.position.set(0, 0.85, -0.2); bike.add(seat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), flat('#cccccc')); bar.position.set(0, 1.25, 0.6); bike.add(bar);
    for (const z of [0.65, -0.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), flat('#222')); w.rotation.z = Math.PI / 2; w.position.set(0, 0.3, z); bike.add(w); }
    const rider = ctx.makeCharacter(ctx.looks[0]); rider.pose('ride'); rider.group.position.set(0, 0.32, 0.05); bike.add(rider.group);
    const pass = ctx.makeCharacter(ctx.looks[1]); pass.pose('sit'); pass.group.position.set(0, 0.32, -0.55); bike.add(pass.group);
    bike.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(bike);

    // cocos y monos
    const cocos = [];
    const cocoGeo = new THREE.IcosahedronGeometry(0.45, 0), cocoMat = flat('#7a4a22');
    for (let s = 60; s < L - 40; s += rng.range(18, 34)) {
      const a = road.at(s), lat = rng.range(-3.2, 3.2);
      const m = new THREE.Mesh(cocoGeo, cocoMat); m.position.copy(a.p).addScaledVector(a.n, lat); m.position.y = 1; m.castShadow = true;
      scene.add(m); cocos.push(m);
    }
    const monkeys = [];
    for (let s = 200; s < L - 80; s += rng.range(120, 200)) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat('#8d6346')); b.position.y = 0.6; g.add(b);
      const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), flat('#c9a27e')); hd.position.y = 1.2; g.add(hd);
      const a = road.at(s); g.position.copy(a.p);
      g.userData = { s, a, phase: rng() * 6, hit: false };
      scene.add(g); monkeys.push(g);
    }
    const fx = new Particles(scene, 300);

    // estado
    const st = { s: 0, i: -1, lateral: 0, speed: 0, yaw: 0, t: 0, timeLimit: 95, cocos: 0, monkeyHits: 0, running: false, done: false, boost: 1, boostT: 0 };
    const start = road.at(2);
    bike.position.copy(start.p); st.yaw = Math.atan2(start.t.x, start.t.z); bike.rotation.y = st.yaw;
    const engineSnd = ctx.audio.loop('engine');

    // fantasma
    let ghostMesh = null;
    if (ctx.ghost.data) { ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 1.8), flat('#fff')); scene.add(ghostMesh); ctx.ghost.spawn(ghostMesh); }

    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    camera.position.copy(bike.position).add(new THREE.Vector3(0, 4, 8));

    const updateHud = () => {
      const left = Math.max(0, st.timeLimit - st.t);
      ctx.hud.set('cocos', `🥥 ${st.cocos}`, 'izq');
      ctx.hud.set('sol', `☀ ${fmtTime(left)}`, 'centro');
      ctx.hud.bar('prog', st.s / L, 'VILLA', 'centro', '#ff6f61');
    };
    updateHud();

    const inst = {
      scene, camera,
      async start() {
        await ctx.intro();
        st.running = true;
        ctx.raceStart(bike);
      },
      update(dt) {
        fx.update(dt);
        const inp = ctx.input;
        if (st.running && !st.done) {
          st.t += dt;
          const braking = inp.down('b') || inp.y < -0.3;
          if (inp.pressed('boost') && st.boostT <= 0) { st.boostT = 1.5; ctx.audio.sfx('boost'); ctx.shout('¡TURBO!', { size: 'peque' }); }
          st.boostT -= dt;
          const max = st.boostT > 0 ? 34 : 24;
          const target = braking ? 6 : max;
          st.speed = damp(st.speed, target, braking ? 3 : 0.9, dt);
          st.yaw -= inp.x * dt * 1.6 * clamp(st.speed / 12, 0.3, 1);
          const fwd = new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw));
          bike.position.addScaledVector(fwd, st.speed * dt);
          const q = road.locate(bike.position, st.i); st.i = q.i; st.s = q.s; st.lateral = q.lateral;
          if (Math.abs(q.lateral) > road.width / 2 + 2) { st.speed = damp(st.speed, 8, 3, dt); if (Math.random() < 0.3) fx.emit(1, bike.position, { color: '#d9c08a', vel: { x: 0, y: 2, z: 0 } }); }
          if (Math.abs(q.lateral) > 14) bike.position.addScaledVector(q.n, -Math.sign(q.lateral) * 0.3);
          bike.rotation.y = st.yaw; bike.rotation.z = damp(bike.rotation.z, inp.x * 0.35, 6, dt);
          for (const c of cocos) {
            if (!c.visible) continue;
            c.rotation.y += dt * 2;
            if (c.position.distanceToSquared(bike.position) < 2.6) {
              c.visible = false; st.cocos++; ctx.audio.sfx('coin', { pitch: 1 + (st.cocos % 5) * 0.05 }); fx.emit(10, c.position, { colors: ['#fff3b0', '#ffd166'] }); ctx.hud.pop('cocos');
              if (st.cocos === 1) ctx.sticker('primer-coco');
            }
          }
          for (const m of monkeys) {
            const u = m.userData; const cross = Math.sin(ctx.engine.elapsed * 0.8 + u.phase) * 6;
            m.position.copy(u.a.p).addScaledVector(u.a.n, cross); m.position.y = Math.abs(Math.sin(ctx.engine.elapsed * 6 + u.phase)) * 0.4;
            if (!u.hit && m.position.distanceToSquared(bike.position) < 2.2) {
              u.hit = true; st.monkeyHits++; st.speed *= 0.3; ctx.engine.shake(0.6); ctx.audio.sfx('crash'); ctx.vibrate(60); ctx.shout('¡MONO!', { size: 'peque', color: '#ff6f61' });
            }
          }
          if (st.s >= L - 12) finish(true);
          else if (st.t >= st.timeLimit) finish(false);
          updateHud();
        }
        engineSnd.set({ rate: st.speed / 30, vol: st.running ? 0.1 : 0.04 });
        // cámara de persecución
        const back = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
        camPos.copy(bike.position).addScaledVector(back, 7 + st.speed * 0.08); camPos.y += 3.2;
        camera.position.lerp(camPos, 1 - Math.exp(-dt * 5));
        camLook.copy(bike.position).addScaledVector(back, -6); camLook.y += 1.2;
        camera.lookAt(camLook);
        camera.fov = damp(camera.fov, 62 + st.speed * 0.4, 3, dt); camera.updateProjectionMatrix();
        sun.target.position.copy(bike.position); sun.position.copy(bike.position).add(new THREE.Vector3(-40, 50, -60));
        // el cielo se va poniendo
        const k = clamp(st.t / st.timeLimit, 0, 1);
        sky.material.uniforms.top.value.set('#ff7e5f').lerp(new THREE.Color('#3d2c6e'), k);
        sky.material.uniforms.mid.value.set('#ffd29d').lerp(new THREE.Color('#ff7a59'), k);
        sun.intensity = 2.4 - k * 1.4;
      },
      dispose() { engineSnd.stop(); disposeTree(scene); },
    };
    function finish(win) {
      st.done = true; st.running = false;
      const left = Math.max(0, st.timeLimit - st.t);
      const stars = !win ? 0 : 1 + (left > 15 ? 1 : 0) + (st.cocos >= cocos.length * 0.6 ? 1 : 0);
      if (win && st.monkeyHits === 0) ctx.sticker('sin-monos');
      if (win && left > 25) ctx.sticker('atardecer');
      if (st.cocos >= 40) ctx.sticker('cocotero');
      ctx.finish({
        win, stars, time: st.t, score: Math.round(st.cocos * 50 + left * 20),
        stats: [['Cocos', `${st.cocos}/${cocos.length}`], ['Tiempo', fmtTime(st.t)], ['Sol de sobra', fmtTime(left)], ['Monos', st.monkeyHits]],
        moreStats: { cocos: st.cocos },
        shareText: `${st.cocos} cocos y ${fmtTime(st.t)} en Phuket`,
        title: win ? '¡Llegáis a la fiesta!' : 'Se puso el sol…',
      });
    }
    return inst;
  },
};
