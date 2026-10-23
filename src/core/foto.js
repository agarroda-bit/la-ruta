// Modo foto (provisional): captura la pantalla con el marco de la etapa y la guarda/comparte.
import { engine } from './engine.js';
import { save } from './save.js';
import { audio } from './audio.js';
import { toast } from './ui.js';

export async function openPhotoMode(current) {
  const canvas = await engine.snapshot();
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  const g = out.getContext('2d');
  g.drawImage(canvas, 0, 0);
  const s = out.width / innerWidth;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, out.height - 60 * s, out.width, 60 * s);
  g.fillStyle = '#fff'; g.font = `${26 * s}px Bungee`; g.fillText(`LA RUTA · ${current.def.name.toUpperCase()}`, 18 * s, out.height - 20 * s);
  audio.sfx('photo');
  save.addStat('fotos');
  out.toBlob(async (blob) => {
    const file = new File([blob], `la-ruta-${current.def.id}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'La Ruta' }); return; }
    } catch (e) { /* cancelado */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast('📷 Foto guardada');
  }, 'image/png');
}
