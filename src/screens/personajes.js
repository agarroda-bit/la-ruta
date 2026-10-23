// Editor rápido de los dos viajeros: piel, pelo, peinado, camiseta, estampado, gafas, gorra y mochila.
import * as THREE from 'three';
import { engine } from '../core/engine.js';
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { screen, button, h, esc, $ } from '../core/ui.js';
import { makeCharacter, SKINS, HAIRS, SHIRTS, PATTERNS, HAIR_STYLES } from '../core/chars.js';
import { makeSky, damp } from '../core/util.js';
import { unlockSticker } from '../core/game.js';

const CAPS = ['', '#1f8a8a', '#ff6f61', '#222222', '#ffd166', '#ffffff'];
const SHORTS = ['#2e4a7d', '#e8c170', '#3a3a3a', '#8ac926', '#ff9f1c', '#ffffff'];

export function openEditor({ onClose } = {}) {
  const scene = new THREE.Scene();
  scene.add(makeSky('#ff9a76', '#ffd6a5', '#6a4c93'));
  scene.fog = new THREE.Fog('#ffd6a5', 12, 40);
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#fff1d6', '#7a5c8a', 1.5));
  const sun = new THREE.DirectionalLight('#fff0dd', 2.4); sun.position.set(3, 6, 4); sun.castShadow = true; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.25, 32), new THREE.MeshStandardMaterial({ color: '#f6e7c8', flatShading: true }));
  floor.position.y = -0.125; floor.receiveShadow = true; scene.add(floor);
  // pequeña palmera de decoración
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#8a5a2b', flatShading: true })); trunk.position.y = 1.1; trunk.rotation.z = 0.15; palm.add(trunk);
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 3), new THREE.MeshStandardMaterial({ color: '#3fae49', flatShading: true })); l.position.set(0.15, 2.2, 0); l.rotation.set(Math.PI / 2.3, (i / 6) * Math.PI * 2, 0); l.translateY(0.5); palm.add(l); }
  palm.position.set(-2.1, 0, -1.2); scene.add(palm);

  const chars = save.data.looks.map((lk) => makeCharacter(lk));
  chars[0].group.position.set(-0.6, 0, 0); chars[1].group.position.set(0.6, 0, 0);
  chars.forEach((c) => { c.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(c.group); });
  let who = 0, t = 0, spin = 0;
  const portrait = () => innerHeight > innerWidth;
  const ctrl = {
    scene, camera,
    update(dt) {
      t += dt;
      chars.forEach((c, i) => {
        c.pose(i === who ? 'wave' : 'idle', t + i);
        const target = i === who ? spin : 0;
        c.group.rotation.y = damp(c.group.rotation.y, target, 5, dt);
      });
      const fx = chars[who].group.position.x * 0.7;
      const p = portrait();
      camera.position.set(damp(camera.position.x, fx, 4, dt), p ? 1.9 : 1.5, p ? 5.6 : 4.3);
      camera.lookAt(camera.position.x, p ? 0.55 : 0.95, 0);
    },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
  };
  ctrl.resize();
  camera.position.set(0, 1.5, 4.3);
  engine.setController(ctrl);

  const s = screen('editor', `
    <div class="editor-top no-ctrl"><div class="editor-tabs"></div></div>
    <div class="panel editor-panel no-ctrl"><div class="editor-filas"></div><div class="editor-botones"></div></div>`);
  const tabs = $('.editor-tabs', s);
  const rows = $('.editor-filas', s);
  const names = save.data.names;
  const tabBtns = names.map((n, i) => { const b = button(esc(n), () => { who = i; render(); }, 'tab'); tabs.appendChild(b); return b; });

  function swatches(key, list, label) {
    const row = h('div', 'ed-fila', `<span>${label}</span>`);
    const box = h('div', 'ed-muestras');
    for (const c of list) {
      const sw = h('button', 'muestra' + (save.data.looks[who][key] === c ? ' on' : '') + (c === '' ? ' nada' : ''));
      sw.style.background = c || 'transparent';
      sw.addEventListener('click', () => set(key, c));
      box.appendChild(sw);
    }
    row.appendChild(box); return row;
  }
  function options(key, list, label) {
    const row = h('div', 'ed-fila', `<span>${label}</span>`);
    const box = h('div', 'ed-opciones');
    list.forEach((name, i) => {
      const b = h('button', 'opcion' + ((save.data.looks[who][key] | 0) === i ? ' on' : ''), name);
      b.addEventListener('click', () => set(key, i));
      box.appendChild(b);
    });
    row.appendChild(box); return row;
  }
  function toggle(key, label) {
    const row = h('div', 'ed-fila', `<span>${label}</span>`);
    const b = h('button', 'opcion' + (save.data.looks[who][key] ? ' on' : ''), save.data.looks[who][key] ? 'Sí' : 'No');
    b.addEventListener('click', () => set(key, !save.data.looks[who][key]));
    row.appendChild(b); return row;
  }
  const changed = new Set();
  function set(key, v) {
    save.data.looks[who][key] = v;
    chars[who].setLook(save.data.looks[who]);
    save.touch();
    changed.add(who);
    if (changed.size >= 2) unlockSticker('estilista');
    spin += Math.PI * 2;
    audio.sfx('click');
    render();
  }
  function render() {
    tabBtns.forEach((b, i) => b.classList.toggle('on', i === who));
    rows.innerHTML = '';
    rows.append(
      swatches('skin', SKINS, 'Piel'),
      swatches('hair', HAIRS, 'Pelo'),
      options('hairStyle', HAIR_STYLES, 'Peinado'),
      swatches('shirt', SHIRTS, 'Camisa'),
      options('pattern', PATTERNS, 'Estampado'),
      swatches('shorts', SHORTS, 'Bañador'),
      swatches('cap', CAPS, 'Gorra'),
      toggle('glasses', 'Gafas de sol'),
      toggle('bag', 'Mochila'),
    );
  }
  render();
  $('.editor-botones', s).append(button('Listo ✓', async () => { save.flush(); await s.close(); if (onClose) onClose(); }, 'grande'));
}
