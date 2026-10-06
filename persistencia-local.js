// persistencia-local.js · ANIA · almacenamiento local-first
// Escribe y lee archivos cifrados (AES-256-GCM) o JSON plano desde ./datos/
// Se usa cuando ANIA_MODO=local o cuando no hay GITHUB_TOKEN.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, 'datos');
const SECRET = process.env.ANIA_SECRET;
if (!SECRET){
  console.error('✖ FATAL: falta ANIA_SECRET. Ejecuta ania.py para generarlo.');
  process.exit(1);
}
const KEY = crypto.createHash('sha256').update(SECRET).digest();

function asegurarDir(p){
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function rutaAbs(rel){
  // Seguridad: evitar escapes con ../
  const limpio = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
  if (limpio.includes('..')) throw new Error('ruta inválida: ' + rel);
  return path.join(RAIZ, limpio);
}

function existe(rel){
  try { return fs.existsSync(rutaAbs(rel)); } catch(e){ return false; }
}

function borrar(rel){
  try{ fs.unlinkSync(rutaAbs(rel)); return true; }catch(e){ return false; }
}

/* ---------- JSON plano (sin cifrar) ---------- */
function leerJSON(rel, fallback){
  const abs = rutaAbs(rel);
  if (!fs.existsSync(abs)) return fallback;
  try{ return JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch(e){ console.warn('[persist] JSON corrupto:', rel, e.message); return fallback; }
}

function escribirJSON(rel, obj){
  const abs = rutaAbs(rel);
  asegurarDir(path.dirname(abs));
  const tmp = abs + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, abs);   // rename es atómico
}

/* ---------- Cifrado AES-256-GCM (mismo formato que la nube) ---------- */
function leerCifrado(rel){
  const abs = rutaAbs(rel);
  if (!fs.existsSync(abs)) return null;
  try{
    const raw = fs.readFileSync(abs, 'utf8').trim();
    if (!raw) return null;
    const buf = Buffer.from(raw, 'base64');
    if (buf.length < 28) return null;
    const iv = buf.slice(0, 12), tag = buf.slice(12, 28), data = buf.slice(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
  }catch(e){
    console.warn('[persist] cifrado inválido:', rel, e.message);
    return null;
  }
}

function escribirCifrado(rel, obj){
  const abs = rutaAbs(rel);
  asegurarDir(path.dirname(abs));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  const out = Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
  const tmp = abs + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, abs);
}

/* ---------- Utilidades ---------- */
function rutaUsuario(carpeta, userId){
  return carpeta + '/' + userId + '.json';
}

function listarTodos(){
  const out = [];
  function walk(dir, prefijo){
    let items;
    try{ items = fs.readdirSync(dir, { withFileTypes:true }); }catch(e){ return; }
    for(const it of items){
      const rel = prefijo ? prefijo + '/' + it.name : it.name;
      if (it.isDirectory()) walk(path.join(dir, it.name), rel);
      else if (it.isFile() && !it.name.includes('.tmp.')) {
        try{ out.push({ rel, size: fs.statSync(path.join(dir, it.name)).size }); }catch(e){}
      }
    }
  }
  if (fs.existsSync(RAIZ)) walk(RAIZ, '');
  return out;
}

function stats(){
  const todo = listarTodos();
  const totalBytes = todo.reduce((a,f) => a + f.size, 0);
  return { archivos: todo.length, bytes: totalBytes, raiz: RAIZ };
}

module.exports = {
  leerCifrado, escribirCifrado,
  leerJSON, escribirJSON,
  existe, borrar, listarTodos, stats,
  rutaUsuario,
  RAIZ
};
