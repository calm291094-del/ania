/* ============================================================
   07-LOCALMIND · documentos, PC, agente
============================================================ */
'use strict';

/* ---------- Parseo de documentos ---------- */
async function inflateRaw(u8){
  const ds = new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}
async function docxToText(buf){
  const u8 = new Uint8Array(buf);
  let i = 0;
  while(i < u8.length - 30){
    if(u8[i]===0x50 && u8[i+1]===0x4b && u8[i+2]===0x03 && u8[i+3]===0x04){
      const dv = new DataView(u8.buffer, i);
      const method = dv.getUint16(8, true);
      const csize = dv.getUint32(18, true);
      const nlen = dv.getUint16(26, true);
      const elen = dv.getUint16(28, true);
      const name = new TextDecoder().decode(u8.slice(i+30, i+30+nlen));
      if(name === 'word/document.xml'){
        const start = i + 30 + nlen + elen;
        const comp = u8.slice(start, start + csize);
        const xml = new TextDecoder().decode(method === 0 ? comp : await inflateRaw(comp));
        return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').trim();
      }
      i += 30 + nlen + elen + csize;
    } else i++;
  }
  throw new Error('docx sin document.xml');
}
async function docToText(buf){
  const u8 = new Uint8Array(buf);
  const candidates = [];
  try{ candidates.push(new TextDecoder('utf-16le').decode(u8)); }catch(e){}
  candidates.push(new TextDecoder('latin1').decode(u8));
  let best = '';
  for(const raw of candidates){
    const runs = raw.match(/[\wÁÉÍÓÚÑáéíóúñü .,;:!?¿¡()'"%-]{8,}/g) || [];
    const txt = runs.join(' ').replace(/\s+/g,' ').trim();
    if(txt.length > best.length) best = txt;
  }
  return best;
}
async function pdfToText(buf){
  const u8 = new Uint8Array(buf);
  const latin = new TextDecoder('latin1').decode(u8);
  let out = '';
  const re = /stream\r?\n/g;
  let m;
  while((m = re.exec(latin))){
    const start = m.index + m[0].length;
    const end = latin.indexOf('endstream', start);
    if(end < 0) break;
    try{
      const comp = u8.slice(start, end);
      let data = comp;
      try{ data = await inflateRaw(comp); }catch(e){}
      const s = new TextDecoder('latin1').decode(data);
      if(/Tj|TJ/.test(s)){
        const parts = [];
        let q;
        const reTj = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
        while((q = reTj.exec(s))) parts.push(q[1].replace(/\\([()\\])/g,'$1'));
        if(parts.length) out += parts.join(' ') + '\n';
      }
    }catch(e){}
    re.lastIndex = end;
  }
  if(!out || out.replace(/\s/g,'').length < 40) throw new Error('pdf sin texto');
  return out.replace(/[ \t]+/g,' ').trim();
}
async function fileToText(file){
  const name = file.name.toLowerCase();
  if(/\.(txt|md|csv|json|log)$/.test(name)) return await file.text();
  if(name.endsWith('.docx')) return await docxToText(await file.arrayBuffer());
  if(name.endsWith('.doc'))  return await docToText(await file.arrayBuffer());
  if(name.endsWith('.pdf'))  return await pdfToText(await file.arrayBuffer());
  return '';
}

/* ---------- DocBrain ---------- */
const DocBrain = {
  chunks: store.get('docs', []),
  count(){ return this.chunks.length; },
  save(){ store.set('docs', this.chunks); },
  clear(){ this.chunks = []; this.save(); },
  sources(){ const s = new Set(); this.chunks.forEach(c=> s.add(c.src)); return [...s]; },
  addChunks(src, fullText){
    const text = String(fullText||'').replace(/\r/g,'').replace(/\u0000/g,'').trim();
    if(text.length < 60) return 0;
    const stamp = src+'::'+text.length+'::'+text.slice(0,80);
    if(this.chunks.some(c=>c.stamp === stamp)) return 0;
    const pieces = [];
    let cur = '';
    for(const para of text.split(/\n+/)){
      const p = para.trim();
      if(!p) continue;
      if((cur + ' ' + p).length > 480){ if(cur) pieces.push(cur); cur = p; }
      else cur = cur ? cur + ' ' + p : p;
    }
    if(cur) pieces.push(cur);
    let added = 0;
    for(const p of pieces){
      if(p.length < 50) continue;
      this.chunks.push({ id:'doc-'+Date.now()+'-'+Math.random().toString(36).slice(2,6), src, text:p, stamp, t:Date.now() });
      added++;
    }
    while(this.chunks.length > 4000) this.chunks.splice(0, 400);
    this.save();
    return added;
  }
};

$('docDir').addEventListener('change', async e=>{
  const files = [...e.target.files];
  e.target.value = '';
  if(!files.length) return;
  toast('Leyendo '+files.length+' archivo(s)...');
  let ok=0, chunks=0;
  for(const f of files){
    if(!/\.(txt|md|csv|json|log|docx|doc|pdf)$/.test(f.name.toLowerCase())) continue;
    try{ const txt = await fileToText(f); const n = DocBrain.addChunks(f.name, txt); if(n){ chunks+=n; ok++; } }catch(e2){}
  }
  DocBrain.save();
  updateDocsUI();
  personaReply('Entrenamiento: '+ok+' documento(s), '+chunks+' fragmentos. Ahora pregúntame de ellos — funciona también sin internet.');
});

function DocSearch(q){
  const words = LINGUA.normalizar(q).split(' ').filter(w=>w.length>2 && !STOPW.has(w));
  if(!words.length) return null;
  let best=null, bestScore=0;
  for(const c of DocBrain.chunks){
    const low = LINGUA.normalizar(c.text);
    let score = 0;
    for(const w of words){
      let i=0, n=0;
      while((i = low.indexOf(w, i)) !== -1){ n++; i += w.length; if(n>3) break; }
      score += n ? (n>1 ? 2 : 1) : 0;
    }
    if(score > bestScore){ bestScore = score; best = c; }
  }
  return bestScore >= 2 ? best : null;
}
function updateDocsUI(){
  $('docsInfo').textContent = DocBrain.count() ? DocBrain.count()+' fragmentos' : 'Sin documentos.';
}
$('btnLoadDocs').onclick = ()=> $('docDir').click();
$('btnClearDocs').onclick = ()=>{ DocBrain.clear(); updateDocsUI(); };

/* ---------- PC index ---------- */
const PC = {
  files: store.get('pcFiles', []),
  count(){ return this.files.length; },
  save(){ store.set('pcFiles', this.files); },
  indexar(fileList){
    let n = 0;
    for(const f of fileList){
      if(f.size < 512*1024 && !/\.(txt|md)$/i.test(f.name)) continue;
      if(f.name.startsWith('.')) continue;
      this.files.push({ name: f.name, path: f.webkitRelativePath || f.name, t: Date.now() });
      n++;
    }
    if(this.files.length > 6000) this.files = this.files.slice(-6000);
    this.save();
    return n;
  },
  search(q){
    const words = LINGUA.normalizar(q).split(' ').filter(Boolean);
    if(!words.length) return [];
    return this.files
      .map(f => { const fn = LINGUA.normalizar(f.name); let score = 0; for(const w of words) if(fn.includes(w)) score += 2; return {f, score}; })
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,8)
      .map(x=>x.f);
  },
  clear(){ this.files = []; this.save(); }
};
let lastPC = [];

$('pcDir').addEventListener('change', e=>{
  const files = [...e.target.files];
  e.target.value = '';
  if(!files.length) return;
  const n = PC.indexar(files);
  updatePCUI();
  personaReply('Indexación: '+n+' archivos.');
});
function updatePCUI(){ $('pcInfo').textContent = PC.count() ? PC.count()+' archivos.' : '0.'; }
$('btnIndexPC').onclick = ()=> $('pcDir').click();
$('btnClearPC').onclick = ()=>{ PC.clear(); updatePCUI(); };

/* ---------- Agente PC ---------- */
const Agent = {
  ws:null, ok:false, retry:null,
  connect(){
    try{
      this.ws = new WebSocket('ws://127.0.0.1:8765');
      this.ws.onopen = ()=>{ this.ok = true; clearTimeout(this.retry); toast('Agente conectado'); paintAgent(); };
      this.ws.onclose = ()=>{ this.ok = false; paintAgent(); this.retry = setTimeout(()=>this.connect(), 30000); };
      this.ws.onerror = ()=>{ this.ok = false; };
    }catch(e){ this.ok = false; }
  },
  ask(payload, timeout=10000){
    return new Promise((res, rej)=>{
      if(!this.ok || !this.ws || this.ws.readyState !== 1) return rej(new Error('off'));
      const id = 'a'+Date.now()+Math.random().toString(36).slice(2,6);
      const onMsg = ev=>{
        try{ const d = JSON.parse(ev.data); if(d.id === id){ this.ws.removeEventListener('message', onMsg); res(d); } }catch(e){}
      };
      this.ws.addEventListener('message', onMsg);
      this.ws.send(JSON.stringify({...payload, id, token: store.get('agentToken','')}));
      setTimeout(()=>{ this.ws.removeEventListener('message', onMsg); rej(new Error('timeout')); }, timeout);
    });
  }
};
function paintAgent(){ $('agentPill').style.display = Agent.ok ? 'inline-flex' : 'none'; }
$('btnAgent').onclick = ()=>{
  if(!store.get('agentToken', null)){ toast('Dime: «conecta el agente con clave [token]»', true); return; }
  Agent.connect();
};