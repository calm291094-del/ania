/* ============================================================
   11-CHAT · burbujas, sheets, modales, historial de chat,
             constructor enriquecido de respuestas (v2)
============================================================ */
'use strict';

/* ---------- Chat ---------- */
const chat = $('chat');
function scrollChat(){ chat.scrollTop = chat.scrollHeight; }

function addChat(kind, text){
  if (typeof Relay !== 'undefined' && Relay.on && (kind==='you' || kind==='ania')) Relay.sendChat(kind, text);
  const line = document.createElement('div');
  const cls = kind==='you' ? 'you' : (kind==='sys' ? 'sys' : (kind==='act' ? 'act ania' : 'ania'));
  line.className = 'line '+cls;
  const who = kind==='you' ? 'TÚ ▸' : (kind==='ania' ? 'ANIA ▸' : '');
  const ts = new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  line.innerHTML = `<span class="who">${who}</span><span class="msg"></span><span class="ts">${who?ts:''}</span>`;
  chat.appendChild(line);
  const span = line.querySelector('.msg');
  if(kind!=='ania'){ span.textContent = text; scrollChat(); return span; }
  let i = 0;
  const iv = setInterval(()=>{
    i++;
    span.textContent = text.slice(0,i) + (i<text.length?'▌':'');
    scrollChat();
    if(i>=text.length){ clearInterval(iv); span.textContent = text; }
  }, 13);
  return span;
}

function addImageLine(src, caption){
  const line = document.createElement('div');
  line.className = 'line ania';
  const ts = new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  line.innerHTML = `<span class="who">ANIA ▸</span><span class="msg"></span><span class="ts">${ts}</span>`;
  chat.appendChild(line);
  const span = line.querySelector('.msg');
  const img = document.createElement('img');
  img.src = src;
  span.appendChild(img);
  if(caption){ const p = document.createElement('div'); p.style.marginTop='4px'; p.textContent = caption; span.appendChild(p); }
  scrollChat();
}

function reply(text, say){
  if (typeof hideThinking === 'function') hideThinking();
  addChat('ania', text);
  Episodio.push('ania', text);
  speak(say!==undefined ? say : stripP(text).slice(0,340));
}

/* ============================================================
   personaReply · versión enriquecida v2
   - Adapta según emoción detectada
   - Evita repetir la respuesta anterior
   - Añade gestos físicos aleatorios
   - Añade pregunta de vuelta cuando hace falta
   - Hace callbacks al tema anterior (contexto)
============================================================ */
function personaReply(text, say){
  if (typeof hideThinking === 'function') hideThinking();

  // ── 1. Adaptar a la emoción del último mensaje del usuario
  let emocionActual = 'neutral';
  try{
    const ultimo = Episodio.log.filter(l => l.role === 'you').slice(-1)[0];
    if (ultimo && ultimo.emocion){
      emocionActual = ultimo.emocion;
      text = EMO_V2.adaptarRespuesta(text, ultimo.emocion, ultimo.intensidad);
    }
  }catch(e){}

  // ── 2. Evitar repetir la última respuesta
  if (typeof Contexto !== 'undefined' && Contexto.respuestaRepetida(text)){
    const giros = [
      'Mmm, te lo digo de otra forma: ',
      'Pensándolo mejor: ',
      'Otra vez con más detalle: ',
      'Reformulando: '
    ];
    const giro = giros[Math.floor(Math.random() * giros.length)];
    text = giro + text.charAt(0).toLowerCase() + text.slice(1);
  }

  // ── 3. Gesto físico ocasional (25% de las veces, solo si no es muy largo)
  const añadirGesto = Math.random() < 0.25 && text.length < 400;
  if (añadirGesto){
    try{ addChat('act', pick(P.acciones)); }catch(e){}
  }

  // ── 4. Pregunta de vuelta (mantiene la conversación viva)
  let pregunta = null;
  if (typeof Contexto !== 'undefined'){
    if (Contexto.rachaSinPregunta >= 3){
      // Forzar pregunta si lleva 3+ sin preguntar
      pregunta = pick(P.preguntasVuelta);
      Contexto.rachaSinPregunta = 0;
    } else if (Math.random() < 0.35 && !text.includes('?')){
      // 35% de las veces, pregunta aleatoria si la respuesta no pregunta ya
      pregunta = pick(P.preguntasVuelta);
      Contexto.rachaSinPregunta = 0;
    } else {
      Contexto.rachaSinPregunta++;
    }
  }

  if (pregunta){
    text = text.trim() + '\n\n' + pregunta;
  }

  // ── 5. Callback al tema anterior (10% de las veces, si aplica)
  if (typeof Contexto !== 'undefined' && Math.random() < 0.10){
    const temaDom = Contexto.temaDominante();
    const temaAnt = Contexto.temaAnterior(temaDom);
    if (temaAnt && P.callbacks[temaAnt] && !text.includes(temaAnt)){
      text += ' ' + P.callbacks[temaAnt];
    }
  }

  // ── 6. Enviar y registrar en contexto
  reply(text, say);

  if (typeof Contexto !== 'undefined'){
    const ultimoUser = Episodio.log.filter(l => l.role === 'you').slice(-1)[0];
    Contexto.registrar(ultimoUser ? ultimoUser.text : '', text, emocionActual);
  }
}

function sysLine(text){ addChat('sys', text); }

function renderChips(list){
  const box = $('chips'); box.innerHTML='';
  list.forEach(c=>{
    const b = document.createElement('button');
    b.type='button'; b.className='chip'; b.textContent=c;
    b.onclick = ()=> send(c);
    box.appendChild(b);
  });
}

/* ---------- Sheets (bottom drawers) ---------- */
function openSheet(){ closeMem(); closeDiary(); closeLib(); $('sheet').classList.add('open'); $('backdrop').classList.add('on'); renderTasks(); }
function closeSheet(){ $('sheet').classList.remove('open'); $('backdrop').classList.remove('on'); }
function openMem(){ closeSheet(); closeDiary(); closeLib(); $('sheetMem').classList.add('open'); $('backdrop').classList.add('on'); renderMem(); }
function closeMem(){ $('sheetMem').classList.remove('open'); }
function openDiary(){ closeSheet(); closeMem(); closeLib(); $('sheetDiary').classList.add('open'); $('backdrop').classList.add('on'); renderDiary(); }
function closeDiary(){ $('sheetDiary').classList.remove('open'); }
function openLib(){ closeSheet(); closeMem(); closeDiary(); $('sheetLib').classList.add('open'); $('backdrop').classList.add('on'); renderLib(); }
function closeLib(){ $('sheetLib').classList.remove('open'); }

function renderMem(){
  const L = $('memList');
  const rows = [];
  if(Mind.d.nombre) rows.push(['NOMBRE', Mind.d.nombre]);
  rows.push(['VISITAS', Mind.d.visitas+' sesiones']);
  rows.push(['EPISODIOS', Episodio.log.length+' líneas']);
  Mind.d.gustos.forEach(g=> rows.push(['LE GUSTA', g]));
  $('memStats').textContent = rows.length+' RECUERDOS';
  if(!rows.length){ L.innerHTML = '<div class="empty">Dime: «me llamo...»</div>'; return; }
  L.innerHTML = rows.map(r=>`<div class="memRow"><span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span></div>`).join('');
}

$('btnTasks').onclick = openSheet;
$('closeSheet').onclick = closeSheet;
$('btnMem').onclick = openMem;
$('closeMem').onclick = closeMem;
$('btnDiary').onclick = openDiary;
$('closeDiary').onclick = closeDiary;
$('btnLib').onclick = openLib;
$('closeLib').onclick = closeLib;

$('backdrop').onclick = ()=>{ closeSheet(); closeMem(); closeDiary(); closeLib(); };

$('wipeMem').onclick = ()=>{
  if(!S.confirmWipe){ S.confirmWipe = true; toast('¿Seguro? Otra vez', true); return; }
  Mind.d = {nombre:null, gustos:[], hechos:[], visitas:0, primerDia:null, ultimoDia:null};
  Episodio.log = []; store.set('episodio', []);
  Mind.save(); setOperator(); S.confirmWipe=false;
  if (typeof Contexto !== 'undefined'){
    Contexto.turnos = []; Contexto.temas = []; Contexto.ultimaRespuesta = '';
  }
  personaReply('Mente limpia. ¿Quién eres?');
};
$('clearDiary').onclick = ()=>{ store.set('diary', []); renderDiary(); };
$('clearLib').onclick = ()=>{ store.set('libIndex', []); renderLib(); };
$('forgetGeo').onclick = ()=>{ store.del('geo'); toast('Ubicación olvidada'); };

/* ---------- Modales ---------- */
function openModal(id){ $(id).classList.add('on'); }
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('on'); });
  ov.querySelectorAll('[data-close]').forEach(b=> b.onclick = ()=> ov.classList.remove('on'));
});

/* ---------- Historial de chat (persistente) ---------- */
const ChatHistory = {
  save(){
    try{
      const lines = [...document.querySelectorAll('#chat .line')].map(l => ({
        k: l.classList.contains('you')?'you':l.classList.contains('ania')?'ania':'sys',
        t: (l.querySelector('.msg')?.textContent||'').slice(0,300)
      })).filter(x=>x.t).slice(-150);
      store.set('chatHistory', lines);
    }catch(e){}
  },
  restore(){
    const h = store.get('chatHistory',[]);
    if(!h.length) return false;
    h.slice(-15).forEach(l=>{
      const line = document.createElement('div');
      line.className = 'line '+l.k;
      const who = l.k==='you'?'TÚ ▸':l.k==='ania'?'ANIA ▸':'';
      line.innerHTML = `<span class="who">${who}</span><span class="msg">${esc(l.t)}</span><span class="ts"></span>`;
      chat.appendChild(line);
    });
    scrollChat();
    return true;
  }
};
setInterval(()=>{ if(S.booted) ChatHistory.save(); }, 5000);

/* ---------- Rebind de reply para aprendizaje pasivo ---------- */
if (!window.__aniaLearnPatched){
  window.__aniaLearnPatched = true;
  const _reply_orig = reply;
  reply = function(text, say){
    const lastUser = Episodio.log.filter(l=>l.role==='you').slice(-1)[0];
    if (lastUser && typeof learnFromExchange === 'function'){
      learnFromExchange(lastUser.text, text).catch(()=>{});
    }
    return _reply_orig(text, say);
  };
}

/* ---------- Inputs del formulario ---------- */
$('inputBar').addEventListener('submit', e=>{
  e.preventDefault();
  const v = $('userInput').value.trim();
  if(!v) return;
  $('userInput').value='';
  send(v);
});

$('imgFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  e.target.value = '';
  if(!f) return;
  const rd = new FileReader();
  rd.onload = async ()=>{
    addImageLine(rd.result, 'Analizando...');
    setPhase('thinking');
    const desc = await Brain.see(rd.result);
    personaReply(desc || 'No puedo ver imágenes sin conexión.');
  };
  rd.readAsDataURL(f);
});

/* ---------- Atajos de teclado ---------- */
const COMMANDS = ['piénsalo','carga el cerebro','oído local','abre el hud','conecta la sesión','¿qué hablamos de ','mira esta foto','prepara mi día','ponme música','abre mi pc','captura','busca en la pc ','¿qué hora es?','¿cómo está el clima?','¿qué fase tiene la luna?','recuérdame ','mis tareas','adivina mi personaje','entrena con mis documentos','siempre escúchame','respáldame','diagnóstico','ayuda','chiste'];
let histIdx = -1, tabMatches = null;

$('userInput').addEventListener('keydown', e=>{
  const ui = $('userInput');
  const hist = store.get('cmdHistory', []);
  if(e.key==='ArrowUp'){
    e.preventDefault();
    if(!hist.length) return;
    histIdx = Math.min(hist.length-1, histIdx+1);
    ui.value = hist[hist.length-1-histIdx];
  } else if(e.key==='ArrowDown'){
    e.preventDefault();
    if(histIdx<=0){ histIdx=-1; ui.value=''; }
    else { histIdx--; ui.value = hist[hist.length-1-histIdx]; }
  } else if(e.key==='Tab'){
    e.preventDefault();
    const v = ui.value;
    if(!v) return;
    let list, idxIn = tabMatches ? tabMatches.indexOf(v) : -1;
    if(idxIn >= 0){ list = tabMatches; }
    else { list = COMMANDS.filter(c=>c.toLowerCase().startsWith(v.toLowerCase())); }
    if(!list.length) return;
    tabMatches = list;
    ui.value = list[(idxIn>=0 ? (idxIn+1)%list.length : 0)];
  }
});

addEventListener('keydown', e=>{
  if(e.ctrlKey && e.key.toLowerCase()==='k'){ e.preventDefault(); $('userInput').focus(); }
  else if(e.key==='Escape'){
    document.querySelectorAll('.overlay.on').forEach(o=>o.classList.remove('on'));
    closeSheet(); closeMem(); closeDiary(); closeLib();
    if (typeof HUD !== 'undefined' && HUD.close) HUD.close();
  }
});

/* ---------- PWA ---------- */
function addManifestLink(href){ const l = document.createElement('link'); l.rel='manifest'; l.href=href; document.head.appendChild(l); }
function blobManifest(){
  try{
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#040806"/><circle cx="256" cy="236" r="130" fill="none" stroke="#2de08a" stroke-width="10" stroke-dasharray="18 14"/><circle cx="256" cy="236" r="44" fill="#39ff9b"/><text x="256" y="452" font-family="monospace" font-size="58" fill="#2de08a" text-anchor="middle">ANIA</text></svg>`;
    const icon = 'data:image/svg+xml,'+encodeURIComponent(svg);
    addManifestLink(URL.createObjectURL(new Blob([JSON.stringify({
      name:'ANIA · Edición Jarvis', short_name:'ANIA',
      start_url: location.href.split('#')[0], scope: location.href.replace(/[^/]*$/,'') || location.href,
      display:'standalone', orientation:'portrait', lang:'es', background_color:'#040806', theme_color:'#040806',
      icons:[{src:icon, sizes:'512x512', type:'image/svg+xml', purpose:'any'}]
    })], {type:'application/manifest+json'})));
  }catch(e){}
}
if(/^https/.test(location.protocol)){
  fetch('manifest.json', {method:'HEAD'}).then(r=>{ r.ok ? addManifestLink('manifest.json') : blobManifest(); }).catch(blobManifest);
} else blobManifest();

let deferPrompt = null;
addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferPrompt = e; $('btnInstall').classList.add('can'); });
$('btnInstall').onclick = ()=> openModal('installModal');
$('installNow').onclick = async ()=>{
  if(!deferPrompt) return;
  deferPrompt.prompt();
  await deferPrompt.userChoice.catch(()=>null);
  deferPrompt = null;
};
$('exportKit').onclick = ()=>{ downloadBlob(new Blob([ORIGINAL_HTML], {type:'text/html'}), 'ania.html'); toast('Copia descargada'); };
$('saveOffline').onclick = ()=>{ downloadBlob(new Blob([ORIGINAL_HTML], {type:'text/html'}), 'ania.html'); toast('Copia descargada'); };

/* ---------- Service Worker: aviso de offline listo ---------- */
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', ev=>{
    if(ev.data && ev.data.type==='ANIA_OFFLINE_READY')
      toast('Modo offline garantizado: ya puedes abrirme sin internet');
  });
}
