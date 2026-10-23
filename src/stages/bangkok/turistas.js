// Turistas españoles (y sus frases), retratos dibujados con canvas y comentarios del compi.
// {0} y {1} = nombres del jugador y su compi.

const L = (skin, hair, hairStyle, shirt, pattern, extra = {}) => ({ skin, hair, hairStyle, shirt, pattern, shorts: '#2e4a7d', glasses: false, cap: '', ...extra });

export const TURISTAS = [
  {
    id: 'jordi', name: 'Jordi', from: 'Barcelona', dest: 'mochila', bg: '#ffd166',
    looks: [L('#f0c8a0', '#3a2414', 4, '#ffd166', 3, { bag: true, shorts: '#8a7a5a' })],
    pick: ['¡Bona nit! A la Calle Mochila, la de los mochileros. ¡Llevo la mochila y todo!'],
    ride: ['¿Esto tiene aire acondicionado? Ah, no, que es el aire.', 'En Barcelona también hay motos, pero no hacen estas curvas.', 'Mi madre cree que estoy en un museo. Tú calla.'],
    drop: ['¡Moltes gràcies! Más rápido que el bus nocturno.'],
    late: 'Me bajo aquí, que llego antes andando. ¡Adéu!',
  },
  {
    id: 'pareja', name: 'Lucía y Dani', from: 'Zaragoza', dest: 'muelle', bg: '#ff9ad5', couple: true,
    looks: [L('#e8b48a', '#2b1a12', 4, '#ffffff', 1, { shorts: '#ff6f61' }), L('#e0ac7e', '#1a1210', 0, '#ffffff', 1)],
    pick: ['—¡Al muelle del río, que perdemos el crucero! —Te dije que era a las nueve, Dani.'],
    ride: ['—Si hubiéramos cogido el barco… —¡El barco SALE del muelle, Lucía!', '—¿Ves? Él sí sabe ir. —Porque es taxista, cariño.', '—Te dije que el mapa estaba al revés. —El mapa estaba bien, el revés eras tú.'],
    drop: ['—Pues ha sido lo más bonito del viaje. —¿Más que la boda? —…Sin comentarios.'],
    late: '—Bajamos aquí y corremos. —¡Corre tú, que yo llevo las chanclas!',
  },
  {
    id: 'abuela', name: 'Abuela Maripaz', from: 'Valladolid', dest: 'templo', bg: '#c77dff',
    looks: [L('#f6d3b3', '#e8e2d0', 2, '#7b5cff', 1, { glasses: true, shorts: '#3a2a5a' })],
    pick: ['Hijo, al Templo Dorado, que quiero verlo antes de cenar. A las nueve ceno, como en Valladolid.'],
    ride: ['¡Ay, que me mareo! Pero no frenes, no frenes.', 'Mi nieto dice que esto es como un videojuego. Yo de eso no sé.', '¿Tú has cenado? Tienes cara de no haber cenado.'],
    drop: ['¡Qué bonito, por Dios! Toma, para que os compréis un bocadillo.'],
    late: 'Lo veo mañana, hijo, que se me enfría la sopa.',
  },
  {
    id: 'naia', name: 'Naia', from: 'Donostia', dest: 'mirador', bg: '#00e5ff',
    looks: [L('#f0c8a0', '#ff6fb5', 4, '#36c2b4', 0, { glasses: true, shorts: '#222222' })],
    pick: ['¡Hola! Al Mirador del rascacielos. Necesito LA foto. Mis 312 seguidores me esperan.'],
    ride: ['¿Puedes derrapar otra vez? Es para un vídeo.', 'Pon cara de taxista, que te estoy grabando.', 'Esta luz es top. Bueno, esta no, la de antes.'],
    drop: ['¡Foto perfecta! Os etiqueto. Bueno, no sé vuestro usuario.'],
    late: 'Nada, me hago la foto aquí con una farola. Queda auténtico.',
  },
  {
    id: 'despedida', name: 'La despedida de Mario', from: 'Murcia', dest: 'lagartos', bg: '#ff9f1c', group: true,
    looks: [L('#e0ac7e', '#2b1a12', 1, '#ff9f1c', 0, { cap: '#ff3fa4' }), L('#c68a5e', '#1a1210', 3, '#ff9f1c', 0)],
    pick: ['¡Somos la despedida de Mario! ¡Al Parque de los Lagartos, que queremos foto con uno! —Hola…'],
    ride: ['¿Cabemos cinco? ¡Cabemos cinco!', '¡Mario, que no se te caiga la diadema!', '¡Esta canción la cantamos en la boda! ¡Na-na-na!'],
    drop: ['¡Lagarto a la vista! Mario, ponte tú delante, que eres el novio.'],
    late: '¡Nos bajamos aquí y vamos cantando!',
  },
  {
    id: 'alvaro', name: 'Álvaro', from: 'Madrid', dest: 'chino', bg: '#7ab8ff',
    looks: [L('#e8b48a', '#2b1a12', 0, '#2e4a7d', 3, { shorts: '#c9b29b' })],
    pick: ['Al Barrio Chino. Aunque ya te digo que en Madrid hay más ambiente.'],
    ride: ['Esto en Madrid lo hacemos en la mitad de tiempo. Bueno, con atasco, en el doble.', '¿Esto es tráfico? Ven a la M-30 un viernes.', 'En Madrid también hay neones. Menos, pero más bonitos.'],
    drop: ['Vale… igual aquí hay un poquito más de ambiente. Un poquito.'],
    late: '¿Ves? En Madrid ya habría llegado.',
  },
  {
    id: 'maricarmen', name: 'Mari Carmen', from: 'Cádiz', dest: 'mercado', bg: '#ef476f',
    looks: [L('#d9a274', '#1a1210', 1, '#ef476f', 1, { shorts: '#ffd166' })],
    pick: ['¡Illo, al Mercado Nocturno, que dicen que hay mango con arroz y yo vengo a comer!'],
    ride: ['¡Ay, qué arte tiene el niño conduciendo!', 'Esto huele a pinchito que da gloria.', 'Si en Cádiz hubiera esto, no salía de casa. Bueno, sí: a por esto.'],
    drop: ['¡Mira qué puestos! Si no vuelvo, decidle a mi marido que estoy bien.'],
    late: 'Me bajo, que el olor ya me guía sola.',
  },
  {
    id: 'patxi', name: 'Patxi', from: 'Bilbao', dest: 'estadio', bg: '#e63946', big: true,
    looks: [L('#f0c8a0', '#5a3a1e', 3, '#e63946', 3, { shorts: '#222222' })],
    pick: ['¡Aupa! Al Estadio de Muay Thai, que mañana dicen que pelea un tal {1}.'],
    ride: ['En Bilbao levanto piedras, pero esto da más miedo.', '¿El de atrás eres tú, {1}? Pues estás fino, eh.', 'Tú conduce tranquilo, que yo agarro el techo.'],
    drop: ['¡Mañana vengo a animarte, {1}! ¡Aupa!'],
    late: 'Voy corriendo, que es buen calentamiento.',
  },
];

export const COMPI = {
  drift: ['¡Eso es un derrape!', '¡Huele a rueda quemada!', '¡Como en las pelis!', '¡Más de lado, más de lado!'],
  turbo: ['¡Agarraos!', '¡Turboooo!', '¡Que vuela, que vuela!', '¡Esto no lo hace el tuk-tuk de Somchai!'],
  crash: ['¡Que es alquilado!', '¡Esa pared no estaba!', '¡Perdón, señor coche!', '¡Ay, mi espalda!', '¡Somchai nos mata!'],
  pickup: ['¡Cliente a la vista!', '¡Otro! ¡Que suba, que suba!', 'Sonríe, que dan propina.'],
  hurry: ['¡{0}, que no llegamos!', '¡Corre, que se nos enfada!', '¡Turbo, turbo, TURBO!'],
  police: ['¡Mira el poli, cómo baila!', '¡Ese poli tiene más ritmo que tú!'],
  near: ['¡Por los pelos!', '¡Uy! ¡Casi!', '¡Ni lo ha rozado!'],
  slow: ['¡Más despacio, que te lo pasas!', '¡Frena un poco para que suba!'],
};

export const VENDEDORES = [
  '¡Mango con arroz! ¡Precio de amigo!', '¡Pinchitos, pinchitos!', '¡Zumo de coco fresquito!', '¡Para ti, descuento de tuk-tuk!',
  '¡Pad thai como el de tu abuela! Bueno, de otra abuela.', '¡Lleva dos, el segundo es sonrisa!',
];
export const POLICIA = ['¡Pase, pase!', '¡Con ritmo, por favor!', '¡Un, dos, tres, giro!', '¡Despacito por mi cruce!'];

// Retrato redondo dibujado a mano (sin archivos externos)
export function portrait(t, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), s = size / 96;
  g.fillStyle = t.bg; g.beginPath(); g.arc(48 * s, 48 * s, 47 * s, 0, 7); g.fill();
  const face = (lk, cx, cy, r) => {
    // pelo detrás
    g.fillStyle = lk.hair;
    if (lk.hairStyle === 4) { g.beginPath(); g.ellipse(cx, cy + r * 0.25, r * 1.12, r * 1.2, 0, 0, 7); g.fill(); }
    // camiseta
    g.fillStyle = lk.shirt; g.beginPath(); g.ellipse(cx, cy + r * 1.9, r * 1.35, r * 0.95, 0, Math.PI, 0); g.fill();
    g.fillStyle = lk.skin; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    // pelo
    g.fillStyle = lk.hair;
    if (lk.cap) { g.fillStyle = lk.cap; g.beginPath(); g.arc(cx, cy - r * 0.2, r * 1.02, Math.PI, 0); g.fill(); g.fillRect(cx - r * 0.2, cy - r * 0.32, r * 1.4, r * 0.22); }
    else if (lk.hairStyle === 1) for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.85 - r * 0.1, r * 0.32, 0, 7); g.fill(); }
    else if (lk.hairStyle === 2) { g.beginPath(); g.arc(cx, cy - r * 0.15, r * 1.0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(cx, cy - r * 1.15, r * 0.38, 0, 7); g.fill(); }
    else if (lk.hairStyle === 3) { g.beginPath(); g.arc(cx, cy - r * 0.25, r * 0.98, Math.PI * 1.05, -Math.PI * 0.05); g.fill(); }
    else if (lk.hairStyle === 0) { g.beginPath(); g.arc(cx, cy - r * 0.2, r * 1.0, Math.PI, 0); g.fill(); for (let i = 0; i < 5; i++) { const x = cx - r * 0.7 + i * r * 0.35; g.beginPath(); g.moveTo(x - r * 0.18, cy - r * 0.8); g.lineTo(x, cy - r * 1.35); g.lineTo(x + r * 0.18, cy - r * 0.8); g.fill(); } }
    else { g.beginPath(); g.arc(cx, cy - r * 0.2, r * 1.02, Math.PI, 0); g.fill(); }
    // ojos y boca
    g.fillStyle = '#1b1b22';
    if (lk.glasses) { g.fillRect(cx - r * 0.7, cy - r * 0.15, r * 0.6, r * 0.32); g.fillRect(cx + r * 0.1, cy - r * 0.15, r * 0.6, r * 0.32); g.fillRect(cx - r * 0.12, cy - r * 0.08, r * 0.24, r * 0.08); }
    else { g.beginPath(); g.arc(cx - r * 0.35, cy, r * 0.11, 0, 7); g.arc(cx + r * 0.35, cy, r * 0.11, 0, 7); g.fill(); }
    g.strokeStyle = '#1b1b22'; g.lineWidth = Math.max(1.5, r * 0.1); g.beginPath(); g.arc(cx, cy + r * 0.3, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,90,90,0.35)'; g.beginPath(); g.arc(cx - r * 0.6, cy + r * 0.3, r * 0.15, 0, 7); g.arc(cx + r * 0.6, cy + r * 0.3, r * 0.15, 0, 7); g.fill();
  };
  g.save(); g.beginPath(); g.arc(48 * s, 48 * s, 47 * s, 0, 7); g.clip();
  if (t.couple) { face(t.looks[0], 32 * s, 44 * s, 17 * s); face(t.looks[1], 64 * s, 46 * s, 17 * s); g.fillStyle = '#ff2e6e'; g.font = `${20 * s}px sans-serif`; g.textAlign = 'center'; g.fillText('♥', 48 * s, 26 * s); }
  else if (t.group) { face(t.looks[1], 24 * s, 50 * s, 13 * s); face(t.looks[1], 72 * s, 50 * s, 13 * s); face(t.looks[0], 48 * s, 44 * s, 16 * s); }
  else face(t.looks[0], 48 * s, 44 * s, 22 * s);
  g.restore();
  g.strokeStyle = '#1a1036'; g.lineWidth = 4 * s; g.beginPath(); g.arc(48 * s, 48 * s, 46 * s, 0, 7); g.stroke();
  return c.toDataURL();
}

export const fill = (s, names) => s.replace(/\{0\}/g, names[0]).replace(/\{1\}/g, names[1]);
