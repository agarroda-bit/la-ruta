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
- [x] 8. Tres rondas de crítica (+ comprobación final de Samui, Bangkok y Shanghái).
- [ ] 9. Etapas extra (Cantón, Chiang Mai, Bali): no empezadas.

## FPS medidos (crítica final, 24/10 madrugada)
| Etapa | Mac (GPU, 1440×900) | Móvil simulado (CPU ×4, 390×844): media / mínimo |
|---|---|---|
| Mapa / portada | 60 | 60 |
| Phuket | 60 | 60 / 60 |
| Koh Samui | 60 | 59,9 / 52 |
| Bangkok | 60 | 59,9 / 52 |
| Muay Thai (1 J / duelo apaisado) | 60 | 60 / 54 |
| Macao | 60 | 60 / 54 |
| Shanghái | 60 | 59,8 / 50 |

## Notas del crítico (diversión / claridad / belleza)
| Etapa | Ronda 1 | Ronda 2 | Ronda 3 | Comprobación final |
|---|---|---|---|---|
| Phuket | 6/7/7 | 7/8/8 | 8/8/8 | — |
| Koh Samui | 6/5/6 | 7/8/7 | 7/8/8 | 8/8/8 |
| Bangkok | 7/6/8 | 7/7/8 | 7/8/8 | 8/8/8 |
| Muay Thai | 6/6/8 | 7/7/8 | 8/8/8 | — |
| Macao | 7/6/7 | 7,5/7,5/7 | 8/8/8 | — |
| Shanghái | 6/6/7 | 6,5/8/8 | 7,5/8/8,5 | 8/8/8,5 |

## Pruebas
- General (PWA sin red + guardado + nombres): `npm test` → `herramientas/pruebas.mjs`.
- Cada etapa de principio a fin (toques 390×844 + teclado 1440×900): `node pruebas/<id>.mjs --port 5xxx`.
- Publicar desde copia limpia del último commit: `./herramientas/publicar-limpio.sh`.
