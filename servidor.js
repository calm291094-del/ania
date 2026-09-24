// servidor.js · ANIA · backend con registro + cerebro colectivo + fixes de seguridad
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ==================== HANDLERS GLOBALES ==================== */
// Evita que errores no capturados tumben el proceso en producción
process.on('unhandledRejection', (reason) => {
  console.error('⚠ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠ Uncaught Exception:', err.message);
  console.error(err.stack);
});

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

/* ==================== CACHÉ DE GITHUB (TTL 30s) ==================== */
const GHCache = {
  store: new Map(),
  TTL: 30000,
  get(key){
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() - e.t > this.TTL){ this.store.delete(key); return null; }
    return e.value;
  },
  set(key, value){ this.store.set(key, { value, t: Date.now() }); },
  invalidate(key){ this.store.delete(key); },
  clear(){ this.store.clear(); }
};

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
  const cached = GHCache.get('read:' + p);
  if (cached !== null) return cached;

  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`,
    { headers:{ Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' }});
  if (r.status === 404){
    GHCache.set('read:' + p, null);
    return null;
  }
  if (!r.ok) throw new Error('gh read '+r.status);
  const j = await r.json();
  const result = { content: Buffer.from(j.content,'base64').toString('utf8'), sha: j.sha };
  GHCache.set('read:' + p, result);
  return result;
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
  GHCache.invalidate('read:' + p);
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

/* ==================== RATE LIMITERS ==================== */
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'demasiados intentos, espera 15 minutos' },
  skipSuccessfulRequests: true
});

const limiterRegister = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'demasiados registros desde esta IP, espera 1 hora' }
});

const limiterPassword = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'demasiados intentos de cambio de contraseña' }
});

const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'demasiadas peticiones, espera un momento' }
});

/* ==================== MIDDLEWARE ==================== */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json({ limit:'2mb' }));

/* ==================== HEALTH ==================== */
app.use('/ania', (req, res, next) => {
  if (req.path === '/health') return next();
  return limiterGeneral(req, res, next);
});

app.get('/ania/health', (req,res)=> res.json({ ok:true, t:Date.now() }));
app.get('/ania/ping',   (req,res)=> res.json({ mensaje:'Ania backend activo' }));

/* ==================== REGISTRO ==================== */
app.post('/ania/register', limiterRegister, async (req,res)=>{
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
    res.status(500).json({ error:'error al registrar' });
  }
});

/* ==================== LOGIN ==================== */
app.post('/ania/login', limiterLogin, async (req,res)=>{
  try{
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error:'faltan datos' });
    const users = await loadUsers();
    const u = users.find(x=>x.usuario===usuario.toLowerCase() || x.email===usuario.toLowerCase());
    if (!u || !checkPass(password, u.passwordHash))
      return res.status(401).json({ error:'usuario o contraseña incorrectos' });
    if (u.bloqueado === true)
      return res.status(403).json({ error:'cuenta bloqueada. contacta al administrador.' });
    u.ultimoAcceso = Date.now();
    if (SUPERADMIN_EMAIL && u.email === SUPERADMIN_EMAIL && u.rol !== 'superadmin'){
      u.rol = 'superadmin';
    }
    await saveUsers(users);
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

/* ==================== ADMIN · LISTA DE USUARIOS ==================== */
app.get('/ania/admin/users', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const users = await loadUsers();
    const publicos = users.map(u => ({
      id: u.id,
      usuario: u.usuario,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      creado: u.creado,
      ultimoAcceso: u.ultimoAcceso || null,
      bloqueado: !!u.bloqueado
    }));
    res.json({ ok:true, total:users.length, usuarios:publicos });
  }catch(e){
    console.error('admin/users:', e);
    res.status(500).json({ error:'error al listar usuarios' });
  }
});

app.get('/ania/admin/knowledge-stats', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const users = await loadUsers();
    const memorias = await loadMemories();
    let kb = [];
    try{ const f = await ghRead(P_KNOWLEDGE); if (f) kb = JSON.parse(f.content); }catch{}
    res.json({
      totalUsuarios: users.length,
      totalMemorias: Object.keys(memorias).length,
      totalConocimiento: kb.length,
      topConocimiento: kb.sort((a,b)=>(b.votos||1)-(a.votos||1)).slice(0,10)
    });
  }catch(e){
    res.status(500).json({ error:'error en stats' });
  }
});

/* ==================== CAMBIO DE CONTRASEÑA ==================== */
app.post('/ania/me/password', limiterPassword, auth, async (req,res)=>{
  try{
    const { actual, nueva } = req.body || {};
    if (!actual || !nueva) return res.status(400).json({ error:'faltan datos' });
    if (nueva.length < 6) return res.status(400).json({ error:'la nueva debe tener mínimo 6 caracteres' });

    const users = await loadUsers();
    const u = users.find(x=>x.id === req.user.id);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (!checkPass(actual, u.passwordHash))
      return res.status(401).json({ error:'contraseña actual incorrecta' });

    u.passwordHash = hashPass(nueva);
    u.actualizado = Date.now();
    await saveUsers(users);
    res.json({ ok:true });
  }catch(e){
    console.error('password:', e);
    res.status(500).json({ error:'error al cambiar contraseña' });
  }
});

/* ==================== ADMIN · RESET PASSWORD ==================== */
app.post('/ania/admin/reset-password', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const { userId, nueva } = req.body || {};
    if (!userId || !nueva) return res.status(400).json({ error:'faltan datos' });
    if (nueva.length < 6) return res.status(400).json({ error:'mínimo 6 caracteres' });

    const users = await loadUsers();
    const u = users.find(x=>x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'no puedes tocar al superadmin' });

    u.passwordHash = hashPass(nueva);
    u.actualizado = Date.now();
    await saveUsers(users);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ error:'error al resetear' });
  }
});

/* ==================== ADMIN · CAMBIAR ROL ==================== */
app.post('/ania/admin/set-role', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo el superadmin puede cambiar roles' });
    const { userId, rol } = req.body || {};
    if (!userId || !['user','admin'].includes(rol))
      return res.status(400).json({ error:'rol inválido' });

    const users = await loadUsers();
    const u = users.find(x=>x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin')
      return res.status(403).json({ error:'no puedes cambiar el rol del superadmin' });

    u.rol = rol;
    u.actualizado = Date.now();
    await saveUsers(users);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ error:'error al cambiar rol' });
  }
});

/* ==================== ADMIN · BLOQUEAR/DESBLOQUEAR ==================== */
app.post('/ania/admin/toggle-block', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error:'falta userId' });

    const users = await loadUsers();
    const u = users.find(x=>x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin') return res.status(403).json({ error:'no puedes bloquear al superadmin' });
    if (u.id === req.user.id) return res.status(403).json({ error:'no puedes bloquearte a ti mismo' });

    u.bloqueado = !u.bloqueado;
    u.actualizado = Date.now();
    await saveUsers(users);
    res.json({ ok:true, bloqueado:u.bloqueado });
  }catch(e){
    console.error('toggle-block:', e);
    res.status(500).json({ error:'error al bloquear' });
  }
});

/* ==================== ADMIN · ELIMINAR USUARIO ==================== */
app.post('/ania/admin/delete-user', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo el superadmin puede eliminar cuentas' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error:'falta userId' });

    const users = await loadUsers();
    const u = users.find(x=>x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin') return res.status(403).json({ error:'no puedes eliminar al superadmin' });
    if (u.id === req.user.id) return res.status(403).json({ error:'no puedes eliminarte a ti mismo' });

    const nuevas = users.filter(x=>x.id !== userId);
    await saveUsers(nuevas);

    try{
      const mem = await loadMemories();
      if (mem[userId]){
        delete mem[userId];
        await saveMemories(mem);
      }
    }catch(e){ console.warn('no pude borrar memoria:', e.message); }

    res.json({ ok:true, eliminados: users.length - nuevas.length });
  }catch(e){
    console.error('delete-user:', e);
    res.status(500).json({ error:'error al eliminar' });
  }
});

/* ==================== ADMIN · ESTADÍSTICAS DETALLADAS ==================== */
app.get('/ania/admin/stats', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const users = await loadUsers();
    const ahora = Date.now();
    const dia = 24 * 3600 * 1000;
    res.json({
      total: users.length,
      activos: users.filter(u => u.ultimoAcceso && (ahora - u.ultimoAcceso) < 7 * dia).length,
      bloqueados: users.filter(u => u.bloqueado).length,
      admins: users.filter(u => u.rol === 'admin').length,
      superadmins: users.filter(u => u.rol === 'superadmin').length
    });
  }catch(e){
    res.status(500).json({ error:'error en stats' });
  }
});

/* ==================== PROXY DE ARCHIVOS PÚBLICOS ==================== */
// Sirve archivos de datos/ evitando CORS de raw.githubusercontent
const ARCHIVOS_PERMITIDOS = [
  'datos/security-report.json',
  'datos/sugerencias.json',
  'datos/perfiles.json',
  'datos/conocimiento.json'
];

app.get('/ania/public/:archivo', async (req, res) => {
  try {
    const archivo = 'datos/' + req.params.archivo;
    if (!ARCHIVOS_PERMITIDOS.includes(archivo))
      return res.status(403).json({ error: 'archivo no permitido' });
    const f = await ghRead(archivo);
    if (!f) return res.status(404).json({ error: 'no encontrado' });
    res.json(JSON.parse(f.content));
  } catch (e) {
    res.status(500).json({ error: 'error al leer archivo' });
  }
});

/* ==================== PERFIL DEL USUARIO ==================== */
app.get('/ania/me/perfil', auth, async (req,res)=>{
  try{
    const perfilUrl = 'https://cdn.jsdelivr.net/gh/calm291094-del/ania@main/datos/perfiles.json?t=' + Date.now();
    const r = await fetch(perfilUrl);
    if (!r.ok) return res.json({ ok:false, error:'perfil no disponible aún' });
    const perfiles = await r.json();
    const miPerfil = perfiles[req.user.id];
    if (!miPerfil) return res.json({ ok:false, error:'sin perfil generado todavía' });

    // Añadir estadísticas de memoria
    const mem = await loadMemories();
    const miMemoria = mem[req.user.id] || {};

    res.json({
      ok: true,
      perfil: miPerfil,
      stats: {
        hechos: Array.isArray(miMemoria.hechos) ? miMemoria.hechos.length : 0,
        gustos: Array.isArray(miMemoria.gustos) ? miMemoria.gustos.length : 0,
        ultimaActualizacion: miMemoria.actualizado || null
      }
    });
  }catch(e){
    console.error('me/perfil:', e);
    res.status(500).json({ error:'error al leer perfil' });
  }
});

/* ==================== ESTÁTICOS + SPA ==================== */
app.use(express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
    res.setHeader('X-Content-Type-Options','nosniff');
  }
}));

app.get('*', (req,res)=>{
  const idx = path.join(PUBLIC_DIR,'index.html');
  fs.existsSync(idx) ? res.sendFile(idx) : res.status(404).send('index.html no encontrado');
});

/* ==================== ERROR HANDLER GLOBAL ==================== */
// Captura cualquier error no manejado en rutas (debe ir al final, después del SPA)
app.use((err, req, res, next) => {
  console.error('✗ Error en ruta', req.method, req.path, ':', err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'error interno del servidor' });
});

app.listen(PORT,'0.0.0.0', ()=> console.log('ANIA backend · puerto '+PORT));
