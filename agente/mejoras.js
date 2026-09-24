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

  const prompt = `Analiza este código y da EXACTAMENTE 5 mejoras concretas.

${resumen}

DEVUELVE SOLO ESTE JSON (nada más, ni texto antes ni después):

{"mejoras":[{"titulo":"titulo corto","categoria":"seguridad","prioridad":"alta","descripcion":"que mejorar y por que","como":"como hacerlo"},{"titulo":"...","categoria":"rendimiento","prioridad":"media","descripcion":"...","como":"..."},{"titulo":"...","categoria":"ux","prioridad":"media","descripcion":"...","como":"..."},{"titulo":"...","categoria":"bug","prioridad":"baja","descripcion":"...","como":"..."},{"titulo":"...","categoria":"feature","prioridad":"baja","descripcion":"...","como":"..."}]}

Categorías válidas: seguridad, rendimiento, ux, bug, feature.
Prioridades válidas: alta, media, baja.
Responde SOLO el JSON, sin markdown, sin explicaciones.`;

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
  // Limpiar markdown si lo hay
  texto = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Buscar el JSON con el array mejoras
  let match = texto.match(/\{[\s\S]*"mejoras"[\s\S]*\}/);
  if (!match) match = texto.match(/\{[\s\S]*\}/);
  if (!match){
    console.error('✗ No hay JSON en la respuesta');
    console.error('Respuesta cruda:', texto.slice(0, 800));
    process.exit(1);
  }

  let data;
  try{
    data = JSON.parse(match[0]);
  }catch(e){
    console.error('✗ JSON inválido:', e.message);
    console.error('Texto recibido:', match[0].slice(0, 500));
    process.exit(1);
  }

  // Si la IA devolvió "mejoras" vacío, avisar
  if (!Array.isArray(data.mejoras) || data.mejoras.length === 0){
    console.error('⚠ La IA no devolvió mejoras. Respuesta completa:');
    console.error(texto.slice(0, 1000));
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
