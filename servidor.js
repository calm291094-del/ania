// servidor.js · ANIA · backend con registro + cerebro colectivo
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ==================== CONFIG ==================== */
const REPO   = 'calm291094-del/ania';
const BRANCH = 'main';
const P_USERS     = 'datos/usuarios.enc.json';
const P_MEMORIES  = 'datos/memorias.enc.json';
const P_KNOWLEDGE = 'datos/conocimiento.json';

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const ANIA_SECRET   = process.env.ANIA_SECRET;
const TOKEN_SECRET  = process.env.ANIA_TOKEN_SECRET;
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').toLowerCase() || null;

const MISSING = ['GITHUB_TOKEN','ANIA_SECRET','ANIA_TOKEN_SECRET'].filter(k => !process.env[k]);
if (MISSING.length) console.error('⚠ Faltan env vars:', MISSING.join(', '));

const KEY = crypto.createHash('sha256').update(ANIA_SECRET || 'fallback').digest();

/* ==================== CIFRADO ==================== */
function encrypt(obj){
  const iv = crypto.randomBytes(12);
  const c  = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj),'utf8'), c.final()]);
  const tag  = c.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64');
}
function decrypt(b64){
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.slice(0,12), tag = buf.slice(12,28), data = buf.slice(28);
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}

/* ==================== GITHUB API ==================== */
async function ghRead(p){
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`,
    { headers:{ Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' }});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('gh read '+r.status);
  const j = await r.json();
  return { content: Buffer.from(j.content,'base64').toString('utf8'), sha: j.sha };
}
async function ghWrite(p, content, msg){
  let sha = null;
  try{
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`,
      { headers:{ Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' }});
    if (r.ok) sha = (await r.json()).sha;
  }catch{}
  const body = { message: msg || 'Ania: '+new Date().toISOString(),
                 content: Buffer.from(content,'utf8').toString('base64'), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}`, {
    method:'PUT',
    headers:{ Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('gh write '+r.status+' '+await r.text());
  return r.json();
}

/* ==================== USUARIOS ==================== */
function hashPass(p){
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(p, salt, 64).toString('hex');
}
function checkPass(p, stored){
  try{
    const [,salt,hash] = stored.split('$');
    const t = crypto.scryptSync(p, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(t,'hex'));
  }catch{ return false; }
}
function makeToken(payload){
  const body = Buffer.from(JSON.stringify({...payload, exp: Date.now()+30*864e5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET||'x').update(body).digest('base64url');
  return body+'.'+sig;
}
function verifyToken(tok){
  try{
    const [b,s] = tok.split('.');
    const e = crypto.createHmac('sha256', TOKEN_SECRET||'x').update(b).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
    const p = JSON.parse(Buffer.from(b,'base64url').toString());
    return p.exp < Date.now() ? null : p;
  }catch{ return null; }
}
async function loadUsers(){
  const f = await ghRead(P_USERS);
  if (!f) return [];
  try{ return decrypt(f.content) || []; }catch{ return []; }
}
async function saveUsers(u){ await ghWrite(P_USERS, encrypt(u), 'Ania: usuarios actualizados'); }

function auth(req,res,next){
  const t = (req.headers.authorization||'').replace(/^Bearer\s+/,'');
  const p = verifyToken(t);
  if (!p) return res.status(401).json({ error:'sesión inválida' });
  req.user = p; next();
}

/* ==================== MIDDLEWARE ==================== */
app.use(cors());
app.use(express.json({ limit:'2mb' }));

/* ==================== HEALTH ==================== */
app.get('/ania/health', (req,res)=> res.json({ ok:true, t:Date.now() }));
app.get('/ania/ping',   (req,res)=> res.json({ mensaje:'Ania backend activo' }));

/* ==================== REGISTRO ==================== */
app.post('/ania/register', async (req,res)=>{
  try{
    const { usuario, password, nombre, email } = req.body || {};
    if (!usuario || !password || !nombre || !email)
      return res.status(400).json({ error:'faltan campos' });
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(usuario))
      return res.status(400).json({ error:'usuario inválido (3-20 alfanuméricos)' });
    if (password.length < 6)
      return res.status(400).json({ error:'contraseña mínimo 6 caracteres' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error:'correo inválido' });

    const users = await loadUsers();
    if (users.some(u=>u.usuario.toLowerCase()===usuario.toLowerCase()))
      return res.status(409).json({ error:'ese usuario ya existe' });
    if (users.some(u=>u.email.toLowerCase()===email.toLowerCase()))
      return res.status(409).json({ error:'ese correo ya está registrado' });

    const nuevo = {
      id: crypto.randomUUID(),
      usuario: usuario.toLowerCase(),
      nombre: nombre.trim().slice(0,80),
      email: email.toLowerCase(),
      passwordHash: hashPass(password),
      rol: (SUPERADMIN_EMAIL && email.toLowerCase() === SUPERADMIN_EMAIL) ? 'superadmin' : (users.length===0 ? 'admin' : 'user'),
      creado: Date.now()
    };
    users.push(nuevo);
    await saveUsers(users);

    const token = makeToken({ id:nuevo.id, usuario:nuevo.usuario, rol:nuevo.rol });
    res.json({ ok:true, token, usuario:{ id:nuevo.id, usuario:nuevo.usuario, nombre:nuevo.nombre, email:nuevo.email, rol:nuevo.rol }});
  }catch(e){
    console.error('register:', e);
    res.status(500).json({ error:'error al registrar: '+e.message });
  }
});

/* ==================== LOGIN ==================== */
app.post('/ania/login', async (req,res)=>{
  try{
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error:'faltan datos' });
    const users = await loadUsers();
    const u = users.find(x=>x.usuario===usuario.toLowerCase() || x.email===usuario.toLowerCase());
    if (!u || !checkPass(password, u.passwordHash))
      return res.status(401).json({ error:'usuario o contraseña incorrectos' });
    if (SUPERADMIN_EMAIL && u.email === SUPERADMIN_EMAIL && u.rol !== 'superadmin'){
      u.rol = 'superadmin';
      await saveUsers(users);
    }
    const token = makeToken({ id:u.id, usuario:u.usuario, rol:u.rol });
    res.json({ ok:true, token, usuario:{ id:u.id, usuario:u.usuario, nombre:u.nombre, email:u.email, rol:u.rol }});
  }catch(e){
    console.error('login:', e);
    res.status(500).json({ error:'error al iniciar sesión' });
  }
});

/* ==================== CONOCIMIENTO COMPARTIDO ==================== */
app.get('/ania/knowledge', async (req,res)=>{
  try{
    const f = await ghRead(P_KNOWLEDGE);
    res.json(f ? JSON.parse(f.content) : []);
  }catch{ res.json([]); }
});

app.post('/ania/knowledge', auth, async (req,res)=>{
  try{
    const { clave, valor, categoria } = req.body || {};
    if (!clave || !valor) return res.status(400).json({ error:'falta clave o valor' });
    if (String(clave).length>200 || String(valor).length>1000)
      return res.status(400).json({ error:'texto demasiado largo' });

    let lista = [];
    try{ const f = await ghRead(P_KNOWLEDGE); if (f) lista = JSON.parse(f.content); }catch{}

    const k = String(clave).toLowerCase().trim();
    const existing = lista.find(e=>e.clave===k);
    if (existing){
      if (!existing.valores.includes(String(valor))) existing.valores.push(String(valor));
      existing.votos = (existing.votos||1)+1;
    } else {
      lista.push({ clave:k, valores:[String(valor)], categoria:categoria||'general', votos:1, t:Date.now() });
    }
    if (lista.length > 2000) lista = lista.slice(-2000);
    await ghWrite(P_KNOWLEDGE, JSON.stringify(lista,null,2), 'Ania: conocimiento actualizado');
    res.json({ ok:true, total:lista.length });
  }catch(e){
    console.error('knowledge:', e);
    res.status(500).json({ error:'error al guardar conocimiento' });
  }
});

/* ==================== MEMORIA PRIVADA ==================== */
async function loadMemories(){
  const f = await ghRead(P_MEMORIES);
  if (!f) return {};
  try{ return decrypt(f.content) || {}; }catch{ return {}; }
}
async function saveMemories(m){ await ghWrite(P_MEMORIES, encrypt(m), 'Ania: memorias actualizadas'); }

app.get('/ania/me/memoria', auth, async (req,res)=>{
  try{
    const m = await loadMemories();
    res.json(m[req.user.id] || { nombre:null, gustos:[], hechos:[], tareas:[], diario:[] });
  }catch{ res.json({}); }
});

app.post('/ania/me/memoria', auth, async (req,res)=>{
  try{
    const m = await loadMemories();
    m[req.user.id] = { ...(m[req.user.id]||{}), ...req.body, actualizado:Date.now() };
    await saveMemories(m);
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:'no pude guardar' }); }
});

/* ==================== ESTÁTICOS + SPA ==================== */
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
  }
}));
app.get('*', (req,res)=>{
  const idx = path.join(PUBLIC_DIR,'index.html');
  fs.existsSync(idx) ? res.sendFile(idx) : res.status(404).send('index.html no encontrado');
});

app.listen(PORT,'0.0.0.0', ()=> console.log('ANIA backend · puerto '+PORT));
