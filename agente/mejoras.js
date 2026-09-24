// agente/mejoras.js · Ania Auto-Agent v2
// Analiza el código y guarda sugerencias en datos/sugerencias.json
// Ejecutado por GitHub Actions (ver .github/workflows/agent.yml)
const fs = require('fs');
const path = require('path');

/* ===================================================================
   UTILIDADES
=================================================================== */

// Extrae el primer objeto JSON balanceado de un texto (ignora markdown)
function extraerJSON(texto){
  // 1. Limpiar markdown
  let t = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Intento directo
  try{ return JSON.parse(t); }catch{}

  // 3. Buscar desde cada '{' y contar llaves balanceadas
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

// Pregunta a un modelo concreto
async function preguntarIA(prompt, modelo){
  console.log('  → Modelo:', modelo);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try{
    const r = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        seed: Math.floor(Math.random() * 1000000)
      })
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.choices && j.choices[0] && j.choices[0].message.content) || '';
  }catch(e){
    clearTimeout(timer);
    throw e;
  }
}

// Prueba varios modelos hasta obtener JSON válido con mejoras
async function obtenerMejoras(promptBase){
  const modelos = ['openai', 'mistral', 'openai-large'];
  for (const modelo of modelos){
    try{
      const texto = await preguntarIA(promptBase, modelo);
      if (!texto || texto.length < 30){
        console.log('  ⚠ Respuesta corta, siguiente modelo');
        continue;
      }
      const data = extraerJSON(texto);
      if (data && Array.isArray(data.mejoras) && data.mejoras.length > 0){
        console.log('  ✓ JSON válido con', data.mejoras.length, 'mejoras');
        return { data, texto, modelo };
      }
      console.log('  ⚠ JSON inválido o sin mejoras, siguiente modelo');
    }catch(e){
      console.log('  ✗ Fallo:', e.message);
    }
  }
  return null;
}

/* ===================================================================
   MAIN
=================================================================== */
async function main(){
  console.log('🤖 Ania Auto-Agent v2 iniciado');
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

  // Stats del index.html sin enviarlo completo
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

  // Recortar servidor.js si es enorme (para no exceder contexto)
  const servidor = (codigo['servidor.js'] || '').slice(0, 12000);

  const resumen =
`=== servidor.js ===
${servidor}

=== package.json ===
${codigo['package.json'] || '(no disponible)'}

=== FRONTEND ===
${indexStats}`;

  const prompt = `Eres un revisor de código senior. Analiza este proyecto ANIA (asistente personal con Node.js/Express + HTML/JS vanilla, alojado en Render y GitHub Pages) y da EXACTAMENTE 5 mejoras.

CONTEXTO: Registro con scrypt, tokens HMAC, memoria cifrada AES-256-GCM en GitHub, cerebro colectivo, PWA offline, backend usa API de GitHub como DB.

CÓDIGO:
${resumen}

INSTRUCCIONES ESTRICTAS:
- Devuelve SOLO un objeto JSON, sin texto antes ni después, sin markdown, sin \`\`\`.
- El JSON debe tener una clave "mejoras" con un array de EXACTAMENTE 5 objetos.
- Cada objeto debe tener: titulo, categoria, prioridad, descripcion, como.
- categoria: una de [seguridad, rendimiento, ux, bug, feature].
- prioridad: una de [alta, media, baja].
- titulo: máximo 60 caracteres.
- descripcion: 2 frases explicando qué mejorar y por qué.
- como: 2 frases explicando cómo implementarlo.

EJEMPLO del formato EXACTO esperado:
{"mejoras":[{"titulo":"Rate limiting en login","categoria":"seguridad","prioridad":"alta","descripcion":"Sin límite de intentos, un atacante puede probar contraseñas. Añadir throttling protege las cuentas.","como":"Instalar express-rate-limit y aplicar 5 intentos por 15 min por IP en /ania/login. Guardar bloqueos en memoria o Redis."},{"titulo":"Compresión gzip","categoria":"rendimiento","prioridad":"media","descripcion":"Las respuestas JSON viajan sin comprimir. Reducir tamaño mejora tiempos.","como":"Añadir middleware compression de Express. Beneficio doble si se cachean respuestas."},{"titulo":"Mensajes de error claros","categoria":"ux","prioridad":"media","descripcion":"Algunos errores del backend son técnicos. El usuario no entiende qué pasa.","como":"Mapear códigos de error a mensajes en español. Ej: 409 a 'ese usuario ya existe'."},{"titulo":"Validar email con verificación","categoria":"bug","prioridad":"baja","descripcion":"Se aceptan correos sin confirmar. Un typo bloquea la cuenta para siempre.","como":"Enviar email de confirmación con token temporal. Marcar usuario como verificado tras el clic."},{"titulo":"Exportar memoria del usuario","categoria":"feature","prioridad":"baja","descripcion":"El usuario no puede descargar sus datos. GDPR exige portabilidad.","como":"Endpoint GET /ania/me/export que devuelva JSON con toda su memoria. Botón en Ajustes."}]}

Ahora responde con el JSON real de análisis del código de arriba.`;

  console.log('📤 Enviando a IA...');
  const resultado = await obtenerMejoras(prompt);

  if (!resultado){
    console.error('✗ Ningún modelo devolvió JSON válido');
    // Guardar el error para debug
    if (!fs.existsSync('datos')) fs.mkdirSync('datos');
    fs.writeFileSync('datos/ultimo-error.txt',
      'Fecha: ' + new Date().toISOString() + '\n' +
      'Motivo: ningún modelo devolvió JSON con mejoras\n'
    );
    process.exit(1);
  }

  const { data, modelo } = resultado;
  data.fecha = new Date().toISOString();
  data.analizadoPor = 'Ania Auto-Agent v2 (' + modelo + ')';
  data.archivosAnalizados = Object.keys(codigo);
  data.duracionMs = Date.now() - inicio;

  // Normalizar mejoras
  data.mejoras = data.mejoras.map(m => ({
    titulo: String(m.titulo || 'Sin título').slice(0, 100),
    categoria: ['seguridad','rendimiento','ux','bug','feature'].includes(m.categoria) ? m.categoria : 'feature',
    prioridad: ['alta','media','baja'].includes(m.prioridad) ? m.prioridad : 'media',
    descripcion: String(m.descripcion || '').slice(0, 500),
    como: String(m.como || '').slice(0, 500)
  }));

  // Guardar en historial (últimos 5)
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

  // Borrar archivo de error si existía
  try{ if (fs.existsSync('datos/ultimo-error.txt')) fs.unlinkSync('datos/ultimo-error.txt'); }catch{}

  console.log(`✅ Guardado en ${ruta} (${data.mejoras.length} mejoras, modelo: ${modelo})`);
  data.mejoras.forEach((m, i) => {
    console.log(`  ${i+1}. [${m.categoria}/${m.prioridad}] ${m.titulo}`);
  });
}

main().catch(e => {
  console.error('✗ Error fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
