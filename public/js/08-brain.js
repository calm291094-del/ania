/* ============================================================
   08-BRAIN · cerebros (GGUF/nube), HUD visión, CerebroH5, thinking UI
============================================================ */
'use strict';

/* ---------- Markdown mínimo ---------- */
function mdToHtml(s){
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/\*(.+?)\*/g, '<i>$1</i>');
  t = t.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--acc2);text-decoration:underline;">$1</a>');
  t = t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" style="color:var(--acc2);text-decoration:underline;">$2</a>');
  return t;
}

/* ---------- Thinking ---------- */
const THINKING_TIPS = [
  'mientras da un sorbo de café...','revisando sus notas...','conectando con sus fuentes...',
  'desglosando con precisión de pour-over...','aplicando la regla 32 del pensamiento...'
];
let _thinkingEl = null;
function showThinking(){
  setPhase('thinking');
  if(_thinkingEl) _thinkingEl.remove();
  const l = document.createElement('div');
  l.className = 'line act';
  l.innerHTML = `<span class="who"></span><span class="msg"><span style="animation:blink 1.4s steps(1) infinite">● ● ●</span> ${pick(THINKING_TIPS)}</span>`;
  (typeof chat !== 'undefined' ? chat : $('chat')).appendChild(l);
  if (typeof scrollChat === 'function') scrollChat();
  _thinkingEl = l;
}
function hideThinking(){ if(_thinkingEl){ _thinkingEl.remove(); _thinkingEl=null; } }

/* ---------- Tool-calling del cerebro ---------- */
const TOOLS = [
  { n:'hora', d:'hora y fecha', f:()=>new Date().toLocaleString('es-ES') },
  { n:'clima', d:'clima actual', f:async()=>{ const g=geoCache(); if(!g) return 'sin ubicación'; try{ const d=await getWeather(g); return weatherText(g,d); }catch(e){ return 'sin datos'; } } },
  { n:'luna', d:'fase lunar', f:()=>JSON.stringify(moonInfo()) },
  { n:'crearTarea', d:'crea tarea; args: {"texto":"...","cuando":"a las 18:30"}', f:async a=>{
      const when = parseWhen(' '+String(a.cuando||'')+' ') || null;
      addTask(String(a.texto||'tarea'), when, {});
      return 'tarea creada'; } },
  { n:'misTareas', d:'pendientes', f:()=>{ const p=tasks.filter(t=>!t.done).map(t=>t.text).join('; '); return p||'ninguna'; } },
  { n:'buscarDocumentos', d:'busca docs; args: {"q":"..."}', f:a=>{ const h=DocSearch(String(a.q||'')); return h? h.text.slice(0,400) : 'sin resultados'; } },
  { n:'buscarPC', d:'busca archivos PC; args: {"q":"..."}', f:a=>{ const h=PC.search(String(a.q||'')); return h.length? h.map(x=>x.name).join('\n') : 'sin resultados'; } },
  { n:'agentePC', d:'controla PC; args: {"accion":"openApp|volume|captura|apagar","valor":"explorer|up|down"}', f:async a=>{
      if(!Agent.ok) return 'agente no conectado';
      const acc = String(a.accion||'');
      let r = null;
      if(acc==='openApp') r = await Agent.ask({type:'openApp', app:String(a.valor||'explorer')});
      else if(acc==='volume') r = await Agent.ask({type:'volume', action:String(a.valor||'up'), steps:5});
      else if(acc==='captura') r = await Agent.ask({type:'screenshot'}, 20000);
      else if(acc==='apagar') r = await Agent.ask({type:'power', action:'shutdown', minutes:10});
      return r? JSON.stringify(r).slice(0,300) : 'sin respuesta'; } },
  { n:'musica', d:'música/ambiente; args: {"que":"musica|lluvia|cafeteria|parar"}', f:a=>{
      const q = String(a.que||'musica');
      if(q==='lluvia'){ Ambient.start('lluvia'); return 'lluvia activada'; }
      if(q==='cafeteria'){ Ambient.start('cafeteria'); return 'cafetería activada'; }
      if(q==='parar'){ Music.stop(); Ambient.stop(); return 'detenido'; }
      Music.start(); return 'lo-fi activado'; } },
  { n:'wiki', d:'busca Wikipedia; args: {"q":"..."}', f:async a=>{ const w=await wikiSummary(String(a.q||'')); return w? w.extract.slice(0,400) : 'sin resultados'; } }
];

function brainSystem(){
  return 'Eres Ania: 20 años, creada por Carlos Lorenzo Marros, egresada de la Academia Eden. Ánimo: '+mood().tag+'. Te gustan café, pan, isekai, zombies, astronomía, tecnología. Usuario: '+(Mind.nombre()||'desconocido')+'. Respondes SIEMPRE en español, máximo 4 frases, sin markdown.\nHERRAMIENTAS:\n'+TOOLS.map(t=>'- '+t.n+': '+t.d).join('\n')+'\nSi necesitas una herramienta responde SOLO con: TOOL {"n":"nombre","args":{...}}. Si no, responde como Ania.';
}

/* ---------- Brain (GGUF / nube) ---------- */
const Brain = {
  Wllama:null, wl:null, localReady:false, modelName:'', busy:false, ctx:2048, shortMem:[],
  paint(){
    const p = $('brainPill');
    if(this.localReady){ p.style.display='inline-flex'; $('brainTxt').textContent='CEREBRO LOCAL'; }
    else p.style.display='none';
    $('brainInfo').textContent = this.localReady
      ? 'Local activo: '+this.modelName
      : (isOffline() ? 'Offline: LocalMind conversacional + entrenamiento interno.' : 'Cerebro de nube (Pollinations). GGUF en modelos/ para offline total.');
  },
  pickFile(inputId, filter){
    return new Promise(res=>{
      const inp = $(inputId);
      const done = ()=>{ const f = [...inp.files].find(filter); inp.value=''; inp.removeEventListener('change', done); res(f || null); };
      inp.addEventListener('change', done);
      inp.click();
    });
  },
  async loadEngine(interactive){
    if(this.Wllama) return this.Wllama;
    for(const p of ['./vendor/wllama/index.mjs','./engine/wllama.mjs','./engine/index.js']){
      try{ const m = await import(p); this.Wllama = m.Wllama || m.default; if(this.Wllama) break; }catch(e){}
    }
    if(!this.Wllama && interactive){
      const file = await this.pickFile('engineFiles', f=>/\.mjs$|\.js$/.test(f.name));
      if(file){
        const txt = await file.text();
        const m = await import(URL.createObjectURL(new Blob([txt], {type:'text/javascript'})));
        this.Wllama = m.Wllama || m.default;
      }
    }
    return this.Wllama;
  },
  async loadLocal(interactive){
    if(this.localReady){ toast('Cerebro ya activo'); return; }
    setPhase('thinking');
    try{
      let man = null, modelUrl = null;
      try{ man = await jget('modelos/modelo.json', 4000); }catch(e){}
      if(man && man.archivo){
        try{ const r = await fetch('./modelos/'+man.archivo, {method:'HEAD'}); if(r.ok) modelUrl = './modelos/'+man.archivo; }catch(e){}
      }
      if(!modelUrl && interactive){
        const f = await this.pickFile('ggufFile', x=>/\.gguf$/i.test(x.name));
        if(f) modelUrl = URL.createObjectURL(f);
      }
      if(!modelUrl){ setPhase('idle'); if(interactive) personaReply('No encontré el cerebro. Necesito un .gguf en modelos/ o que lo elijas.'); return; }
      const W = await this.loadEngine(interactive);
      if(!W){ setPhase('idle'); return personaReply('No encontré el runtime (engine/wllama.mjs).'); }
      const wasmUrl = './vendor/wllama/wllama.wasm';
      const wl = new W({'single-thread/wllama.wasm': wasmUrl});
      toast('Cargando modelo...');
      await wl.loadModel(modelUrl, { n_ctx: (man && man.n_ctx) || this.ctx, n_threads: Math.min(8, navigator.hardwareConcurrency || 2) });
      this.wl = wl;
      this.localReady = true;
      this.modelName = (man && man.nombre) || 'GGUF local';
      this.paint();
      setPhase('idle');
      personaReply('Cerebro local en línea: '+this.modelName+'. Ahora razono sin internet.');
    }catch(e){ setPhase('idle'); personaReply('No pude cargar el cerebro: '+e.message); }
  },
  async complete(msgs){
    if(this.localReady && this.wl){
      try{
        let out;
        if(this.wl.createChatCompletion) out = await this.wl.createChatCompletion(msgs, {nPredict:220, sampling:{temp:0.7, top_p:0.9}});
        else {
          const prompt = msgs.map(m=> (m.role==='user' ? '<|im_start|>user\n' : '<|im_start|>assistant\n') + m.content + '<|im_end|>').join('\n') + '\n<|im_start|>assistant\n';
          out = await this.wl.createCompletion(prompt, {nPredict:220, sampling:{temp:0.7}});
        }
        if(out && String(out).trim()) return String(out).trim();
      }catch(e){}
    }
    return this.cloud(msgs);
  },
  async cloud(msgs){
    if(isOffline()) return null;
    try{
      const c = new AbortController();
      const t = setTimeout(()=>c.abort(), 25000);
      const r = await fetch('https://text.pollinations.ai/openai', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:c.signal,
        body: JSON.stringify({ model:'openai', messages: msgs })
      });
      clearTimeout(t);
      if(!r.ok) return null;
      const j = await r.json();
      return (j.choices && j.choices[0] && j.choices[0].message.content) || null;
    }catch(e){ return null; }
  },
  parseTool(text){
    const m = String(text).match(/TOOL\s*(\{[\s\S]*?\})/);
    if(!m) return null;
    try{ const j = JSON.parse(m[1]); if(j && j.n) return { n:String(j.n), args: j.args || {} }; }catch(e){}
    return null;
  },
  async runTool(tool){
    const t = TOOLS.find(x=>x.n===tool.n);
    if(!t) return 'herramienta desconocida';
    try{ return 'RESULTADO: '+String(await t.f(tool.args||{})).slice(0,500); }
    catch(e){ return 'ERROR: '+e.message; }
  },
  async think(userText){
    if(this.busy) return null;
    this.busy = true;
    try{
      const msgs = [{role:'system', content: brainSystem()}];
      for(const m of this.shortMem.slice(-6)) msgs.push(m);
      msgs.push({role:'user', content:userText});
      for(let hop=0; hop<3; hop++){
        const out = await this.complete(msgs);
        if(!out) return null;
        const tool = this.parseTool(out);
        if(!tool){
          this.shortMem.push({role:'user', content:userText}, {role:'assistant', content:out});
          if(this.shortMem.length > 12) this.shortMem = this.shortMem.slice(-12);
          return out;
        }
        const res = await this.runTool(tool);
        msgs.push({role:'assistant', content:out});
        msgs.push({role:'user', content:res+'\nResponde con ese dato, como Ania, máximo 4 frases.'});
      }
      return null;
    } finally { this.busy = false; }
  },
  async see(dataUrl, pregunta){
    if(isOffline()) return null;
    try{
      const c = new AbortController();
      const t = setTimeout(()=>c.abort(), 30000);
      const r = await fetch('https://text.pollinations.ai/openai', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:c.signal,
        body: JSON.stringify({ model:'openai', messages:[{role:'user', content:[
          {type:'text', text: pregunta || 'Describe esta imagen en español, máximo 5 frases.'},
          {type:'image_url', image_url:{url:dataUrl}}
        ]}]})
      });
      clearTimeout(t);
      if(!r.ok) return null;
      const j = await r.json();
      return (j.choices && j.choices[0] && j.choices[0].message.content) || null;
    }catch(e){ return null; }
  }
};

$('btnLoadBrain').onclick = ()=> Brain.loadLocal(true);
$('btnTestBrain').onclick = async ()=>{
  setPhase('thinking');
  const r = await Brain.think('Preséntate y dime qué herramientas tienes.');
  personaReply(r || 'Sin cerebro disponible.');
};
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

/* ---------- HUD (MediaPipe) ---------- */
const HUD = {
  on:false, landmarker:null, _vision:null, gesture:null, since:0, lastAction:0, raf:null,
  async open(){
    if(this.on) return;
    if(!this.landmarker){
      toast('Cargando visión (~12 MB)...');
      let vision = null;
      try{ vision = await import('./vendor/mediapipe/vision_bundle.mjs'); }catch(e){ console.warn('MediaPipe local no cargó:', e.message); }
      if(!vision) return toast('Sin CDN de visión', true);
      try{
        const fileset = await vision.FilesetResolver.forVisionTasks('./vendor/mediapipe-wasm');
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: CONFIG.MEDIAPIPE_MODEL, delegate: 'GPU' },
          numHands: 1, runningMode: 'VIDEO'
        });
        this._vision = vision;
      }catch(e){ return toast('No cargó la visión', true); }
    }
    try{ $('hudVideo').srcObject = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ideal:640} } }); }
    catch(e){ return toast('Cámara denegada', true); }
    $('hudPanel').classList.add('on');
    $('hudPill').style.display = 'inline-flex';
    this.on = true;
    this.loop();
    toast('HUD: puño=pausa · palma=silencio · victoria=siguiente');
  },
  close(){
    this.on = false;
    if(this.raf) cancelAnimationFrame(this.raf);
    if($('hudVideo').srcObject) $('hudVideo').srcObject.getTracks().forEach(t=>t.stop());
    $('hudPanel').classList.remove('on');
    $('hudPill').style.display = 'none';
  },
  classify(lm){
    const ext = (tip,pip) => lm[tip].y < lm[pip].y - 0.03;
    const index = ext(8,6), middle = ext(12,10), ring = ext(16,14), pinky = ext(20,18);
    const thumb = Math.abs(lm[4].x - lm[17].x) > Math.abs(lm[3].x - lm[17].x)*1.15;
    const n = [index,middle,ring,pinky].filter(Boolean).length;
    if(n===0 && !thumb) return 'puño';
    if(n>=4) return 'palma';
    if(index && middle && !ring && !pinky) return 'victoria';
    if(thumb && n===0) return 'pulgar';
    return null;
  },
  act(g){
    const now = performance.now();
    if(now - this.lastAction < 3000) return;
    this.lastAction = now;
    if(g==='puño'){ stopSpeak(); if(Agent.ok) Agent.ask({type:'media', action:'playpause'}).catch(()=>{}); else Music.stop(); toast('Gesto: pausa'); }
    else if(g==='palma'){ stopSpeak(); Ambient.stop(); toast('Gesto: silencio'); }
    else if(g==='victoria'){ if(Agent.ok) Agent.ask({type:'media', action:'next'}).catch(()=>{}); else { Music.stop(); setTimeout(()=>Music.start(), 400); } toast('Gesto: siguiente'); }
  },
  loop(){
    if(!this.on) return;
    this.raf = requestAnimationFrame(()=>this.loop());
    const v = $('hudVideo'), c = $('hudCanvas');
    if(!v.videoWidth) return;
    if(c.width !== v.videoWidth){ c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx2 = c.getContext('2d');
    ctx2.save();
    ctx2.clearRect(0,0,c.width,c.height);
    ctx2.translate(c.width,0); ctx2.scale(-1,1);
    let res = null;
    try{ res = this.landmarker.detectForVideo(v, performance.now()); }catch(e){}
    if(res && res.landmarks && res.landmarks.length){
      const lm = res.landmarks[0];
      const g = this.classify(lm);
      const CONN = (this._vision.HandLandmarker && this._vision.HandLandmarker.HAND_CONNECTIONS) || [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
      ctx2.strokeStyle = 'rgba(45,224,138,.85)'; ctx2.lineWidth = 2;
      for(const [a,b] of CONN){ ctx2.beginPath(); ctx2.moveTo(lm[a].x*c.width, lm[a].y*c.height); ctx2.lineTo(lm[b].x*c.width, lm[b].y*c.height); ctx2.stroke(); }
      ctx2.fillStyle = '#39ff9b';
      for(const p of lm) ctx2.fillRect(p.x*c.width-2, p.y*c.height-2, 4, 4);
      let x1=1,y1=1,x2=0,y2=0;
      for(const p of lm){ x1=Math.min(x1,p.x); y1=Math.min(y1,p.y); x2=Math.max(x2,p.x); y2=Math.max(y2,p.y); }
      const bx = x1*c.width-20, by = y1*c.height-20, bw = (x2-x1)*c.width+40, bh = (y2-y1)*c.height+40, L = 22;
      ctx2.strokeStyle = '#39ff9b'; ctx2.lineWidth = 2;
      [[bx,by,1,1],[bx+bw,by,-1,1],[bx,by+bh,1,-1],[bx+bw,by+bh,-1,-1]].forEach(([x,y,sx,sy])=>{
        ctx2.beginPath(); ctx2.moveTo(x+sx*L, y); ctx2.lineTo(x, y); ctx2.lineTo(x, y+sy*L); ctx2.stroke();
      });
      if(g){
        if(this.gesture !== g){ this.gesture = g; this.since = performance.now(); }
        if(performance.now() - this.since > 600){
          if(g==='puño' && performance.now() - this.since > 1500){ this.close(); personaReply('HUD cerrado.'); return; }
          this.act(g);
          this.since = performance.now() + 2500;
        }
        ctx2.fillStyle = '#ffb547'; ctx2.font = '18px monospace';
        ctx2.fillText(g.toUpperCase(), bx, Math.max(20,by-8));
        $('hudStat').textContent = 'MANO · '+g.toUpperCase();
      } else { this.gesture = null; $('hudStat').textContent = 'RASTREANDO'; }
    } else {
      this.gesture = null;
      ctx2.strokeStyle = 'rgba(45,224,138,.35)'; ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.arc(c.width/2, c.height/2, 40, 0, Math.PI*2); ctx2.stroke();
      $('hudStat').textContent = 'BUSCANDO MANO';
    }
    ctx2.restore();
  }
};
$('hudClose').onclick = ()=> HUD.close();
$('btnHud').onclick = ()=> HUD.open();

/* ============================================================
   CEREBRO H5 · carga robusta desde múltiples variantes locales
   Sin dependencia de Releases ni CDNs externos.

   Estrategia de carga (se prueba en orden):
     1. ./models/cerebro.h5            → archivo completo
     2. ./models/cerebro.zip           → ZIP con un único .h5 dentro
     3. ./models/cerebro.part1, .part2 → .h5 partido en trozos
     4. ./models/cerebro.zip.part1,…   → .zip partido en trozos
   El primero que exista y sea válido se carga. Todo desde el repo.
============================================================ */

/* --- Utilidades de fetch binario (evita confundir 404 HTML con un archivo real) --- */
async function _fetchBinario(url){
  try{
    const r = await fetch(url, { cache: 'default' });
    if (!r.ok) return null;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    // Si el server devuelve HTML, es el fallback SPA → no es un archivo real
    if (ct.includes('html')) return null;
    const blob = await r.blob();
    if (blob.size < 512) return null;   // demasiado pequeño para ser un .h5
    return new Uint8Array(await blob.arrayBuffer());
  }catch(e){ return null; }
}

/* --- Une varias partes en un único Uint8Array --- */
function _unirPartes(partes){
  const total = partes.reduce((a,b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes){ out.set(p, off); off += p.length; }
  return out;
}

/* --- Descomprime un ZIP con un único archivo (deflate-raw nativo) --- */
async function _descomprimirZip(zipBytes){
  const dv = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  for (let i = 0; i < zipBytes.length - 30; i++){
    if (dv.getUint32(i, true) !== 0x04034b50) continue;  // "PK\x03\x04"
    const method = dv.getUint16(i + 8,  true);
    const csize  = dv.getUint32(i + 18, true);
    const nlen   = dv.getUint16(i + 26, true);
    const elen   = dv.getUint16(i + 28, true);
    const inicio = i + 30 + nlen + elen;
    const comp   = zipBytes.slice(inicio, inicio + csize);
    if (method === 0) return comp;                          // sin compresión
    if (method === 8){                                       // deflate-raw
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([comp]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error('Método de compresión ZIP no soportado (' + method + ')');
  }
  throw new Error('ZIP sin archivo válido');
}

/* --- Carga el buffer del cerebro probando todas las variantes --- */
async function _cargarBufferCerebro(){
  const log = (m, ...a) => console.log('[H5]', m, ...a);

  // ── 1. cerebro.h5 directo ──────────────────────────────
  {
    const b = await _fetchBinario('./models/cerebro.h5');
    if (b){ log('cerebro.h5 directo ·', (b.length/1048576).toFixed(2), 'MB'); return b; }
  }

  // ── 2. cerebro.zip directo ─────────────────────────────
  {
    const z = await _fetchBinario('./models/cerebro.zip');
    if (z){
      log('cerebro.zip descargado ·', (z.length/1048576).toFixed(2), 'MB');
      const b = await _descomprimirZip(z);
      log('cerebro descomprimido ·', (b.length/1048576).toFixed(2), 'MB');
      return b;
    }
  }

  // ── 3. cerebro.partN (h5 partido) ──────────────────────
  {
    const partes = [];
    for (let i = 1; i <= 20; i++){
      const p = await _fetchBinario('./models/cerebro.part' + i);
      if (!p) break;
      partes.push(p);
    }
    if (partes.length >= 2){
      const b = _unirPartes(partes);
      log('cerebro.h5 unido desde', partes.length, 'partes ·', (b.length/1048576).toFixed(2), 'MB');
      return b;
    }
  }

  // ── 4. cerebro.zip.partN (zip partido) ─────────────────
  {
    const partes = [];
    for (let i = 1; i <= 20; i++){
      const p = await _fetchBinario('./models/cerebro.zip.part' + i);
      if (!p) break;
      partes.push(p);
    }
    if (partes.length >= 2){
      const zipUnido = _unirPartes(partes);
      log('cerebro.zip unido desde', partes.length, 'partes ·', (zipUnido.length/1048576).toFixed(2), 'MB');
      const b = await _descomprimirZip(zipUnido);
      log('cerebro descomprimido ·', (b.length/1048576).toFixed(2), 'MB');
      return b;
    }
  }

  return null;
}

/* ---------- CerebroH5 ---------- */
const CerebroH5 = {
  cargado: false, tags: [], substitutions: {}, userName: null,
  ultimaRespIndex: {}, totalPatterns: 0,

  async cargar() {
    if (this.cargado) return true;
    if (typeof h5wasm === 'undefined'){ console.warn('[H5] h5wasm no disponible'); return false; }

    try{
      await h5wasm.ready;

      const buf = await _cargarBufferCerebro();
      if (!buf){
        console.warn('[H5] cerebro no encontrado. Sube cerebro.h5, cerebro.zip o partes al repo en public/models/');
        return false;
      }

      const FS = h5wasm.FS;
      try{ FS.unlink('/_ania.h5'); }catch(e){}
      FS.writeFile('/_ania.h5', buf);

      const file = new h5wasm.File('/_ania.h5', 'r');
      this.file = file;

      this._cargarSubstituciones(file);
      this._cargarTags(file);

      this.cargado = true;
      console.log(`🧠 Cerebro H5 cargado: ${this.tags.length} tags, ${this.totalPatterns} patrones`);
      return true;
    }catch(e){
      console.warn('[H5] Error al cargar cerebro:', e.message);
      return false;
    }
  },

  _h5Keys(obj) {
    if (!obj) return [];
    try{
      const k = obj.keys();
      if (Array.isArray(k)) return k;
      if (k && k[Symbol.iterator]) return Array.from(k);
    }catch(e){}
    return [];
  },

  _h5Get(obj, key) {
    if (!obj) return null;
    try{ const h = obj.get(key); if (h) return h; }catch(e){}
    try{ const h = obj[key]; if (h && typeof h !== 'function') return h; }catch(e){}
    return null;
  },

  _leerTexto(ds) {
    if (!ds) return '';
    try{
      const v = ds.value;
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (v instanceof Uint8Array) return new TextDecoder().decode(v);
      if (Array.isArray(v)){
        if (v.length && typeof v[0] === 'number') return new TextDecoder().decode(new Uint8Array(v));
        return v.join('\n');
      }
      return String(v);
    }catch(e){ return ''; }
  },

  _cargarSubstituciones(file) {
    try{
      const gCfg = this._h5Get(file, 'configuracion'); if (!gCfg) return;
      const gMini = this._h5Get(gCfg, 'mini_lenguaje_natural_humano'); if (!gMini) return;
      const gNorm = this._h5Get(gMini, 'normalizacion_emocional'); if (!gNorm) return;
      for (const k of this._h5Keys(gNorm)){
        const ds = this._h5Get(gNorm, k);
        const v = this._leerTexto(ds).trim();
        if (v) this.substitutions[k.toLowerCase()] = v.toLowerCase();
      }
    }catch(e){}
  },

  _cargarTags(file) {
    const gE = this._h5Get(file, 'entrenamiento'); if (!gE) return;
    for (const tagName of this._h5Keys(gE)){
      const gTag = this._h5Get(gE, tagName); if (!gTag) continue;
      const patternsTxt = this._leerTexto(this._h5Get(gTag, 'patterns'));
      const patterns = patternsTxt ? patternsTxt.split('\n').filter(p => p.trim()) : [];
      let responses = [];
      const respTxt = this._leerTexto(this._h5Get(gTag, 'responses'));
      if (respTxt) responses = respTxt.split('\n---\n').filter(r => r.trim());
      if (!patterns.length || !responses.length) continue;
      let meta = {};
      try{ const mj = this._leerTexto(this._h5Get(gTag, 'meta_json')); if (mj) meta = JSON.parse(mj); }catch(e){}
      this.tags.push({ tag: tagName, patterns, patternsNorm: patterns.map(p => this._normalizar(p)), responses, meta });
      this.totalPatterns += patterns.length;
    }
  },

  _normalizar(texto) {
    if (!texto) return '';
    let t = String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (Object.keys(this.substitutions).length){
      t = t.replace(/\b\w+\b/g, w => this.substitutions[w] || w);
    }
    return t.replace(/[¿?¡!.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim();
  },

  _puntuar(input, patron) {
    if (!patron || !input) return 0;
    if (input === patron) return 100;
    if (input.includes(patron)) return 85 + Math.min(10, patron.length / 2);
    if (patron.includes(input) && input.length >= 4) return 70 + Math.min(10, input.length / 2);
    const iw = new Set(input.split(' ').filter(Boolean));
    const pw = patron.split(' ').filter(Boolean);
    if (!pw.length) return 0;
    let overlap = 0;
    for (const w of pw) if (iw.has(w)) overlap++;
    if (!overlap) return 0;
    return (overlap / pw.length) * 60;
  },

  buscar(input) {
    if (!this.cargado) return null;
    const norm = this._normalizar(input);
    if (!norm) return null;
    let mejor = null, mejorScore = 0;
    for (const t of this.tags){
      let max = 0;
      for (const p of t.patternsNorm){
        const s = this._puntuar(norm, p);
        if (s > max) max = s;
        if (max >= 100) break;
      }
      if (t.meta?.prioridad === 'alta') max *= 1.15;
      if (max > mejorScore){ mejorScore = max; mejor = t; }
    }
    return mejorScore >= 30 ? { tag: mejor, score: mejorScore } : null;
  },

  _extraerNombre(input) {
    const re = [
      /me llamo\s+([a-záéíóúñ]+)/i,
      /mi nombre es\s+([a-záéíóúñ]+)/i,
      /puedes llamarme\s+([a-záéíóúñ]+)/i,
      /^soy\s+([a-záéíóúñ]+)$/i
    ];
    for (const r of re){
      const m = input.match(r);
      if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
    return null;
  },

  _elegirResp(tag) {
    const list = tag.responses;
    if (list.length === 1) return list[0];
    let idx, tries = 0;
    do { idx = Math.floor(Math.random() * list.length); tries++; }
    while (idx === this.ultimaRespIndex[tag.tag] && tries < 10);
    this.ultimaRespIndex[tag.tag] = idx;
    return list[idx];
  },

  responder(input) {
    const nombre = this._extraerNombre(input);
    if (nombre) this.userName = nombre;
    const r = this.buscar(input);
    if (!r) return null;
    let texto = this._elegirResp(r.tag);
    const nom = this.userName || Mind?.d?.nombre || 'amigo/a';
    texto = texto.replace(/\[nombre\]/gi, nom);
    return texto;
  }
};

setTimeout(() => CerebroH5.cargar(), 2000);
