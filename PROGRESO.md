# PROGRESO — La Ruta

## Cómo retomar
- Código en `~/Downloads/GOLDENO1/Juegos/la-ruta` (repo `agarroda-bit/la-ruta`). `npm i`, `npm run dev`.
- Probar: `node herramientas/captura.mjs --gpu --page "?etapa=phuket" --shots '[...]'` (ver cabecera del archivo). `?todo` desbloquea todas las etapas; `?mapa` va directo al mapa.
- Publicar: `npm run deploy` (build + sw.js + rama gh-pages). Comprobar `https://agarroda-bit.github.io/la-ruta/version.txt`.
- Contrato de las etapas: `src/stages/CONTRATO.md`.

## Fases
- [x] 0. Esqueleto: Vite, PWA, nombres, editor, mapa 3D, etapa 1 en bruto.
- [x] 1. Phuket completa y pulida.
- [x] 2. Bangkok.
- [x] 3. Muay Thai con 2 jugadores.
- [x] 4. Koh Samui.
- [x] 5. Macao.
- [x] 6. Shanghái + créditos finales.
- [x] 7. Retos diarios, fantasmas, pegatinas, modo foto, compartir.
- [ ] 8. Tres rondas de crítica.

## FPS medidos
| Etapa | Mac (GPU) | Móvil simulado (CPU ×4, 390×844) |
|---|---|---|
| Mapa / portada | 60 | 60 |
| Phuket | 58-60 | 52-60 |
| Koh Samui | 60 | 54-60 (mín. 28 en la foto de cala) |
| Bangkok | 60 | 60 (mín. 42) |
| Muay Thai (1 J / 2 J) | 60 / 60 | 60 / 50 |
| Macao | 60 | 54-60 |
| Shanghái | 59-60 | 60 |

(medidas de los agentes de cada etapa, 24/10 madrugada; se repiten en la crítica)

## Pruebas
- General (PWA sin red + guardado + nombres): `npm test` → `herramientas/pruebas.mjs`.
- Cada etapa de principio a fin (toques 390×844 + teclado 1440×900): `node pruebas/<id>.mjs --port 5xxx`.
- Publicar desde copia limpia del último commit: `./herramientas/publicar-limpio.sh`.
