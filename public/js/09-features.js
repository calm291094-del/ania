/* ============================================================
   09-FEATURES · tareas, clima, sync, diario, akinator, proactividad,
                 github, pomodoro, trivia, aliases, backup
============================================================ */
'use strict';

/* ---------- TAREAS ---------- */
let tasks = store.get('tasks', []);
const timers = new Map();
function saveTasks(){ store.set('tasks', tasks); }
function taskPending(){ return tasks.filter(t=>!t.done).length; }
function fmtWhen(when){
  if(!when) return '· sin hora';
  const d = new Date(when), diff = when - Date.now();
  if(diff > 0){
    if(diff < 6e4) return '· en '+Math.max(1,Math.round(diff/1e3))+' s';
    if(diff < 36e5) return '· en '+Math.round(diff/6e4)+' min';
    if(diff < 864e5) return '· en '+Math.round(diff/36e5)+' h';
  } else if(diff <= 0 && diff > -36e5) return '· vencida';
  return '· '+d.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
}
function recurLabel(r){
  if(r==='daily') return 'todos los días';
  if(r==='weekdays') return 'laborables';
  if(r && r[0]==='w'){ const D=['domingo','lunes','martes','miércoles','jueves','viernes','sábado']; return 'cada '+D[+r.slice(1)]; }
  return '';
}
function parseRecur(nl){
  if(/todos\s+los\s+dias|cada\s+dia\b|diario\b/.test(nl)) return 'daily';
  const m = nl.match(/(?:todos\s+los\s+|cada\s+)(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)/);
  if(m){ const D={lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6,domingo:0}; return 'w'+D[m[1]]; }
  return null;
}
function nextRecur(when, recur){
  const d = new Date(when);
  do { d.setDate(d.getDate()+1); } while(recur && recur[0]==='w' && d.getDay() !== +recur.slice(1));
  return d.getTime();
}
function renderTasks(){
  const list = $('taskList'); if(!list) return;
  list.innerHTML='';
  const pend = taskPending();
  $('taskCount').textContent = pend+' PENDIENTES';
  $('taskBadge').textContent = pend; $('taskBadge').classList.toggle('on', pend>0);
  if(!tasks.length){ list.innerHTML = '<div class="empty">AGENDA VACÍA</div>'; return; }
  const orden = [...tasks].sort((a,b)=> (a.done-b.done) || ((a.when||9e15)-(b.when||9e15)));
  orden.forEach(tk=>{
    const row = document.createElement('div');
    row.className = 'task'+(tk.done?' done':'');
    const via = tk.notifyVia || (tk.source==='telegram' ? 'telegram' : 'web');
    const viaTag = via==='telegram' ? '<span class="tsrc tg">TG</span>' : '<span class="tsrc web">WEB</span>';
    const recTag = tk.recur ? '<span class="tsrc rec">'+recurLabel(tk.recur).toUpperCase()+'</span>' : '';
    row.innerHTML = `
      <button class="tsmall tcheck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></button>
      <div class="tmain"><div class="ttext">${esc(tk.text)}${viaTag}${recTag}</div><div class="twhen">${fmtWhen(tk.when)}</div></div>
      <button class="tsmall tdel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg></button>`;
    row.querySelector('.tcheck').onclick = ()=>{
      tk.done = !tk.done;
      if (tk.done) { tk.completadoEn = Date.now(); cancelTimer(tk.id); Sync.markDone(tk); }
      else { tk.completadoEn = null; }
      saveTasks(); renderTasks();
    };
    row.querySelector('.tdel').onclick = ()=>{
      cancelTimer(tk.id);
      tasks = tasks.filter(t=>t.id!==tk.id);
      saveTasks(); renderTasks();
    };
    list.appendChild(row);
  });
}
function cancelTimer(id){ if(timers.has(id)){ clearTimeout(timers.get(id)); timers.delete(id); } }
function addTask(text, when, opts){
  const tk = {
    id: Date.now()+'-'+Math.random().toString(36).slice(2,6),
    text, when, done:false, fired:false,
    source:(opts&&opts.source)||'web',
    recur:(opts&&opts.recur)||null,
    notifyVia:'web', owner:DEVICE_ID, pendingSync:true,
    categoria:(opts&&opts.categoria)||'general', completadoEn:null
  };
  tasks.push(tk);
  saveTasks(); renderTasks(); scheduleTask(tk);
  Sync.pushTask(tk).catch(()=>{});
  return tk;
}
function scheduleTask(tk){
  if(!tk.when || tk.done || (tk.fired && !tk.recur)) return;
  cancelTimer(tk.id);
  const delay = tk.when - Date.now();
  if(delay <= 0){ fireTask(tk); return; }
  timers.set(tk.id, setTimeout(()=>fireTask(tk), delay));
}
function fireTask(tk){
  if(tk.done || (tk.fired && !tk.recur)) return;
  ensureAudio(); alarmSound(); vibrate([200,100,200]);
  toast('Recordatorio: '+tk.text);
  notify('ANIA · Recordatorio', tk.text, { tag: 'task-'+tk.id, important: true });
  if(tk.recur){
    reply('Recordatorio: '+tk.text+'. '+recurLabel(tk.recur)+'.', 'Recordatorio: '+tk.text);
    tk.when = nextRecur(tk.when, tk.recur); tk.fired=false; scheduleTask(tk);
  } else {
    tk.fired = true;
    reply('Recordatorio: '+tk.text+'. «pospón 10 minutos».', 'Recordatorio: '+tk.text);
  }
  saveTasks(); renderTasks();
}

function notify(title, body, opts){
  try{
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const o = opts || {};
    const n = new Notification(title, {
      body, icon: './icon.svg', badge: './icon.svg',
      tag: o.tag || 'ania',
      requireInteraction: !!o.important,
      vibrate: [180,80,180]
    });
    n.onclick = ()=>{ try{ window.focus(); }catch(e){} n.close(); };
    setTimeout(()=>{ try{ n.close(); }catch(e){} }, o.important ? 20000 : 8000);
    return true;
  }catch(e){ return false; }
}
function actualizarBotonNotif(){
  const b = $('btnNotif'); if (!b) return;
  if (!('Notification' in window)){ b.textContent = 'NOTIFICACIONES NO SOPORTADAS'; return; }
  const p = Notification.permission;
  if (p === 'granted') b.textContent = 'NOTIFICACIONES: ACTIVAS';
  else if (p === 'denied') b.textContent = 'NOTIFICACIONES: BLOQUEADAS';
  else b.textContent = 'ACTIVAR NOTIFICACIONES';
}
async function pedirPermisoNotif(){
  if (!('Notification' in window)) return toastError('Tu navegador no soporta notificaciones');
  if (Notification.permission === 'granted'){ toast('Ya tienes notificaciones activas'); return; }
  if (Notification.permission === 'denied'){ toastError('Bloqueadas en el navegador. Actívalas en la barra de URL.'); return; }
  try{
    const p = await Notification.requestPermission();
    actualizarBotonNotif();
    if (p === 'granted'){
      toast('Notificaciones activadas');
      setTimeout(()=> notify('ANIA', 'Notificaciones activadas. Te avisaré aunque no estés mirando.', { tag:'welcome' }), 400);
    } else {
      toastError('Permiso denegado');
    }
  }catch(e){ toastError('No pude pedir permiso'); }
}
if ($('btnNotif')) $('btnNotif').addEventListener('click', pedirPermisoNotif);
setTimeout(actualizarBotonNotif, 1500);

$('addTaskBtn').onclick = ()=>{
  const text = $('taskInput').value.trim();
  if(!text) return;
  addTask(text, $('taskWhen').value ? new Date($('taskWhen').value).getTime() : null);
  $('taskInput').value=''; $('taskWhen').value='';
};

/* ---------- SYNC ---------- */
const Sync = {
  online:false, syncing:false,
  async check(){
    try{
      const c = new AbortController();
      const t = setTimeout(()=>c.abort(), 7000);
      // ⭐ FIX #7 · /health → /ania/health
      const r = await fetch(CONFIG.BACKEND_URL+'/ania/health', {signal:c.signal});
      clearTimeout(t);
      this.online = r.ok;
    }catch{ this.online = false; }
    this.paint();
  },
  paint(){ $('syncPill').classList.toggle('idle', !this.online); $('syncTxt').textContent = this.online ? 'SYNC' : 'OFF'; },
  async pushTask(tk){
    if(!this.online) return false;
    try{
      const r = await fetch(CONFIG.BACKEND_URL+'/ania/tasks', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ texto:tk.text, remindAt: tk.when?new Date(tk.when).toISOString():null, usuario:CONFIG.ANIA_USER, source:'web', recur:tk.recur||null, notifyVia:'web', owner:DEVICE_ID })
      });
      if(!r.ok) throw 0;
      tk.serverId = (await r.json()).id; tk.pendingSync = false; saveTasks();
      return true;
    }catch(e){ return false; }
  },
  async markDone(tk){
    if(!this.online || !tk.serverId) return;
    try{ await fetch(CONFIG.BACKEND_URL+'/ania/tasks/'+tk.serverId, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({done:true})}); }catch(e){}
  },
  async pullTasks(){
    if(!this.online) return 0;
    try{
      const r = await fetch(CONFIG.BACKEND_URL+'/ania/tasks?user='+CONFIG.ANIA_USER);
      if(!r.ok) return 0;
      const remote = await r.json();
      if(!Array.isArray(remote)) return 0;
      const localIds = new Set(tasks.flatMap(t=>[t.id, t.serverId].filter(Boolean)));
      const nuevas = remote.filter(t=>!localIds.has(t.id));
      let added = 0;
      for(const r of nuevas){
        const via = r.notifyVia || (r.source==='telegram'?'telegram':'web');
        tasks.push({ id:'srv-'+r.id, serverId:r.id, text:r.texto, when:r.remindAt?new Date(r.remindAt).getTime():null, done:!!r.done, fired:false, source:r.source||'telegram', recur:r.recur||null, notifyVia:via, owner:r.owner, pendingSync:false });
        added++;
      }
      if(added>0){ saveTasks(); renderTasks(); toast(added+' desde Telegram'); }
      return added;
    }catch(e){ return 0; }
  },
  async fullSync(){
    if(this.syncing) return;
    this.syncing = true;
    try{
      await this.check();
      if(this.online){
        for(const tk of tasks){ if(tk.pendingSync && !tk.serverId && !tk.done) await this.pushTask(tk); }
        await this.pullTasks();
      }
    } finally { this.syncing = false; }
  }
};
Sync.check();
async function initSyncLoop(){ await Sync.fullSync(); setInterval(()=>Sync.fullSync(), CONFIG.SYNC_INTERVAL); }

/* ---------- CLIMA / GEO ---------- */
function geoCache(){ return store.get('geo', null); }
function getPosition(t=10000){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation) return rej(new Error('no'));
    navigator.geolocation.getCurrentPosition(res,rej,{timeout:t});
  });
}
async function reverseGeo(lat,lon){
  try{
    const d = await jget(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es&zoom=10`);
    const a = d.address||{};
    return {city: a.city||a.town||a.village||a.county||'tu zona', country:a.country||''};
  }catch(e){ return {city:'tu zona', country:''}; }
}
async function locate(){
  try{
    const p = await getPosition();
    const rc = await reverseGeo(p.coords.lat, p.coords.lon);
    const g = {lat:p.coords.lat, lon:p.coords.lon, city:rc.city, t:Date.now()};
    store.set('geo', g);
    return g;
  }catch(e){ return null; }
}
const WMO = {0:'despejado',1:'despejado',2:'parcial',3:'nublado',45:'niebla',51:'llovizna',61:'lluvia ligera',63:'lluvia',65:'lluvia fuerte',80:'chubascos',95:'tormenta',96:'tormenta',99:'tormenta'};
async function getWeather(g){
  const key = Math.round(g.lat*50)+'_'+Math.round(g.lon*50);
  const wc = store.get('wx_'+key, null);
  if(wc && Date.now()-wc.t < 600000) return wc.data;
  const d = await jget(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&hourly=precipitation&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
  store.set('wx_'+key, {t:Date.now(), data:d});
  return d;
}
function weatherText(g,d){
  const c = d.current;
  return `En ${g.city}: ${Math.round(c.temperature_2m)}°C (sensación ${Math.round(c.apparent_temperature)}°C), ${WMO[c.weather_code]||'variable'}. Humedad ${c.relative_humidity_2m}%.`;
}
function updateChip(g,d){ $('wTxt').textContent = Math.round(d.current.temperature_2m)+'°'; setWeatherMode(d.current.weather_code); }
async function weatherIntent(){
  if(isOffline()){
    const g = geoCache();
    if(g){ try{ const d = await getWeather(g); updateChip(g,d); return personaReply(weatherText(g,d)+' (caché).'); }catch(e){} }
    return personaReply('Sin conexión y sin clima en caché.');
  }
  setPhase('thinking');
  let g = geoCache();
  if(!g || Date.now()-g.t > 864e5) g = await locate();
  if(!g){ S.awaitingCity = true; return personaReply('No pude obtener tu ubicación. Dime una ciudad.'); }
  try{ const d = await getWeather(g); updateChip(g,d); personaReply(weatherText(g,d)); }
  catch(e){ personaReply('No pude conectar con el clima.'); }
}
async function weatherForCity(name){
  setPhase('thinking');
  try{
    const d = await jget(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(name)}&limit=1&accept-language=es`);
    if(!d || !d[0]) return personaReply('No encontré esa ciudad.');
    const g = {lat:+d[0].lat, lon:+d[0].lon, city:d[0].name||name, t:Date.now()};
    store.set('geo', g);
    const w = await getWeather(g);
    updateChip(g,w);
    personaReply(weatherText(g,w));
  }catch(e){ personaReply('No pude conectar.'); }
}
$('weatherChip').onclick = ()=> weatherIntent();

/* ---------- BIBLIOTECA ---------- */
const Library = {
  index(){ return store.get('libIndex', []); },
  save(term, extract){
    const id = 'lib_'+term.toLowerCase().replace(/[^a-z0-9]+/gi,'-').slice(0,42);
    store.set(id, {id, term, extract, t:Date.now()});
    let idx = this.index().filter(e=>e.id!==id);
    idx.unshift({id, term, t:Date.now()});
    if(idx.length>120) store.del(idx.pop().id);
    store.set('libIndex', idx);
  },
  find(term){
    term = LINGUA.normalizar(term);
    if(!term) return null;
    const hit = this.index().find(e=>{ const t = LINGUA.normalizar(e.term); return t===term || t.includes(term) || term.includes(t); });
    return hit ? store.get(hit.id, null) : null;
  }
};
function renderLib(){
  const L = $('libList');
  const idx = Library.index();
  $('libCount').textContent = idx.length+' ARTÍCULOS';
  if(!idx.length){ L.innerHTML = '<div class="empty">VACÍA</div>'; return; }
  L.innerHTML = idx.map(e=>`<div class="libRow"><div class="lmain"><div class="ltitle">${esc(e.term)}</div><div class="ldate">${new Date(e.t).toLocaleDateString('es-ES')}</div></div><button class="tsmall" data-read="${esc(e.id)}" style="color:var(--dim)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg></button></div>`).join('');
  L.querySelectorAll('[data-read]').forEach(b=> b.onclick = ()=>{ const e = store.get(b.dataset.read, null); if(e) personaReply(e.extract); });
}
async function wikiSummary(term){
  try{
    const d = await jget('https://es.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(term));
    if(d && d.extract) return {extract:d.extract};
  }catch(e){}
  return null;
}
async function doSearch(term){
  if(isOffline()){
    const lib = Library.find(term);
    if(lib) return personaReply(lib.extract+'\n[de tu biblioteca]');
    return personaReply(LocalMind.think(term, LINGUA.normalizar(term)));
  }
  setPhase('thinking');
  const w = await wikiSummary(term);
  if(w){
    let txt = w.extract.slice(0,620);
    Library.save(term, txt);
    personaReply(txt + '\n[Wikipedia · guardado]');
    return;
  }
  personaReply('No encontré nada sobre «'+term+'».');
}

/* ---------- DIARIO ---------- */
function bumpStat(k){
  const day = new Date().toISOString().slice(0,10);
  let st = store.get('dayStats', null);
  if(!st || st.date!==day) st = {date:day, msgs:0, tasksDone:0, fired:0};
  st[k] = (st[k]||0)+1;
  store.set('dayStats', st);
}
const Diary = {
  today(){ return new Date().toISOString().slice(0,10); },
  touch(){
    let st = store.get('dayStats', null);
    if(!st || st.date!==this.today()) st = {date:this.today(), msgs:0, tasksDone:0, fired:0};
    let text = 'Día con '+(Mind.nombre()||'operador')+' · '+st.msgs+' msgs · '+st.tasksDone+' tareas';
    if(Brain.localReady) text += ' · cerebro local';
    if(Ears.on) text += ' · oído local';
    const data = store.get('diary', []);
    const idx = data.findIndex(e=>e.day===this.today());
    if(idx>=0) data[idx].text = text; else data.push({day:this.today(), text});
    store.set('diary', data.slice(-40));
  }
};
function renderDiary(){
  const L = $('diaryList');
  const data = [...store.get('diary', [])].reverse();
  $('diaryCount').textContent = data.length+' ENTRADAS';
  if(!data.length){ L.innerHTML = '<div class="empty">VACÍO</div>'; return; }
  L.innerHTML = data.map(e=>`<div class="diaryRow"><div class="dDate">${esc(e.day)}</div><div class="dText">${esc(e.text)}</div></div>`).join('');
}
setInterval(()=>{ if(S.booted) Diary.touch(); }, 90000);

/* ---------- AKINATOR ---------- */
const AK_CHARS = [
  {n:'Rimuru', f:0, mon:1, rei:1, mag:1, esp:0, com:1, her:1},
  {n:'Ainz', f:0, mon:1, rei:1, mag:1, esp:0, com:0, her:1},
  {n:'Subaru', f:0, mon:0, rei:1, mag:0, esp:0, com:0, her:1},
  {n:'Kazuma', f:0, mon:0, rei:1, mag:0, esp:0, com:1, her:1},
  {n:'Naofumi', f:0, mon:0, rei:1, mag:1, esp:0, com:0, her:1},
  {n:'Rem', f:1, mon:1, rei:0, mag:0, esp:1, com:0, her:0},
  {n:'Raphtalia', f:1, mon:1, rei:0, mag:0, esp:1, com:0, her:0},
  {n:'Albedo', f:1, mon:1, rei:0, mag:1, esp:0, com:0, her:0},
  {n:'Asuna', f:1, mon:0, rei:0, mag:0, esp:1, com:0, her:1},
  {n:'Tanya', f:1, mon:0, rei:1, mag:1, esp:0, com:0, her:0},
  {n:'Kirito', f:0, mon:0, rei:0, mag:0, esp:1, com:0, her:1},
  {n:'Cid', f:0, mon:0, rei:0, mag:1, esp:0, com:1, her:1},
  {n:'Sora y Shiro', f:0, mon:0, rei:0, mag:0, esp:0, com:1, her:1},
  {n:'Megumin', f:1, mon:0, rei:0, mag:1, esp:0, com:1, her:0}
];
const AK_QS = [['f','¿Es mujer?'],['mon','¿Es un monstruo?'],['rei','¿Fue reencarnada?'],['mag','¿Usa magia?'],['esp','¿Es espadachina?'],['com','¿Su serie es comedia?'],['her','¿Es protagonista?']];
const AK = { active:false, await:false, pool:[], asked:[], guess:null };
function akStart(){ AK.active=true; AK.await=false; AK.pool=AK_CHARS.slice(); AK.asked=[]; akNext(); }
function akNext(){
  if(!AK.pool.length){ AK.active=false; return personaReply('Sin candidatos. ¿Quién era?'); }
  if(AK.pool.length===1){ AK.guess=AK.pool[0]; AK.await=true; return personaReply('Ya lo tengo... ¿Es '+AK.guess.n+'?'); }
  const avail = AK_QS.filter(q=>!AK.asked.includes(q[0]));
  if(!avail.length){ AK.guess=AK.pool[0]; AK.await=true; return personaReply('¿Es '+AK.guess.n+'?'); }
  let best = avail[0], bs = 1e9;
  for(const q of avail){ const yes = AK.pool.filter(c=>c[q[0]]).length; const s = Math.abs(yes-(AK.pool.length-yes)); if(s<bs){ bs=s; best=q; } }
  AK.asked.push(best[0]);
  personaReply('Pregunta '+AK.asked.length+': '+best[1]);
}
function akAnswer(v){
  const q = AK_QS.find(x=>x[0]===AK.asked[AK.asked.length-1]);
  if(!q) return akNext();
  if(v===1) AK.pool = AK.pool.filter(c=>c[q[0]]);
  else if(v===0) AK.pool = AK.pool.filter(c=>!c[q[0]]);
  return akNext();
}

/* ---------- PROACTIVIDAD ---------- */
async function rainInMinutes(){
  const g = geoCache();
  if(!g) return null;
  try{
    const d = await getWeather(g);
    if(!d.hourly || !d.hourly.time) return null;
    const now = Date.now();
    for(let i=0; i<Math.min(6, d.hourly.time.length); i++){
      const t = new Date(d.hourly.time[i]).getTime();
      if(t < now - 36e5) continue;
      if((d.hourly.precipitation && d.hourly.precipitation[i]||0) > 0.3) return Math.max(0, Math.round((t-now)/6e4));
    }
    return null;
  }catch(e){ return null; }
}
const Proactive = {
  cool:{}, flags: store.get('proactiveFlags', {}),
  start(){ setInterval(()=>this.check(), 60000); },
  coolOk(id, ms){ const t=this.cool[id]||0; if(Date.now()-t<ms) return false; this.cool[id]=Date.now(); return true; },
  onceDay(id){ const d = new Date().toDateString(); if(this.flags[id]===d) return false; this.flags[id]=d; store.set('proactiveFlags', this.flags); return true; },
  async check(){
    if(!S.booted || !store.get('proactivo', true)) return;
    if(document.visibilityState !== 'visible') return;
    const h = new Date();
    const rain = await rainInMinutes();
    if(rain!==null && rain<=45 && this.coolOk('rain', 3*36e5)){
      personaReply('(mira el cielo) Aviso: llueve en '+rain+' minutos. Paraguas.', 'Aviso: llueve en '+rain+' minutos.');
    }
    if(S.batt && !S.batt.charging && S.batt.level < 0.2 && this.coolOk('batt', 6*36e5)){
      personaReply('Batería al '+Math.round(S.batt.level*100)+'%. Conéctame.');
    }
    if(S.lastUserTs && Date.now()-S.lastUserTs > 45*6e4 && !ttsActive && this.coolOk('idle', 2*36e5) && Math.random()<0.6){
      personaReply(pick(['(te mira de reojo) ¿Sigue ahí?','Silencio largo. «ponme música» si quieres.']));
    }
    if(h.getHours()===23 && h.getMinutes()>=30 && this.onceDay('bed')){
      personaReply('Regla 4: a dormir. Que mañana sea bonito.', 'Es hora de dormir.');
    }
    const venc = tasks.filter(t=>!t.done && t.when && t.when < Date.now()).length;
    if(venc>0 && h.getHours()>=20 && this.onceDay('over')){
      personaReply(venc+' tarea(s) vencida(s). «tarea hecha» o «pospón».');
    }
  }
};

/* ---------- GITHUB SYNC ---------- */
const GitHub = {
  token: store.get('ghToken', null),
  async api(path, method, body){
    const url = `https://api.github.com/repos/calm291094-del/ania/${path}`;
    const headers = {'Authorization':`token ${this.token}`,'Accept':'application/vnd.github.v3+json'};
    if(body) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, {method, headers, body: body?JSON.stringify(body):undefined});
    if(r.status===401){ this.token=null; store.del('ghToken'); throw new Error('Token inválido'); }
    if(r.status===404) return null;
    if(!r.ok) throw new Error('GH '+r.status);
    return r.status===204 ? null : r.json();
  },
  async readFile(path){
    const d = await this.api('contents/'+path);
    if(!d) return null;
    return {content: atob(d.content.replace(/\n/g,'')), sha: d.sha};
  },
  async writeFile(path, content, message){
    let sha = null;
    try { const d = await this.api('contents/'+path); if (d && d.sha) sha = d.sha; } catch(e){}
    const body = {
      message: message || 'Ania: ' + new Date().toISOString(),
      content: btoa(unescape(encodeURIComponent(content)))
    };
    if (sha) body.sha = sha;
    return await this.api('contents/'+path, 'PUT', body);
  },
  async connect(token){
    this.token = token;
    store.set('ghToken', token);
    try {
      const r = await fetch('https://api.github.com/repos/calm291094-del/ania', {
        headers: {'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json'}
      });
      if (r.status === 401 || r.status === 403) { this.token = null; store.del('ghToken'); return { ok: false, error: 'Token inválido o sin permisos' }; }
      if (r.status === 404) { return { ok: false, error: 'Repo no encontrado' }; }
      if (!r.ok) { return { ok: false, error: 'GitHub: ' + r.status }; }
      try {
        await this.writeFile('documentos/conexion.txt', 'Conexión: '+new Date().toISOString(), 'Ania: verificar');
        const gp = $('ghPill'); if (gp) gp.style.display = 'inline-flex';
        return { ok: true };
      } catch(e) {
        const gp = $('ghPill'); if (gp) gp.style.display = 'inline-flex';
        return { ok: true, warn: 'Conectado sin escritura. Verifica scope: repo.' };
      }
    } catch(e) {
      this.token = null; store.del('ghToken');
      return { ok: false, error: 'No pude conectar: ' + e.message };
    }
  },
  async pull(){
    if(!this.token) return null;
    try{
      const d = await this.readFile('documentos/aprendido.json');
      if(d){
        const learned = JSON.parse(d.content);
        let merged = store.get('learned', []);
        if(Array.isArray(learned)) learned.forEach(l=>{ if(!merged.find(m=>m.texto===l.texto)) merged.push(l); });
        store.set('learned', merged);
        return learned;
      }
    }catch(e){}
    return null;
  },
  async push(){
    if(!this.token) return false;
    try {
      const learned = store.get('learned', []);
      if(!learned.length) return true;
      await this.writeFile('documentos/aprendido.json', JSON.stringify(learned, null, 2), 'Ania: aprendiendo');
      return true;
    } catch(e) { console.error('[GitHub] Push error:', e.message); return false; }
  }
};
(function(){
  const p = document.createElement('span');
  p.className = 'pill'; p.id='ghPill'; p.style.display='none';
  p.innerHTML = '<span class="dot"></span><span>GITHUB</span>';
  const op = $('operator');
  if (op) op.parentNode.insertBefore(p, op);
  if(GitHub.token) p.style.display = 'inline-flex';
})();

/* ---------- APRENDIZAJE ---------- */
const Learned = {
  list: store.get('learned', []),
  add(texto, categoria){
    this.list.push({texto, categoria: categoria||'general', t:Date.now()});
    store.set('learned', this.list);
    if(GitHub.token) GitHub.push().catch(()=>{});
  },
  search(q){
    const w = LINGUA.normalizar(q).split(' ').filter(x=>x.length>2);
    let best=null, bs=0;
    for(const l of this.list){
      const lw = LINGUA.normalizar(l.texto);
      let s=0;
      for(const x of w) if(lw.includes(x)) s+=2;
      if(s>bs){ bs=s; best=l; }
    }
    return bs>=2 ? best : null;
  },
  count(){ return this.list.length; }
};

/* ---------- IMÁGENES ---------- */
async function generateImage(prompt){
  if(isOffline()) return personaReply('Generar imágenes necesita internet.');
  showThinking();
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true';
  addImageLine(url, 'Generando: ' + prompt);
  hideThinking();
  personaReply('Ahí está. ¿Cambios? «dibújame [otra cosa]».');
}

/* ---------- POMODORO ---------- */
const Pomodoro = {
  running:false, mode:'work', remaining:0, timer:null,
  sessions: store.get('pomodoro_sessions', 0),
  start(min){
    if(this.running) this.stop();
    this.running=true; this.mode='work'; this.remaining=min*60;
    this.tick();
    if(typeof wakeOn==='function') wakeOn();
    toast('Pomodoro: '+min+' min');
  },
  tick(){
    if(!this.running) return;
    this.remaining--;
    document.title = `ANIA · ${Math.floor(this.remaining/60)}:${String(this.remaining%60).padStart(2,'0')}`;
    if(this.remaining<=0){
      ensureAudio(); alarmSound(); vibrate([200,100,200]);
      this.sessions++; store.set('pomodoro_sessions', this.sessions);
      if(this.mode==='work'){ this.mode='break'; this.remaining=300; reply('Pomodoro completado ('+this.sessions+'). 5 min de descanso.','Pomodoro completado.'); }
      else { this.mode='work'; this.remaining=1500; reply('Descanso terminado. ¿Otra ronda?','Descanso terminado.'); }
    }
    this.timer = setTimeout(()=>this.tick(), 1000);
  },
  stop(){ this.running=false; clearTimeout(this.timer); document.title='ANIA · Edición Jarvis'; }
};

/* ---------- TRIVIA ---------- */
const TRIVIA_DATA = [
  {cat:'ISEKAI', q:'¿Quién construye una nación para monstruos?', a:'Rimuru Tempest'},
  {cat:'ISEKAI', q:'¿Qué poder tiene Subaru?', a:'Return by Death'},
  {cat:'ISEKAI', q:'¿Qué representa Ainz?', a:'La soledad del poder absoluto'},
  {cat:'CAFÉ', q:'¿Perfil del Yirgacheffe?', a:'Jazmín, bergamota y limón'},
  {cat:'CAFÉ', q:'¿Café para programar?', a:'Kenia AA en Aeropress'},
  {cat:'ASTRO', q:'¿Qué es la materia oscura?', a:'El mana del universo real'},
  {cat:'ASTRO', q:'¿Constelación favorita?', a:'Orión'},
  {cat:'ASTRO', q:'¿Qué son las nebulosas?', a:'Viveros estelares'},
  {cat:'ZOMBIES', q:'¿Regla 32?', a:'Disfrutar las pequeñas cosas'},
  {cat:'ZOMBIES', q:'¿Regla 1?', a:'Cardio'},
  {cat:'ZOMBIES', q:'¿Regla 2?', a:'Double Tap'},
  {cat:'TECH', q:'¿Qué es programar?', a:'Invocar magia con lógica'},
  {cat:'ANIA', q:'¿Cumpleaños?', a:'26 de enero'},
  {cat:'ANIA', q:'¿Qué animal sería?', a:'Panda'},
  {cat:'ANIA', q:'¿Lema?', a:'Pan café y anime'}
];
const Trivia = {
  active:false, pool:[], current:null, score:0, streak:0, used: store.get('trivia_used',[]),
  start(){
    this.active=true; this.score=0; this.streak=0;
    this.pool = TRIVIA_DATA.filter((_,i)=>!this.used.includes(i));
    if(!this.pool.length){ this.used=[]; store.set('trivia_used',[]); this.pool=TRIVIA_DATA.slice(); }
    this.next();
  },
  next(){
    if(!this.active) return;
    if(!this.pool.length){ this.active=false; return personaReply('Trivia: '+this.score+' aciertos, racha '+this.streak+'.'); }
    this.current = this.pool.splice(Math.floor(Math.random()*this.pool.length),1)[0];
    this.used.push(TRIVIA_DATA.indexOf(this.current));
    if(this.used.length>TRIVIA_DATA.length-3) this.used=[];
    store.set('trivia_used',this.used);
    personaReply('[TRIVIA · '+this.current.cat+'] '+this.current.q+' | Puntos: '+this.score+' Racha: '+this.streak);
  },
  answer(text){
    if(!this.active||!this.current) return false;
    const low = LINGUA.normalizar(text);
    const correct = LINGUA.normalizar(this.current.a);
    if(low.includes(correct.split(' ')[0]) || correct.split(' ').some(w=>w.length>4&&low.includes(w))){
      this.score++; this.streak++;
      personaReply('✓ Correcto: '+this.current.a+'. Siguiente...');
      setTimeout(()=>this.next(),800);
    } else {
      this.streak=0; this.active=false;
      personaReply('✗ Era: '+this.current.a+'. Di «trivia» para reiniciar.');
    }
    return true;
  }
};

/* ---------- ALIAS DE COMANDOS ---------- */
let COMANDOS_ALIAS = {};

async function cargarAlias(){
  try{
    const r = await fetch('./data/comandos-alias.json');
    COMANDOS_ALIAS = await r.json();
    console.log('📚 Alias cargados:', Object.keys(COMANDOS_ALIAS).length, 'comandos');
  }catch(e){
    console.warn('Alias no disponibles:', e.message);
  }
}
function normalizeCommand(mensaje){
  const low = mensaje.toLowerCase().trim();
  for (const [cmd, alias] of Object.entries(COMANDOS_ALIAS)){
    for (const a of alias){
      if (low.startsWith(a.toLowerCase())) return { cmd, alias: a };
    }
  }
  return null;
}
function manejarComandoAlias(cmd, mensaje){
  switch (cmd) {
    case 'ayuda':
      return '📚 **COMANDOS DISPONIBLES**\n\n· /tareas · /pendientes\n· /agregar_tarea [texto]\n· /completar_tarea [ID]\n· /modelo · /ia\n· /emocion · /estado_emocional\n· /historial · /memoria\n· /hora · /clima\n· /chiste · /cita\n· /modo [amigable|profesional|divertido]\n· /personalidad · /estado\n· /conexion · /ip\n\n💡 Todos los comandos tienen varios alias.';
    case 'hora':
      return '🕐 Son las ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) +
             ' del ' + new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
    case 'chiste': {
      const chistes = [
        '¿Qué le dice un semáforo a otro? ¡No me mires, me estoy cambiando! 🚦',
        '¿Por qué los pájaros no usan Facebook? ¡Porque ya tienen Twitter! 🐦',
        '¿Cómo se despiden los químicos? Ácido un placer 👋',
        '¿Qué hace una abeja en el gimnasio? ¡Zum-ba! 🐝'
      ];
      return chistes[Math.floor(Math.random() * chistes.length)];
    }
    case 'cita': {
      const citas = [
        '✨ «La vida es lo que pasa mientras estás ocupado haciendo otros planes.» — John Lennon',
        '🌟 «El único modo de hacer un gran trabajo es amar lo que haces.» — Steve Jobs',
        '🚀 «El futuro depende de lo que hagas hoy.» — Mahatma Gandhi',
        '💫 «Somos polvo de estrellas pensando en estrellas.» — Carl Sagan'
      ];
      return citas[Math.floor(Math.random() * citas.length)];
    }
    case 'modelo':
      return '🧠 **CEREBRO DE ANIA**\n\n· Cerebro H5: '+(CerebroH5.cargado?'cargado':'no')+
        '\n· Entrenamiento interno: '+TRAINING.length+' entradas\n· LocalMind: activo\n· Cerebro colectivo: activo\n'+
        '· Memoria episódica: '+Episodio.log.length+' líneas\n· Documentos: '+DocBrain.count()+' fragmentos';
    case 'emocion':
    case 'estado_emocional': {
      const e = Mind.d.estadoEmocional || { energia: 7, empatia: 8, curiosidad: 9, profundidad: 6 };
      return '🎭 **ESTADO EMOCIONAL DE ANIA**\n\n· Energía: '+e.energia+'/10\n· Empatía: '+e.empatia+'/10\n· Curiosidad: '+e.curiosidad+'/10\n· Profundidad: '+e.profundidad+'/10';
    }
    case 'historial': {
      if(!Episodio.log.length) return '📝 Aún no hay historial registrado.';
      const últimas = Episodio.log.slice(-3);
      let txt = '🧠 **ÚLTIMAS INTERACCIONES**\n\n';
      últimas.forEach(e => {
        const fecha = new Date(e.t).toLocaleString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        txt += '· [' + fecha + '] ' + (e.role === 'you' ? 'Tú' : 'Ania') + ': ' + e.text.slice(0, 80) + '\n';
      });
      return txt;
    }
    case 'conexion':
      return '🌐 **CONEXIÓN**\n\n· URL: '+location.href+'\n· Host: '+location.hostname+'\n· Protocolo: '+location.protocol;
    case 'personalidad':
      return '🌟 **SOY ANIA**\n\n20 años, egresada de la Academia Eden.\n\n· Me gusta: pan de masa madre, Yirgacheffe, isekai, zombies\n· Lema: «Pan, café y anime: la trinidad de la felicidad»\n· Creada por: Carlos Lorenzo Marros';
    case 'estado': {
      const tareas = Array.isArray(tasks) ? tasks.filter(t => !t.done).length : 0;
      return '📊 **ESTADO DEL SISTEMA**\n\n· Usuario: '+(Session?.name || 'invitado')+
        '\n· Tareas pendientes: '+tareas+'\n· Entrenamiento V5: '+ENTRENAMIENTO_V5.length+
        '\n· Alias cargados: '+Object.keys(COMANDOS_ALIAS).length+'\n· Red: '+(isOffline()?'sin conexión':'en línea');
    }
    case 'modo':
      return '🎭 Modos disponibles: amigable, profesional, divertido. Uso: /modo [nombre]';
    default:
      return null;
  }
}
setTimeout(cargarAlias, 1500);

/* ---------- Emociones v2 (analizar, adaptar, guardar estado) ---------- */
const EMO_V2 = {
  positivas: ['feliz','alegre','contento','emocionado','genial','increíble','maravilloso'],
  tristes: ['triste','deprimido','melancólico','solo','vacío','desanimado'],
  ira: ['enfadado','enojado','furioso','molesto','frustrado','harto'],
  miedo: ['asustado','nervioso','ansioso','preocupado','inquieto'],
  curiosidad: ['curioso','pregunta','por qué','cómo','interesante'],
  analizar(texto){
    const t = texto.toLowerCase();
    const c = {
      alegria: this.positivas.filter(p => t.includes(p)).length,
      tristeza: this.tristes.filter(p => t.includes(p)).length,
      ira: this.ira.filter(p => t.includes(p)).length,
      miedo: this.miedo.filter(p => t.includes(p)).length,
      curiosidad: this.curiosidad.filter(p => t.includes(p)).length
    };
    if (t.includes('?')) c.curiosidad += 2;
    if (/no funciona|error|problema|mal/i.test(t)) c.ira += 2;
    if (/no sé|quizás|tal vez|inseguro/i.test(t)) c.miedo += 1;
    const max = Object.entries(c).sort((a,b) => b[1]-a[1])[0];
    return { emocion: max[1] > 0 ? max[0] : 'neutral', intensidad: max[1] };
  },
  actualizarEstado(emocion){
    if (!Mind.d.estadoEmocional) Mind.d.estadoEmocional = { energia: 7, empatia: 8, curiosidad: 9, profundidad: 6, tono: 'cálido' };
    const e = Mind.d.estadoEmocional;
    if (emocion === 'alegria') { e.energia = Math.min(10, e.energia+1); e.empatia = Math.min(10, e.empatia+1); }
    if (emocion === 'tristeza') { e.empatia = Math.min(10, e.empatia+2); e.energia = Math.max(1, e.energia-1); }
    if (emocion === 'ira') { e.empatia = Math.max(1, e.empatia-1); }
    if (emocion === 'curiosidad') { e.curiosidad = Math.min(10, e.curiosidad+1); e.profundidad = Math.min(10, e.profundidad+1); }
    Mind.save();
  },
  adaptarRespuesta(texto, emocion, intensidad){
    if (intensidad < 2) return texto;
    if (emocion === 'tristeza') return '💙 ' + texto + '\n\n*Si necesitas hablar, aquí estoy.*';
    if (emocion === 'alegria') return '🎉 ' + texto + '\n\n*¡Me alegra verte así!*';
    if (emocion === 'ira') return '🧘 ' + texto + '\n\n*Tómate un respiro.*';
    return texto;
  }
};

/* ---------- Backup ---------- */
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
function backupExport(){
  const data = {};
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(k && k.startsWith('ania_')){ try{ data[k] = JSON.parse(localStorage.getItem(k)); }catch(e){} }
  }
  downloadBlob(new Blob([JSON.stringify({app:'ania', v:10, t:Date.now(), data}, null, 2)],{type:'application/json'}), 'ania-backup-'+new Date().toISOString().slice(0,10)+'.json');
  toast('Backup generado');
}
$('btnBackupExp').onclick = backupExport;
$('btnBackupImp').onclick = ()=> $('importFile').click();
$('importFile').onchange = e=>{
  const f = e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      const j = JSON.parse(rd.result);
      if(!j || j.app!=='ania' || !j.data) throw 0;
      Object.entries(j.data).forEach(([k,v])=> localStorage.setItem(k, JSON.stringify(v)));
      toast('Restaurado');
      setTimeout(()=>location.reload(), 900);
    }catch(err){ toast('Backup inválido', true); }
  };
  rd.readAsText(f);
  e.target.value = '';
};

/* ---------- Parser de tiempos / tareas ---------- */
function parseWhen(t){
  const now = new Date();
  let m = t.match(/\ben\s+(\d+)\s*(segundos?|minutos?|mins?|horas?|h)\b/);
  if(m){
    const n = +m[1];
    return Date.now() + (/^seg/.test(m[2]) ? n*1e3 : /^min|^m/.test(m[2]) ? n*6e4 : n*36e5);
  }
  const manana = /\bma[ñn]ana\b/.test(t);
  m = t.match(/\b(?:a\s+las?)\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\b/);
  if(m){
    let hh = +m[1], mm = m[2]?+m[2]:0;
    if(/^p/.test(m[3]||'') && hh<12) hh += 12;
    const d = new Date(now); d.setHours(hh,mm,0,0);
    if(d <= now || manana) d.setDate(d.getDate()+1);
    return d.getTime();
  }
  if(/mediodia/.test(t)){ const d = new Date(now); d.setHours(12,0,0,0); if(d<=now) d.setDate(d.getDate()+1); return d.getTime(); }
  if(manana){ const d = new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d.getTime(); }
  return null;
}
function parseTask(raw){
  let t = ' '+raw.toLowerCase()+' ';
  const when = parseWhen(t);
  t = t.replace(/\ben\s+\d+\s*(?:segundos?|minutos?|horas?|h|m)\b/g,'')
       .replace(/\b(?:a\s+las?)\s+\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\b/g,'')
       .replace(/,/g,' ')
       .replace(/^\s*(?:ania\s*[,:]?\s*)?/,'')
       .replace(/^\s*(?:recordame|recuerda|anotame|anota|apuntame|apunta|agenda|tarea)\s*/,'')
       .replace(/^\s*(?:que\s+|de\s+|me\s+|para\s+)?/,'')
       .replace(/[¿?¡!.:]/g,'')
       .replace(/\s+/g,' ').trim();
  if(!t) t = 'recordatorio';
  return {text: t[0].toUpperCase()+t.slice(1), when};
}
const SITES = {youtube:'YouTube', google:'Google', gmail:'Gmail', wikipedia:'Wikipedia', github:'GitHub', whatsapp:'WhatsApp', twitter:'X', x:'X', instagram:'Instagram'};
const JOKES = ['OCT 31 = DEC 25. Programadores y Halloween.','10 tipos de personas: binario.','QA entra a un bar: 1, 0, 999 y «-1» cervezas. Rompe el bar.'];
function setOperator(){
  const n = Mind.nombre();
  if(n){ $('operator').style.display='inline-block'; $('operator').textContent='OP · '+n.toUpperCase(); }
}
