# Brief común para los agentes de La Ruta

Juego 3D para móvil (iPhone, en un avión, sin internet) del viaje de Rodri y su compi por Tailandia y China.
Proyecto: `~/Downloads/GOLDENO1/Juegos/la-ruta` (Vite + Three.js 0.180, JavaScript, sin TypeScript).
Lee primero: `src/stages/CONTRATO.md`, `src/core/*.js` (motor, entrada, UI, personajes, carretera), `src/stages/phuket/index.js` (ejemplo en bruto) y `src/main.js`.

## Listón
- Tiene que **sorprender**: bonito, con mucho "jugo" (partículas, temblor de cámara, cámara lenta, gritos en pantalla, sonidos en cada acción), y divertido en 10 segundos. Mejor pequeño y pulido que grande y a medias.
- Low-poly generado por código (flatShading, colores con carácter). Nada de archivos externos, nada de marcas reales, nada de apuestas ni alcohol en primer plano, ningún estereotipo ofensivo: los locales son personajes simpáticos con gracia propia, no el chiste.
- Texto en castellano de España, frases cortas, humor blanco con gracia (de Barcelona), nunca vulgar. Usa `{0}` y `{1}` (nombres del jugador y su compi) en los diálogos.
- Controles: táctil (joystick a la izquierda, botones grandes a la derecha), teclado y mando (Gamepad). Todo lo que declares en `controls` funciona solo con los tres.
- Rendimiento: 30 fps mínimo en móvil de gama media. 1 luz direccional con sombra + hemisférica, InstancedMesh/merge para lo repetido, nada de miles de draw calls. Respeta `engine.q` (calidad) y el modo ahorro.
- Duración de una partida: 1,5-3 minutos. Estrellas: 1 por acabar, 2 y 3 por hacerlo bien (que 3 cueste pero se pueda).
- `rng` con semilla para todo lo que afecte a la partida (retos diarios). Deja `window.__ruta.etapa = {...}` con el estado para las pruebas.

## Reglas de convivencia (hay varios agentes a la vez en el mismo repo)
- Solo editas archivos dentro de **tu carpeta** (`src/stages/<id>/`) y tus pruebas (`pruebas/<id>*.mjs`, `pruebas/capturas/<id>-*.png`). **No toques** `src/core/`, `src/audio/`, `src/screens/`, `src/main.js`, otras etapas, `package.json` ni `index.html`. Si necesitas un cambio del núcleo, apáñatelo dentro de tu carpeta (puedes importar y envolver) y explícalo en tu informe final.
- **No hagas commits ni push ni deploy**: el director (yo) integra, hace commit y publica.
- No toques nada fuera de `~/Downloads/GOLDENO1/Juegos/la-ruta`.

## Probar (obligatorio)
- Herramienta: `node herramientas/captura.mjs` (lee su cabecera). Usa SIEMPRE `--gpu` (GPU real; SwiftShader satura el Mac) y TU puerto asignado. Un solo navegador a la vez por agente.
  - Directo a tu etapa: `--page "?etapa=<id>"`. Saltar diálogos: `{"eval":"document.querySelectorAll('.dlg-saltar').forEach(b=>b.click())"}`.
  - Móvil: `--width 390 --height 844 --touch` y toques con `tap` / `touch` (dedos mantenidos, arrastres). Escritorio: `--width 1440 --height 900` con `keys`.
  - FPS de móvil: `--cpu 4 --width 390 --height 844 --touch` y `{"log":"window.__ruta.engine.fps"}` tras unos segundos de juego.
- Escribe `pruebas/<id>.mjs` (Playwright) que **juegue la etapa de principio a fin** con toques reales en 390×844 (bucle de control: lee `window.__ruta.etapa` y manda toques/arrastres por CDP `Input.dispatchTouchEvent`, mira cómo lo hace `captura.mjs`) y otra pasada con teclado en 1440×900. Debe llegar a la pantalla de resultados (`.resultados`) sin errores de consola. Se ejecuta con `node pruebas/<id>.mjs --port <tu puerto>` y levanta su propio servidor de Vite (cacheDir propio por puerto, como captura.mjs).
- Mira tus capturas (con la herramienta de leer imágenes) y corrige lo que se vea feo o confuso. Guarda las buenas en `pruebas/capturas/<id>-*.png` (varias: inicio, acción, final, en 390×844 y 1440×900).

## Informe final (tu último mensaje, breve)
Qué has hecho, qué falta, fps medidos (Mac y CPU×4 móvil), cómo pasar la prueba, y cualquier cambio que necesites en el núcleo (con el código exacto propuesto).
