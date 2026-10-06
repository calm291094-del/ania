// servidor-local.js · ANIA · servidor Express mínimo para uso doméstico
// Sin rate-limit, bind a 127.0.0.1, cierre limpio vía /ania/shutdown.
// Reutiliza la misma lógica de negocio que servidor.js pero con menos overhead.
const express = require('express');
const persist = require('./persistencia-local');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '127.0.0.1';  // solo local, nunca expuesto a la red
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ==================== CONFIG ==================== */
const P_KNOWLEDGE = 'datos/conocimiento.json';
const P_ADMIN_LOG = 'datos/admin-log.json';

const ANIA_SECRET  = process.env.ANIA_SECRET  || 'ania-local-dev-secret';
const TOKEN_SECRET = process.env.ANIA_TOKEN_SECRET || 'ania-local-dev-token';
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').toLowerCase() || null;

const KEY = crypto.createHash('sha256').update(ANIA_SECRET).digest();

/* ==================== HANDLERS GLOBALES ==================== */
process.on('unhandledRejection', (r) => console.error('⚠ Unhandled:', r));
process.on('uncaughtException', (e) => console.error('⚠ Uncaught:', e.message));

/* ==================== PERSISTENCIA ==================== */
async function leer(rel){
  return persist.leerCifrado(rel);
}
async function escribir(rel, obj){
  return persist.escribirCifrado(rel, obj);
}
async function leerPlano(rel, fallback){
  return persist.leerJSON(rel, fallback);
}
async function escribirPlano(rel, obj, msg){
  return persist.escribirJSON(rel, obj);
}

/* ==================== CIFRADO ==================== */
function encrypt(obj){
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj),'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}
function decrypt(b64){
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.slice(0,12), tag = buf.slice(12,28), data = buf.slice(28);
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}

/* ==================== USUARIOS ==================== */
function hashPass(p){
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(p, salt, 64).toString('hex');
}
function checkPass(p, stored){
  try{
    const [,salt,hash] = stored.split('$');
    const t = crypto.scryptSync(p, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(t,'hex'));
  }catch{ return false; }
}
function makeToken(payload){
  const body = Buffer.from(JSON.stringify({...payload, exp: Date.now() + 30*864e5})).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(tok){
  try{
    const [b,s] = tok.split('.');
    const e = crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
    const p = JSON.parse(Buffer.from(b,'base64url').toString());
    return p.exp < Date.now() ? null : p;
  }catch{ return null; }
}
async function loadUsers(){
  return persist.leerCifrado('usuarios.json') || [];
}
async function saveUsers(u){
  return persist.escribirCifrado('usuarios.json', u);
}
async function loadMemories(){
  return persist.leerCifrado('memorias.json') || {};
}
async function saveMemories(m){
  return persist.escribirCifrado('memorias.json', m);
}

function auth(req,res,next){
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/,'');
  const p = verifyToken(t);
  if (!p) return res.status(401).json({ error:'sesión inválida' });
  req.user = p; next();
}

/* ==================== ADMIN LOG ==================== */
async function logAdmin(accion, adminUser, target, detalles){
  try{
    let lista = await leerPlano(P_ADMIN_LOG, []) || [];
    lista.unshift({
      t: Date.now(), accion,
      admin: { id: adminUser.id, usuario: adminUser.usuario, rol: adminUser.rol },
      target: target || null, detalles: detalles || ''
    });
    if (lista.length > 200) lista = lista.slice(0, 200);
    await escribirPlano(P_ADMIN_LOG, lista);
  }catch(e){ console.error('✗ logAdmin:', e.message); }
}

/* ==================== MIDDLEWARE ==================== */
app.use(express.json({ limit:'2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/* ==================== HEALTH ==================== */
app.get('/ania/health', (req,res)=> res.json({ ok:true, t:Date.now(), modo:'local-desktop' }));
app.get('/ania/ping', (req,res)=> res.json({ mensaje:'Ania desktop activa' }));

/* ==================== SHUTDOWN (solo desde localhost) ==================== */
app.post('/ania/shutdown', (req, res) => {
  const host = (req.hostname || '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host))
    return res.status(403).json({ error:'solo desde localhost' });
  res.json({ ok:true, mensaje:'deteniendo' });
  console.log('🛑 Shutdown solicitado desde la app');
  setTimeout(()=> process.exit(0), 200);
});

/* ==================== TOKEN DEL AGENTE ==================== */
app.get('/ania/local-token', (req, res) => {
  const host = (req.hostname || '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host))
    return res.status(403).json({ error:'solo localhost' });
  res.json({ token: process.env.ANIA_TOKEN || null });
});

/* ==================== REGISTRO ==================== */
app.post('/ania/register', async (req,res)=>{
  try{
    const { usuario, password, nombre, email } = req.body || {};
    if (!usuario || !password || !nombre || !email)
      return res.status(400).json({ error:'faltan campos' });
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(usuario))
      return res.status(400).json({ error:'usuario inválido' });
    if (password.length < 6)
      return res.status(400).json({ error:'contraseña mínimo 6 caracteres' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error:'correo inválido' });

    const users = await loadUsers();
    if (users.some(u => u.usuario.toLowerCase() === usuario.toLowerCase()))
      return res.status(409).json({ error:'ese usuario ya existe' });
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      return res.status(409).json({ error:'ese correo ya está registrado' });

    const nuevo = {
      id: crypto.randomUUID(),
      usuario: usuario.toLowerCase(),
      nombre: nombre.trim().slice(0, 80),
      email: email.toLowerCase(),
      passwordHash: hashPass(password),
      rol: (SUPERADMIN_EMAIL && email.toLowerCase() === SUPERADMIN_EMAIL)
            ? 'superadmin' : (users.length === 0 ? 'admin' : 'user'),
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
app.post('/ania/login', async (req,res)=>{
  try{
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error:'faltan datos' });
    const users = await loadUsers();
    const u = users.find(x => x.usuario === usuario.toLowerCase() || x.email === usuario.toLowerCase());
    if (!u || !checkPass(password, u.passwordHash))
      return res.status(401).json({ error:'usuario o contraseña incorrectos' });
    if (u.bloqueado === true)
      return res.status(403).json({ error:'cuenta bloqueada' });
    u.ultimoAcceso = Date.now();
    if (SUPERADMIN_EMAIL && u.email === SUPERADMIN_EMAIL && u.rol !== 'superadmin')
      u.rol = 'superadmin';
    await saveUsers(users);
    const token = makeToken({ id:u.id, usuario:u.usuario, rol:u.rol });
    res.json({ ok:true, token, usuario:{ id:u.id, usuario:u.usuario, nombre:u.nombre, email:u.email, rol:u.rol }});
  }catch(e){
    console.error('login:', e);
    res.status(500).json({ error:'error al iniciar sesión' });
  }
});

/* ==================== CONOCIMIENTO ==================== */
app.get('/ania/knowledge', async (req,res)=>{
  try{ res.json(await leerPlano(P_KNOWLEDGE, []) || []); }
  catch{ res.json([]); }
});
app.post('/ania/knowledge', auth, async (req,res)=>{
  try{
    const { clave, valor, categoria } = req.body || {};
    if (!clave || !valor) return res.status(400).json({ error:'falta clave o valor' });
    let lista = await leerPlano(P_KNOWLEDGE, []) || [];
    const k = String(clave).toLowerCase().trim();
    const existing = lista.find(e => e.clave === k);
    if (existing){
      if (!existing.valores.includes(String(valor))) existing.valores.push(String(valor));
      existing.votos = (existing.votos || 1) + 1;
    } else {
      lista.push({ clave:k, valores:[String(valor)], categoria:categoria||'general', votos:1, t:Date.now() });
    }
    if (lista.length > 2000) lista = lista.slice(-2000);
    await escribirPlano(P_KNOWLEDGE, lista);
    res.json({ ok:true, total:lista.length });
  }catch(e){ res.status(500).json({ error:'error al guardar' }); }
});

/* ==================== MEMORIA ==================== */
app.get('/ania/me/memoria', auth, async (req,res)=>{
  try{
    const m = await loadMemories();
    res.json(m[req.user.id] || { nombre:null, gustos:[], hechos:[], tareas:[], diario:[] });
  }catch{ res.json({}); }
});
app.post('/ania/me/memoria', auth, async (req,res)=>{
  try{
    const m = await loadMemories();
    m[req.user.id] = { ...(m[req.user.id] || {}), ...req.body, actualizado:Date.now() };
    await saveMemories(m);
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:'no pude guardar' }); }
});

/* ==================== CAMBIO DE CONTRASEÑA ==================== */
app.post('/ania/me/password', auth, async (req,res)=>{
  try{
    const { actual, nueva } = req.body || {};
    if (!actual || !nueva) return res.status(400).json({ error:'faltan datos' });
    if (nueva.length < 6) return res.status(400).json({ error:'mínimo 6 caracteres' });
    const users = await loadUsers();
    const u = users.find(x => x.id === req.user.id);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (!checkPass(actual, u.passwordHash))
      return res.status(401).json({ error:'contraseña actual incorrecta' });
    u.passwordHash = hashPass(nueva);
    u.actualizado = Date.now();
    await saveUsers(users);
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:'error al cambiar contraseña' }); }
});

/* ==================== ADMIN ==================== */
app.get('/ania/admin/users', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const users = await loadUsers();
    const publicos = users.map(u => ({
      id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.email,
      rol: u.rol, creado: u.creado,
      ultimoAcceso: u.ultimoAcceso || null,
      bloqueado: !!u.bloqueado
    }));
    res.json({ ok:true, total:users.length, usuarios:publicos });
  }catch(e){ res.status(500).json({ error:'error al listar' }); }
});

app.get('/ania/admin/knowledge-stats', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const users = await loadUsers();
    const memorias = await loadMemories();
    const kb = await leerPlano(P_KNOWLEDGE, []) || [];
    res.json({
      totalUsuarios: users.length,
      totalMemorias: Object.keys(memorias).length,
      totalConocimiento: kb.length,
      topConocimiento: kb.sort((a,b) => (b.votos||1) - (a.votos||1)).slice(0, 10)
    });
  }catch(e){ res.status(500).json({ error:'error en stats' }); }
});

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
  }catch(e){ res.status(500).json({ error:'error en stats' }); }
});

app.get('/ania/admin/log', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const lista = await leerPlano(P_ADMIN_LOG, []) || [];
    res.json({ ok:true, total:lista.length, log:lista.slice(0, 50) });
  }catch(e){ res.status(500).json({ error:'error al leer log' }); }
});

app.post('/ania/admin/reset-password', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const { userId, nueva } = req.body || {};
    if (!userId || !nueva) return res.status(400).json({ error:'faltan datos' });
    if (nueva.length < 6) return res.status(400).json({ error:'mínimo 6 caracteres' });
    const users = await loadUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'no puedes tocar al superadmin' });
    u.passwordHash = hashPass(nueva);
    u.actualizado = Date.now();
    await saveUsers(users);
    logAdmin('reset-password', req.user, { id:u.id, usuario:u.usuario }, '');
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:'error al resetear' }); }
});

app.post('/ania/admin/set-role', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo superadmin' });
    const { userId, rol } = req.body || {};
    if (!userId || !['user','admin'].includes(rol))
      return res.status(400).json({ error:'rol inválido' });
    const users = await loadUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin') return res.status(403).json({ error:'no puedes cambiar superadmin' });
    const rolAnterior = u.rol;
    u.rol = rol;
    u.actualizado = Date.now();
    await saveUsers(users);
    logAdmin('cambiar-rol', req.user, { id:u.id, usuario:u.usuario }, rolAnterior + ' → ' + rol);
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:'error al cambiar rol' }); }
});

app.post('/ania/admin/toggle-block', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'admin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo administradores' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error:'falta userId' });
    const users = await loadUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin') return res.status(403).json({ error:'no puedes bloquear superadmin' });
    if (u.id === req.user.id) return res.status(403).json({ error:'no puedes bloquearte' });
    u.bloqueado = !u.bloqueado;
    u.actualizado = Date.now();
    await saveUsers(users);
    logAdmin(u.bloqueado ? 'bloquear' : 'desbloquear', req.user, { id:u.id, usuario:u.usuario }, '');
    res.json({ ok:true, bloqueado:u.bloqueado });
  }catch(e){ res.status(500).json({ error:'error al bloquear' }); }
});

app.post('/ania/admin/delete-user', auth, async (req,res)=>{
  try{
    if (req.user.rol !== 'superadmin')
      return res.status(403).json({ error:'solo superadmin' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error:'falta userId' });
    const users = await loadUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error:'usuario no encontrado' });
    if (u.rol === 'superadmin') return res.status(403).json({ error:'no puedes eliminar superadmin' });
    if (u.id === req.user.id) return res.status(403).json({ error:'no puedes eliminarte' });
    const nuevas = users.filter(x => x.id !== userId);
    await saveUsers(nuevas);
    try{
      const mem = await loadMemories();
      if (mem[userId]){ delete mem[userId]; await saveMemories(mem); }
    }catch(e){ console.warn('no pude borrar memoria:', e.message); }
    logAdmin('eliminar-usuario', req.user, { id:u.id, usuario:u.usuario, email:u.email }, '');
    res.json({ ok:true, eliminados: users.length - nuevas.length });
  }catch(e){ res.status(500).json({ error:'error al eliminar' }); }
});

/* ==================== PÚBLICOS ==================== */
const ARCHIVOS_PERMITIDOS = ['security-report.json','sugerencias.json','conocimiento.json'];
app.get('/ania/public/:archivo', async (req, res) => {
  try{
    const soloNombre = req.params.archivo;
    if (!ARCHIVOS_PERMITIDOS.includes(soloNombre))
      return res.status(403).json({ error:'archivo no permitido' });
    const archivo = 'datos/' + soloNombre;
    const datos = await leerPlano(archivo, null);
    if (datos === null) return res.status(404).json({ error:'no encontrado' });
    res.json(datos);
  }catch(e){ res.status(500).json({ error:'error al leer archivo' }); }
});

/* ==================== ENTRENAMIENTO ==================== */
app.get('/ania/entrenamiento', async (req, res) => {
  try{
    let datos = await leerPlano('datos/entrenamiento-ania.json', null);
    if (!datos) datos = await leerPlano('documentos/entrenamiento-ania.json', null);
    if (!datos) return res.status(404).json({ error: 'entrenamiento no encontrado' });
    res.json(datos);
  }catch(e){
    console.error('entrenamiento:', e.message);
    res.status(500).json({ error: 'error al leer entrenamiento' });
  }
});

/* ==================== PERFIL ==================== */
app.get('/ania/me/perfil', auth, async (req,res)=>{
  try{
    const perfiles = await leerPlano('datos/perfiles.json', null);
    if (!perfiles) return res.json({ ok:false, error:'sin perfil generado' });
    const miPerfil = perfiles[req.user.id];
    if (!miPerfil) return res.json({ ok:false, error:'sin perfil generado' });
    const mem = await loadMemories();
    const miMemoria = mem[req.user.id] || {};
    res.json({
      ok: true, perfil: miPerfil,
      stats: {
        hechos: Array.isArray(miMemoria.hechos) ? miMemoria.hechos.length : 0,
        gustos: Array.isArray(miMemoria.gustos) ? miMemoria.gustos.length : 0,
        ultimaActualizacion: miMemoria.actualizado || null
      }
    });
  }catch(e){ res.status(500).json({ error:'error al leer perfil' }); }
});

/* ==================== MÓDULOS DE NEGOCIO ==================== */
try {
  require('./modulos-backend')(app, { auth, leer, escribir, loadUsers });
} catch (e) {
  console.warn('⚠ modulos-backend.js no disponible:', e.message);
}

/* ==================== ESTÁTICOS ==================== */
app.use(express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get('*', (req, res) => {
  if (/\.(js|css|wasm|task|json|png|svg|woff2?|ttf|eot|map|h5|tar\.gz)$/i.test(req.path))
    return res.status(404).send('Archivo no encontrado');
  const idx = path.join(PUBLIC_DIR, 'index.html');
  const fs = require('fs');
  fs.existsSync(idx) ? res.sendFile(idx) : res.status(404).send('index.html no encontrado');
});

/* ==================== ERROR HANDLER ==================== */
app.use((err, req, res, next) => {
  console.error('✗ Error:', req.method, req.path, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'error interno' });
});

/* ==================== ARRANQUE ==================== */
const server = app.listen(PORT, HOST, () => {
  console.log('ANIA DESKTOP · http://' + HOST + ':' + PORT);
});

module.exports = { app, server, PORT };
