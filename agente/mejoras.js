// agente/mejoras.js · Ania Auto-Agent
// Analiza el código y guarda sugerencias en datos/sugerencias.json
// Ejecutado por GitHub Actions (ver .github/workflows/agent.yml)
const fs = require('fs');
const path = require('path');

async function main(){
  console.log('🤖 Ania Auto-Agent iniciado');

  // Leer archivos clave
  const archivos = ['servidor.js', 'package.json'];
  const codigo = {};
  for (const f of archivos){
    try{
      codigo[f] = fs.readFileSync(f, 'utf8');
      console.log('✓ Leído:', f, `(${codigo[f].length} chars)`);
    }catch(e){ console.warn('✗ No pude leer:', f); }
  }

  // Leer tamaño del index.html sin enviarlo completo (es enorme)
  let indexStats = '';
  try{
    const idx = fs.readFileSync('public/index.html', 'utf8');
    const lineas = idx.split('\n').length;
    const scripts = (idx.match(/<script/g) || []).length;
    const funciones = (idx.match(/function\s+\w+/g) || []).length;
    const fetchCalls = (idx.match(/fetch\(/g) || []).length;
    const addEventListeners = (idx.match(/addEventListener/g) || []).length;
    indexStats = `public/index.html:
  - ${lineas} líneas
  - ${scripts} bloques <script>
  - ${funciones} funciones declaradas
  - ${fetchCalls} llamadas fetch()
  - ${addEventListeners} addEventListener`;
  }catch(e){ indexStats = '(index.html no disponible)'; }

  const resumen =
`=== servidor.js ===
${codigo['servidor.js'] || '(no disponible)'}

=== package.json ===
${codigo['package.json'] || '(no disponible)'}

=== ESTADÍSTICAS del frontend ===
${indexStats}`;

  const prompt = `Eres un revisor experto de código senior. Analiza este proyecto y sugiere 5 mejoras CONCRETAS y PRIORIZADAS.

Proyecto: ANIA, asistente personal con:
- Backend Node.js/Express desplegado en Render (gratis)
- Frontend HTML/JS vanilla en GitHub Pages
- Registro de usuarios con scrypt, tokens HMAC
- Memoria privada cifrada (AES-256-GCM) en GitHub
- Cerebro colectivo (conocimiento compartido)
- PWA, voz, HUD, agente PC opcional
- El backend usa la API de GitHub como base de datos (datos/usuarios.enc.json, datos/memorias.enc.json, datos/conocimiento.json)

Analiza el código y sugiere 5 mejoras en estas áreas (prioriza seguridad y bugs):
1. Seguridad (vulnerabilidades, fugas, malas prácticas)
2. Rendimiento (cuellos de botella)
3. UX (experiencia del usuario)
4. Bugs (problemas potenciales)
5. Features (funcionalidades que faltan y serían valiosas)

Responde SOLO con JSON válido, sin texto antes ni después. Formato exacto:
{
  "resumen": "una frase de 10-20 palabras",
  "mejoras": [
    {
      "titulo": "título corto (máx 60 chars)",
      "categoria": "seguridad|rendimiento|ux|bug|feature",
      "prioridad": "alta|media|baja",
      "descripcion": "qué mejorar y por qué (2-3 frases)",
      "como": "cómo implementarlo paso a paso (2-3 frases)"
    }
  ]
}`;

  console.log('📤 Enviando a IA...');
  const r = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!r.ok){
    console.error('✗ IA falló:', r.status);
    process.exit(1);
  }

  const j = await r.json();
  let texto = (j.choices && j.choices[0] && j.choices[0].message.content) || '';
  console.log('📥 Respuesta recibida (' + texto.length + ' chars)');

  // Extraer JSON
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match){
    console.error('✗ No hay JSON en la respuesta');
    console.error('Respuesta cruda:', texto.slice(0, 500));
    process.exit(1);
  }

  let data;
  try{
    data = JSON.parse(match[0]);
  }catch(e){
    console.error('✗ JSON inválido:', e.message);
    process.exit(1);
  }

  // Completar metadatos
  data.fecha = new Date().toISOString();
  data.analizadoPor = 'Ania Auto-Agent (Pollinations)';
  data.archivosAnalizados = Object.keys(codigo);

  if (!Array.isArray(data.mejoras)) data.mejoras = [];

  // Guardar en datos/sugerencias.json (histórico de los últimos 5 análisis)
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

  console.log(`✅ Guardado en ${ruta} (${data.mejoras.length} mejoras)`);
  data.mejoras.forEach((m, i) => {
    console.log(`  ${i+1}. [${m.categoria}/${m.prioridad}] ${m.titulo}`);
  });
}

main().catch(e => {
  console.error('✗ Error fatal:', e.message);
  process.exit(1);
});
