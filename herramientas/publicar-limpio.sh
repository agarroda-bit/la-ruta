#!/bin/sh
# Publica exactamente lo que hay en el último commit (sin archivos a medias de la copia de trabajo).
set -e
RAIZ=$(pwd)
TMP=$(mktemp -d /tmp/ruta-limpio-XXXX)
git worktree add -q --detach "$TMP" HEAD
ln -s "$RAIZ/node_modules" "$TMP/node_modules"
cd "$TMP"
npm run deploy
cd "$RAIZ"
git worktree remove --force "$TMP"
