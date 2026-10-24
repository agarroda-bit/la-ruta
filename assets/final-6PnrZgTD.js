import{aF as t,T as h,ah as n,aC as $,aI as g,aJ as y,aK as v,aL as o,aD as b}from"./index-YqndTZE_.js";function j(l,{onClose:d}={}){const[r,c]=t.data.names,s=t.data.stats,f=Object.keys(t.data.stickers).length,m=l.map(a=>{const i=t.data.stages[a.id]||{},u=isFinite(i.bestTime)?h(i.bestTime):"—";return`<div class="fin-etapa"><span>${a.num}. ${n(a.name)}</span><span class="fin-est">${"★".repeat(i.stars||0)}<i>${"☆".repeat(3-(i.stars||0))}</i></span><span>${u}</span></div>`}).join("");document.querySelectorAll(".dialogo").forEach(a=>a.remove()),$.music("final");const e=g("final",`
    <div class="fin-rollo">
      <div class="fin-titulo">LA RUTA</div>
      <div class="fin-lema">Phuket → Shanghái</div>
      <div class="fin-par"><b>${n(r)}</b><span>&amp;</span><b>${n(c)}</b></div>
      <h3>El viaje</h3>
      ${m}
      <h3>En números</h3>
      <div class="fin-nums">
        ${[[s.cocos,"cocos"],[s.olas,"olas saltadas"],[s.turistas,"turistas llevados"],[s.golpes,"golpes en el ring"],[s.atajos,"atajos en Macao"],[s.energia,"orbes de energía"],[s.partidas,"partidas"],[s.fotos,"fotos"]].filter(([a])=>(a|0)>0).map(([a,i])=>`<div><b>${a|0}</b> ${i}</div>`).join("")}
        <div><b>${f}/${y.length}</b> pegatinas</div>
        <div><b>${t.totalStars()}/${l.length*3}</b> estrellas</div>
      </div>
      <h3>Reparto</h3>
      <p>Piloto de scooter, capitán de barca, taxista de tuk-tuk, luchador, fugitivo al volante y maquinista: <b>${n(r)}</b></p>
      <p>Copiloto, navegante, relaciones públicas y fotógrafo oficial: <b>${n(c)}</b></p>
      <p>Monos, perros tumbados, turistas despistados y el taxista Zhou de Macao: <b>ellos mismos</b></p>
      <h3>Gracias</h3>
      <p>A Tailandia y a China, por la comida, el calor y la paciencia.</p>
      <p>Al wifi del avión, por no existir.</p>
      <div class="fin-fin">Fin del viaje.<br><small>De momento.</small></div>
      <div class="fin-cierre"></div>
    </div>
    <div class="fin-botones no-ctrl"></div>`);v(200),setTimeout(()=>v(160),2500);const p=async()=>{await e.close(),d&&d()};o(".fin-botones",e).append(b("Saltar ⏭",p,"secundario")),o(".fin-cierre",e).append(b("Volver al mapa ✈",p,"grande")),o(".fin-rollo",e).addEventListener("animationend",()=>{const a=o(".fin-botones",e);a&&(a.style.display="none")})}export{j as openFinale};
