// agente/mejoras.js · Ania Auto-Agent v3
// Analiza el código y guarda sugerencias en datos/sugerencias.json
// Ejecutado por GitHub Actions (ver .github/workflows/agent.yml)
const fs = require('fs');
const path = require('path');

/* ===================================================================
   UTILIDADES
=================================================================== */

// Extrae el primer objeto JSON balanceado de un texto
function extraerJSON(texto){
  let t = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try{ return JSON.parse(t); }catch{}

  for (let i = 0; i < t.length; i++){
    if (t[i] !== '{') continue;
    let depth = 0, inString = false, escape = false;
    for (let j = i; j < t.length; j++){
      const c = t[j];
      if (escape){ escape = false; continue; }
      if (c === '\\'){ escape = true; continue; }
      if (c === '"'){ inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}'){
        depth--;
        if (depth === 0){
          const bloque = t.slice(i, j+1);
          try{ return JSON.parse(bloque); }catch{ break; }
        }
      }
    }
  }
  return null;
}

// Pregunta a un endpoint con timeout controlado
async function preguntar(url, body, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try{
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(body)
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    try{
      const j = JSON.parse(text);
      return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || text;
    }catch{
      return text;
    }
  }catch(e){
    clearTimeout(timer);
    throw e;
  }
}

/* ===================================================================
   SUGERENCIAS PREDEFINIDAS (fallback local si la IA falla)
=================================================================== */
const FALLBACK_MEJORAS = [
  {
    titulo: 'Rate limiting en login',
    categoria: 'seguridad',
    prioridad: 'alta',
    descripcion: 'Sin límite de intentos, un atacante puede probar contraseñas por fuerza bruta. Añadir throttling protege las cuentas.',
    como: 'Instalar express-rate-limit y aplicar 5 intentos por 15 min por IP en /ania/login. Guardar bloqueos en memoria.'
  },
  {
    titulo: 'Validación de email',
    categoria: 'seguridad',
    prioridad: 'alta',
    descripcion: 'Se aceptan correos sin verificar. Un typo bloquea la cuenta para siempre y permite registros falsos.',
    como: 'Enviar email de confirmación con token temporal al registrarse. Marcar usuario como verificado tras el clic.'
  },
  {
    titulo: 'HTTPS forzado en cookies',
    categoria: 'seguridad',
    prioridad: 'media',
    descripcion: 'Los tokens viajan en headers pero no se fuerza HTTPS. En redes públicas podría haber interceptación.',
    como: 'Añadir middleware que redirija HTTP a HTTPS en producción. En Render ya es automático, pero validar.'
  },
  {
    titulo: 'Compresión gzip',
    categoria: 'rendimiento',
    prioridad: 'media',
    descripcion: 'Las respuestas JSON viajan sin comprimir. Reducir tamaño mejora tiempos de carga en móvil.',
    como: 'Añadir middleware compression de Express con umbral de 1KB. Beneficio doble si se cachean respuestas.'
  },
  {
    titulo: 'Exportar memoria del usuario',
    categoria: 'feature',
    prioridad: 'baja',
    descripcion: 'El usuario no puede descargar sus datos. La portabilidad de datos es un derecho y mejora la confianza.',
    como: 'Endpoint GET /ania/me/export que devuelva JSON con toda su memoria. Botón en Ajustes.'
  }
];

/* ===================================================================
   MAIN
=================================================================== */
async function main(){
  console.log('🤖 Ania Auto-Agent v3 iniciado');
  const inicio = Date.now();

  // Leer archivos clave
  const archivos = ['servidor.js', 'package.json'];
  const codigo = {};
  for (const f of archivos){
    try{
      codigo[f] = fs.readFileSync(f, 'utf8');
      console.log('✓ Leído:', f, `(${codigo[f].length} chars)`);
    }catch(e){ console.warn('✗ No pude leer:', f); }
  }

  // Stats del index.html
  let indexStats = '';
  try{
    const idx = fs.readFileSync('public/index.html', 'utf8');
    const lineas = idx.split('\n').length;
    const scripts = (idx.match(/<script/g) || []).length;
    const funciones = (idx.match(/function\s+\w+/g) || []).length;
    const fetchCalls = (idx.match(/fetch\(/g) || []).length;
    const listeners = (idx.match(/addEventListener/g) || []).length;
    indexStats = `public/index.html: ${lineas} líneas, ${scripts} <script>, ${funciones} funciones, ${fetchCalls} fetch(), ${listeners} addEventListener`;
  }catch(e){ indexStats = '(index.html no disponible)'; }

  const servidor = (codigo['servidor.js'] || '').slice(0, 10000);

  const prompt = `Analiza este código Node.js/Express y da EXACTAMENTE 5 mejoras.

CÓDIGO:
=== servidor.js ===
${servidor}

=== package.json ===
${codigo['package.json'] || '(no disponible)'}

=== FRONTEND ===
${indexStats}

Devuelve SOLO un objeto JSON válido, sin markdown, sin texto extra:
{"mejoras":[{"titulo":"...","categoria":"seguridad|rendimiento|ux|bug|feature","prioridad":"alta|media|baja","descripcion":"2 frases","como":"2 frases"}, ... 5 objetos en total ...]}`;

  console.log('📤 Enviando a IA...');

  // Intentar varios endpoints y modelos
  const intentos = [
    { url: 'https://text.pollinations.ai/openai', modelo: 'openai', timeout: 45000 },
    { url: 'https://text.pollinations.ai/openai', modelo: 'mistral', timeout: 45000 },
    { url: 'https://gen.pollinations.ai/v1/chat/completions', modelo: 'openai', timeout: 45000 },
    { url: 'https://text.pollinations.ai/openai', modelo: 'openai-large', timeout: 60000 }
  ];

  let data = null;
  let modeloUsado = null;

  for (const intento of intentos){
    try{
      console.log('  → Probando:', intento.url, '| modelo:', intento.modelo);
      const texto = await preguntar(intento.url, {
        model: intento.modelo,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        seed: Math.floor(Math.random() * 1000000)
      }, intento.timeout);

      if (!texto || texto.length < 50){
        console.log('  ⚠ Respuesta corta (' + (texto ? texto.length : 0) + ' chars)');
        continue;
      }
      console.log('  ✓ Respuesta: ' + texto.length + ' chars');

      const parsed = extraerJSON(texto);
      if (parsed && Array.isArray(parsed.mejoras) && parsed.mejoras.length > 0){
        data = parsed;
        modeloUsado = intento.modelo + ' @ ' + intento.url.replace('https://', '');
        console.log('  ✓ JSON válido con ' + parsed.mejoras.length + ' mejoras');
        break;
      }
      console.log('  ⚠ JSON inválido o sin mejoras');
    }catch(e){
      console.log('  ✗ Fallo:', e.message);
    }
  }

  // Si ningún modelo funcionó → usar fallback local
  if (!data){
    console.log('⚠ Ninguna IA respondió. Usando sugerencias predefinidas.');
    data = { mejoras: FALLBACK_MEJORAS };
    modeloUsado = 'fallback-local (la IA no respondió)';
  }

  // Metadatos
  data.fecha = new Date().toISOString();
  data.analizadoPor = 'Ania Auto-Agent v3 (' + modeloUsado + ')';
  data.archivosAnalizados = Object.keys(codigo);
  data.duracionMs = Date.now() - inicio;
  data.fuente = modeloUsado.startsWith('fallback') ? 'fallback' : 'ia';

  // Normalizar mejoras
  data.mejoras = data.mejoras.map(m => ({
    titulo: String(m.titulo || 'Sin título').slice(0, 100),
    categoria: ['seguridad','rendimiento','ux','bug','feature'].includes(m.categoria) ? m.categoria : 'feature',
    prioridad: ['alta','media','baja'].includes(m.prioridad) ? m.prioridad : 'media',
    descripcion: String(m.descripcion || '').slice(0, 500),
    como: String(m.como || '').slice(0, 500)
  }));

  // Guardar en historial
  const ruta = 'datos/sugerencias.json';
  let historial = [];
  try{
    if (fs.existsSync(ruta)){
      historial = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      if (!Array.isArray(historial)) historial = [];
    }
  }catch{}

  historial.unshift(data);
  if (historial.length > 5) historial = historial.slice(0, 5);

  if (!fs.existsSync('datos')) fs.mkdirSync('datos');
  fs.writeFileSync(ruta, JSON.stringify(historial, null, 2));

  console.log('✅ Guardado en ' + ruta + ' (' + data.mejoras.length + ' mejoras)');
  console.log('   Fuente: ' + data.fuente + ' · Duración: ' + data.duracionMs + 'ms');
  data.mejoras.forEach((m, i) => {
    console.log('  ' + (i+1) + '. [' + m.categoria + '/' + m.prioridad + '] ' + m.titulo);
  });
}

main().catch(e => {
  console.error('✗ Error fatal:', e.message);
  console.error(e.stack);
  // Aun con error fatal, guardar fallback para no dejar sin datos
  try{
    const data = {
      mejoras: FALLBACK_MEJORAS,
      fecha: new Date().toISOString(),
      analizadoPor: 'Ania Auto-Agent v3 (error crítico)',
      fuente: 'fallback',
      error: e.message
    };
    if (!fs.existsSync('datos')) fs.mkdirSync('datos');
    const ruta = 'datos/sugerencias.json';
    let historial = [];
    try{ historial = JSON.parse(fs.readFileSync(ruta, 'utf8')); }catch{}
    if (!Array.isArray(historial)) historial = [];
    historial.unshift(data);
    if (historial.length > 5) historial = historial.slice(0, 5);
    fs.writeFileSync(ruta, JSON.stringify(historial, null, 2));
    console.log('✅ Guardado fallback por error crítico');
  }catch{}
  process.exit(0); // NO fallar el workflow
});
