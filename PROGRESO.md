# PROGRESO — La Ruta

## Cómo retomar
- Código en `~/Downloads/GOLDENO1/Juegos/la-ruta` (repo `agarroda-bit/la-ruta`). `npm i`, `npm run dev`.
- Probar: `node herramientas/captura.mjs --gpu --page "?etapa=phuket" --shots '[...]'` (ver cabecera del archivo). `?todo` desbloquea todas las etapas; `?mapa` va directo al mapa.
- Publicar: `npm run deploy` (build + sw.js + rama gh-pages). Comprobar `https://agarroda-bit.github.io/la-ruta/version.txt`.
- Contrato de las etapas: `src/stages/CONTRATO.md`.

## Fases
- [x] 0. Esqueleto: Vite, PWA, nombres, editor, mapa 3D, etapa 1 en bruto.
- [ ] 1. Phuket completa y pulida.
- [ ] 2. Bangkok.
- [ ] 3. Muay Thai con 2 jugadores.
- [ ] 4. Koh Samui.
- [ ] 5. Macao.
- [ ] 6. Shanghái + créditos finales.
- [ ] 7. Retos diarios, fantasmas, pegatinas, modo foto, compartir.
- [ ] 8. Tres rondas de crítica.

## FPS medidos
| Etapa | Mac (GPU) | Móvil simulado (CPU ×4, 390×844) |
|---|---|---|
