// agente/personalizacion.js · Ania Personalization Agent v1
// Analiza la memoria privada de cada usuario y genera perfiles anonimizados
const fs = require('fs');
const crypto = require('crypto');

const ANIA_SECRET = process.env.ANIA_SECRET;
if (!ANIA_SECRET){
  console.error('✗ Falta ANIA_SECRET');
  process.exit(1);
}

const KEY = crypto.createHash('sha256').update(ANIA_SECRET).digest();
const RUTA_MEMORIAS  = 'datos/memorias.enc.json';
const RUTA_USUARIOS  = 'datos/usuarios.enc.json';
const RUTA_PERFILES  = 'datos/perfiles.json';

function decrypt(b64){
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.slice(0,12), tag = buf.slice(12,28), data = buf.slice(28);
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}

// Detecta temas por palabras clave
const TEMAS = {
  cafe:      /caf[eé]|espresso|barista|grano|latte/i,
  anime:     /anime|manga|isekai|rimuru|ainz|subaru/i,
  tech:      /program|c[oó]digo|codigo|javascript|python|app|software/i,
  astronomia:/estrella|luna|planeta|galax|astro|cosmos/i,
  zombies:   /zombie|apocalipsis|walking|supervivencia/i,
  comida:    /comida|cocina|receta|pan|pizza|hambre/i,
  trabajo:   /trabajo|reuni[oó]n|proyecto|jefe|empresa/i,
  salud:     /salud|enfermo|m[eé]dico|dolor|ejercicio/i
};

// Tono del usuario
function detectarTono(textos){
  const t = textos.join(' ').toLowerCase();
  let formal = 0, informal = 0, emojis = 0, urgente = 0;
  if (/\b(usted|sr|sra|se[ñn]or|por favor|gracias)\b/.test(t)) formal += 2;
  if (/\b(oye|che|t[íi]o|bro|hey|qu[eé] tal)\b/.test(t)) informal += 2;
  emojis = (t.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (/urgente|ya mismo|r[aá]pido|corre|ayuda|emergencia/.test(t)) urgente += 2;
  let tono = 'neutro';
  if (formal > informal + 2) tono = 'formal';
  else if (informal > formal + 2) tono = 'informal';
  if (emojis > 3) tono += '-expresivo';
  if (urgente > 2) tono += '-urgente';
  return tono;
}

// Hora del día más activa
function detectarHorario(timestamps){
  if (!timestamps.length) return 'variable';
  const horas = timestamps.map(t => new Date(t).getHours());
  const promedio = horas.reduce((a,b)=>a+b, 0) / horas.length;
  if (promedio >= 5  && promedio < 12) return 'mañana';
  if (promedio >= 12 && promedio < 18) return 'tarde';
  if (promedio >= 18 && promedio < 23) return 'noche';
  return 'madrugada';
}

async function main(){
  console.log('🧠 Ania Personalization Agent iniciado');
  const perfiles = {};

  // 1. Leer usuarios
  if (!fs.existsSync(RUTA_USUARIOS)){
    console.log('⚠ No hay usuarios. Nada que hacer.');
    return;
  }
  const usersRaw = fs.readFileSync(RUTA_USUARIOS, 'utf8');
  const users = decrypt(usersRaw);
  console.log(`✓ ${users.length} usuarios leídos`);

  // 2. Leer memorias
  let memorias = {};
  if (fs.existsSync(RUTA_MEMORIAS)){
    try{ memorias = decrypt(fs.readFileSync(RUTA_MEMORIAS, 'utf8')); }catch{}
  }
  console.log(`✓ ${Object.keys(memorias).length} memorias leídas`);

  // 3. Analizar cada usuario
  for (const u of users){
    const mem = memorias[u.id] || {};
    const hechos = Array.isArray(mem.hechos) ? mem.hechos : [];
    const gustos = Array.isArray(mem.gustos) ? mem.gustos : [];

    // Textos del usuario (de hechos y gustos)
    const textos = hechos.map(h => String(h.valor || '')).concat(gustos.map(g => String(g)));
    const timestamps = hechos.map(h => h.t).filter(Boolean);

    // Temas detectados
    const temasContados = {};
    for (const [tema, re] of Object.entries(TEMAS)){
      const n = textos.filter(t => re.test(t)).length;
      if (n > 0) temasContados[tema] = n;
    }
    const temasTop = Object.entries(temasContados)
      .sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([t])=>t);

    // Métricas
    const longitudMedia = textos.length ? Math.round(textos.reduce((a,t)=>a+t.length,0)/textos.length) : 0;

    perfiles[u.id] = {
      usuario: u.usuario,
      nombre: u.nombre,
      temas: temasTop,
      tono: detectarTono(textos),
      horario: detectarHorario(timestamps),
      longitudMedia,
      interacciones: textos.length,
      actualizado: Date.now()
    };
  }

  // 4. Guardar
  if (!fs.existsSync('datos')) fs.mkdirSync('datos');
  fs.writeFileSync(RUTA_PERFILES, JSON.stringify(perfiles, null, 2));
  console.log(`✅ Perfiles guardados en ${RUTA_PERFILES} (${Object.keys(perfiles).length} usuarios)`);

  // 5. Log de resumen
  for (const [id, p] of Object.entries(perfiles)){
    console.log(`  · @${p.usuario} → ${p.temas.join(', ') || 'sin temas'} · ${p.tono} · ${p.horario}`);
  }
}

main().catch(e => {
  console.error('✗ Error fatal:', e.message);
  process.exit(1);
});
