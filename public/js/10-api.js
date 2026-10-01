/* ============================================================
   10-API · AniaAPI, CollectiveBrain, Relay, OfflineQueue, aprendizaje
============================================================ */
'use strict';

/* ---------- Cola offline ---------- */
const OfflineQueue = {
  KEY: 'offlineQueue',
  list(){ return store.get(this.KEY, []); },
  save(l){ store.set(this.KEY, l); if (typeof updateNet === 'function') updateNet(); },
  push(msg){
    const l = this.list();
    l.push({ t: Date.now(), msg, id: 'off-'+Date.now()+'-'+Math.random().toString(36).slice(2,6) });
    this.save(l);
  },
  remove(id){ this.save(this.list().filter(x => x.id !== id)); },
  clear(){ this.save([]); },
  count(){ return this.list().length; }
};

/* ---------- Cliente API ---------- */
const AniaAPI = {
  token: store.get('apiToken', null),
  user:  store.get('apiUser', null),
  setSession(token, user){ this.token=token; this.user=user; store.set('apiToken',token); store.set('apiUser',user); },
  clearSession(){ this.token=null; this.user=null; store.del('apiToken'); store.del('apiUser'); },
  async req(path, opts={}){
    const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
    if (this.token) headers.Authorization = 'Bearer '+this.token;
    const r = await fetch(CONFIG.ANIA_API+path, { ...opts, headers });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || ('HTTP '+r.status));
    return data;
  },
  register(p){ return this.req('/ania/register', { method:'POST', body:JSON.stringify(p) }); },
  login(p){ return this.req('/ania/login', { method:'POST', body:JSON.stringify(p) }); },
  getKnowledge(){ return this.req('/ania/knowledge'); },
  contribute(clave, valor, categoria){ return this.req('/ania/knowledge', { method:'POST', body:JSON.stringify({clave,valor,categoria}) }); },
  getMemoria(){ return this.req('/ania/me/memoria'); },
  saveMemoria(d){ return this.req('/ania/me/memoria', { method:'POST', body:JSON.stringify(d) }); }
};

/* ---------- Cerebro colectivo ---------- */
const CollectiveBrain = {
  async learn(key, value, source='auto'){
    const lowKey = String(key).toLowerCase();
    const lowVal = String(value).toLowerCase();
    if (source==='lingua-fix' || /klima|musika|rekuerdame|bu[sz]came/.test(lowKey)) return this.toGlobal(key, value, 'lingua');
    if (/^(qué es|quien es|como se|definición|significa|historia de|capital de)/i.test(lowKey)) return this.toGlobal(key, value, 'hecho');
    if (/me\s+(llamo|gusta|duele|preocupa)|mi\s+(nombre|casa|cumple|correo|trabajo)|soy\s+|tengo\s+\d|vivo\s+en/i.test(lowKey+lowVal)) return this.toPrivate(key, value);
    if (source==='pattern') return this.toGlobal(key, value, 'patron');
    return this.toPrivate(key, value);
  },
  async toGlobal(clave, valor, categoria){
    if (!AniaAPI.token){
      const pending = store.get('pendingGlobal', []);
      pending.push({ clave, valor, categoria, t:Date.now() });
      store.set('pendingGlobal', pending.slice(-200));
      return;
    }
    try{ await AniaAPI.contribute(clave, valor, categoria); }
    catch{
      const pending = store.get('pendingGlobal', []);
      pending.push({ clave, valor, categoria, t:Date.now() });
      store.set('pendingGlobal', pending.slice(-200));
    }
  },
  async toPrivate(clave, valor){
    Mind.d.hechos = Mind.d.hechos || [];
    Mind.d.hechos.push({ clave, valor, t:Date.now() });
    Mind.save();
    if (AniaAPI.token){ try{ await AniaAPI.saveMemoria({ hechos: Mind.d.hechos }); }catch{} }
  },
  async sync(){
    if (!AniaAPI.token) return;
    try{
      const kb = await AniaAPI.getKnowledge();
      store.set('globalKB', kb);
      const mia = await AniaAPI.getMemoria();
      if (mia){
        Mind.d.nombre = mia.nombre || Mind.d.nombre;
        Mind.d.gustos = mia.gustos || Mind.d.gustos;
        Mind.d.hechos = mia.hechos || Mind.d.hechos;
        Mind.save();
      }
    }catch(e){ console.warn('[CollectiveBrain.sync]', e.message); }
  },
  async flushPending(){
    const pending = store.get('pendingGlobal', []);
    if (!pending.length || !AniaAPI.token) return;
    const ok = [];
    for (const p of pending){
      try{ await AniaAPI.contribute(p.clave, p.valor, p.categoria); ok.push(p); }catch{ break; }
    }
    store.set('pendingGlobal', pending.filter(p=>!ok.includes(p)));
  }
};

/* ---------- Aprendizaje pasivo ---------- */
async function learnFromExchange(userText, aniaReply){
  const low = LINGUA.normalizar(userText);
  const m = low.match(/no[, ]+(?:es|era)\s+(.+?)[, ]+(?:es|era)\s+(.+)/);
  if (m) CollectiveBrain.learn(m[1].trim(), m[2].trim(), 'lingua-fix');
  const p = userText.match(/me\s+gusta(?:n)?\s+(?:el\s+|la\s+|los\s+|las\s+)?(.{2,60})/i);
  if (p){
    Mind.d.gustos = Mind.d.gustos || [];
    Mind.d.gustos.push(p[1].trim());
    Mind.save();
    CollectiveBrain.toPrivate('gusto', p[1].trim());
  }
  if (userText.length > 40 && /^(sabías|te cuento|aprende|recuerda que|ten en cuenta)/i.test(userText)){
    CollectiveBrain.learn(userText.slice(0,200), 'aportado por usuario', 'hecho');
  }
}

/* ---------- Relay multidispositivo ---------- */
const Relay = {
  ws:null, on:false, url: store.get('relayUrl', 'ws://127.0.0.1:8766'),
  connect(url){
    if(url){ this.url = url; store.set('relayUrl', url); }
    try{ this.ws = new WebSocket(this.url); }catch(e){ return toast('URL inválida', true); }
    toast('Conectando...');
    this.ws.onopen = ()=>{
      this.on = true;
      $('relayPill').style.display = 'inline-flex';
      this.ws.send(JSON.stringify({type:'hello', dev: DEV_TAG, nombre: Mind.nombre()||'invitado'}));
      toast('Sesión multidevice conectada');
      refreshRelayUI();
    };
    this.ws.onclose = ()=>{ this.on = false; $('relayPill').style.display='none'; refreshRelayUI(); };
    this.ws.onerror = ()=>{ this.on = false; };
    this.ws.onmessage = ev=>{
      let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
      if(m.type==='snapshot' && m.state){
        if(m.state.mind) mergeRemoteMind(m.state.mind);
        if(m.state.diary) mergeRemoteDiary(m.state.diary);
        sysLine('SESIÓN · sincronizado');
      } else if(m.type==='chat' && m.msg && m.msg.dev !== DEV_TAG){
        sysLine('['+m.msg.dev+'] '+(m.msg.role==='you'?'TÚ':'ANIA')+' ▸ '+String(m.msg.text).slice(0,160));
      } else if(m.type==='hello'){
        toast('Dispositivo conectado: '+(m.nombre||m.dev));
      }
    };
  },
  sendChat(kind, text){
    if(!this.on || !this.ws || this.ws.readyState!==1) return;
    try{ this.ws.send(JSON.stringify({type:'chat', msg:{dev: DEV_TAG, role:kind, text:String(text).slice(0,500), t:Date.now()}})); }catch(e){}
  },
  pushState(){
    if(!this.on || !this.ws || this.ws.readyState!==1) return;
    try{
      this.ws.send(JSON.stringify({type:'mind', mind: Mind.d}));
      this.ws.send(JSON.stringify({type:'diary', diary: store.get('diary', [])}));
    }catch(e){}
  },
  disconnect(){ if(this.ws){ try{ this.ws.close(); }catch(e){} } this.on=false; $('relayPill').style.display='none'; refreshRelayUI(); }
};
function mergeRemoteMind(remote){
  const d = Mind.d;
  const seen = new Set(d.gustos.map(g=>String(g).toLowerCase()));
  (remote.gustos||[]).forEach(g=>{ if(!seen.has(String(g).toLowerCase())) d.gustos.push(g); });
  d.nombre = d.nombre || remote.nombre;
  d.visitas = Math.max(d.visitas||0, remote.visitas||0);
  Mind.save(); setOperator();
}
function mergeRemoteDiary(remote){
  const local = store.get('diary', []);
  const byDay = new Set(local.map(e=>e.day));
  (remote||[]).forEach(e=>{ if(!byDay.has(e.day)) local.push(e); });
  store.set('diary', local.slice(-40));
}
setInterval(()=>{ if(Relay.on) Relay.pushState(); }, 60000);
function refreshRelayUI(){
  $('btnRelay').textContent = Relay.on ? 'SESIÓN: CONECTADA' : 'CONECTAR SESIÓN';
}
$('btnRelay').onclick = ()=>{ Relay.on ? Relay.disconnect() : Relay.connect(); };

/* ---------- Ayudantes de UI de sesión ---------- */
function fillSess(){
  $('sessInfo').textContent = Session ? ('Usuario: '+Session.username+' · '+Session.name) : 'Sin sesión.';
}
$('logoutBtn').onclick = ()=>{
  store.del('session');
  AniaAPI.clearSession();
  toast('Sesión cerrada');
  setTimeout(()=>location.reload(), 700);
};