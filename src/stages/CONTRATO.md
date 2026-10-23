# Contrato de una etapa

Cada etapa vive en `src/stages/<id>/` (puede tener varios archivos) y exporta por defecto:

```js
export default {
  id: 'phuket',
  music: 'phuket',              // id de pista en src/audio/pistas.js (por defecto, el id)
  ghost: true,                  // etapa de carrera: graba y reproduce fantasmas
  controls: {                   // ver src/core/input.js
    joystick: 'steer',          // 'steer' (solo X) | 'move' (X e Y) | false
    players: 1,                 // 2 = modo dos jugadores
    split: false, splitAxis: 'x',
    buttons: [{ id: 'boost', label: 'TURBO', keys: ['ShiftLeft'], keys2: [...], pad: [0], color: '#ff9f1c', size: 'big', player: 0, pos: {right: 24, bottom: 34} }],
  },
  intro: [{ who: 0, text: '...' }, { who: 1, text: '...' }, { who: 'Vendedora', text: '...' }],   // {0} {1} = nombres
  async create(ctx) { ...; return instancia; },
};
```

La instancia: `{ scene, camera, start(), update(dt, realDt), dispose(), render?(renderer, dt), resize?(w, h) }`.
- `start()` se llama al quitar el telón: normalmente `await ctx.intro(); ctx.raceStart(objetoJugador); ...`.
- `update(dt)`: dt ya viene con cámara lenta/pausa aplicadas. Nunca lanza excepciones.
- `dispose()`: libera geometrías/materiales (`disposeTree(scene)`) y para sonidos en bucle.

## ctx (lo que te da el juego)
- `THREE, engine, input, audio, save, hud, rng, seed, mode ('normal'|'reto'|'compi'|...)`
- `names` [jugador, compi], `looks` [look1, look2], `makeCharacter(look)` (ver `src/core/chars.js`)
- `rng()` aleatorio CON SEMILLA: úsalo para TODO lo que afecte al trazado/eventos (los retos diarios cambian la semilla). `Math.random` solo para efectos visuales.
- `intro(lines?, {count, go})` tarjeta + diálogo + cuenta atrás. `dialog(lines)` → Promise. `countdown()`.
- `hud.set(id, html, pos)`, `hud.bar(id, v, label, pos, color)`, `hud.pop(id)`, `shout(texto, {size:'peque', color})`, `toast(html)`, `confetti()`
- `engine.shake(0.4)`, `engine.slowmo(1, 0.25)`, `vibrate(ms)`, `new Particles(scene, max)` (de `core/engine.js`)
- `audio.sfx('coin'|'boost'|'crash'|'hit'|'whoosh'|'star'|'splash'|'horn'|'bell'|'firework'|...)`, `audio.loop('engine'|'rain'|'waves'|'crowd'|'wind'|'train')` → `{set({rate, vol}), stop()}`, `audio.intensity(0..1)`
- `sticker(id)` desbloquea una pegatina (ids en `src/core/pegatinas.js`)
- `raceStart(obj)` empieza el reloj y graba el fantasma de `obj` (position + rotation.y/z). `raceTime`.
- `ghost.data` (si hay fantasma), `ghost.spawn(mesh)` → lo mueve solo; `ghost.label`.
- `finish({ win, stars 0-3, score, time, stats: [['Cocos','12/40']], moreStats: {cocos: 12}, shareText, title, lines })`
- `exit()` volver al mapa.

## Reglas
- Todo low-poly generado por código. Sin archivos externos ni marcas reales. Texto en castellano, frases cortas, humor blanco.
- Rendimiento: móvil de gama media a 30 fps. Pocas luces (1 direccional con sombra + hemisférica), InstancedMesh para lo repetido, `engine.q` dice la calidad (`q.shadows`, `q.particles`, `q.drawDistance`).
- Deja `window.__ruta.etapa = { ...estado }` para pruebas automáticas (progreso, puntos, si ha terminado).
- Mitad izquierda de la pantalla = joystick; botones abajo a la derecha. Respeta las zonas seguras del iPhone.
