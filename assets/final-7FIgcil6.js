import{a0 as s,J as m,W as i,Z as f,a3 as $,a4 as u,a5 as c,a6 as h,_ as g}from"./index-CSJIeI5U.js";function T(e,{onClose:o}={}){const[d,l]=s.data.names,a=s.data.stats,r=Object.keys(s.data.stickers).length,v=e.map(n=>{const t=s.data.stages[n.id]||{},b=isFinite(t.bestTime)?m(t.bestTime):"—";return`<div class="fin-etapa"><span>${n.num}. ${i(n.name)}</span><span class="fin-est">${"★".repeat(t.stars||0)}${"☆".repeat(3-(t.stars||0))}</span><span>${b}</span></div>`}).join("");f.music("final");const p=$("final",`
    <div class="fin-rollo">
      <div class="fin-titulo">LA RUTA</div>
      <div class="fin-lema">Phuket → Shanghái</div>
      <div class="fin-par"><b>${i(d)}</b><span>&amp;</span><b>${i(l)}</b></div>
      <h3>El viaje</h3>
      ${v}
      <h3>En números</h3>
      <div class="fin-nums">
        <div><b>${a.cocos|0}</b> cocos</div>
        <div><b>${a.olas|0}</b> olas saltadas</div>
        <div><b>${a.turistas|0}</b> turistas llevados</div>
        <div><b>${a.golpes|0}</b> golpes en el ring</div>
        <div><b>${a.partidas|0}</b> partidas</div>
        <div><b>${a.fotos|0}</b> fotos</div>
        <div><b>${r}/${u.length}</b> pegatinas</div>
        <div><b>${s.totalStars()}/${e.length*3}</b> estrellas</div>
      </div>
      <h3>Reparto</h3>
      <p>Piloto de scooter, capitán de barca, taxista de tuk-tuk, luchador y maquinista: <b>${i(d)}</b></p>
      <p>Copiloto, navegante, relaciones públicas y fotógrafo oficial: <b>${i(l)}</b></p>
      <p>Monos, perros tumbados, turistas despistados y un taxi muy pesado: <b>ellos mismos</b></p>
      <h3>Gracias</h3>
      <p>A Tailandia y a China, por la comida, el calor y la paciencia.</p>
      <p>Al wifi del avión, por no existir.</p>
      <div class="fin-fin">Fin del viaje.<br><small>De momento.</small></div>
    </div>
    <div class="fin-botones no-ctrl"></div>`);c(200),setTimeout(()=>c(160),2500),h(".fin-botones",p).append(g("Volver al mapa",async()=>{await p.close(),o&&o()},"grande"))}export{T as openFinale};
