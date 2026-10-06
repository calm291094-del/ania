// agente/seguridad.js · Ania Security Agent v3
// ⭐ FIX #22 · Solo npm audit (los paquetes basesec/express-sec-audit no existen)
const { execSync } = require('child_process');
const fs = require('fs');

const RUTA_REPORTE = 'datos/security-report.json';

async function main(){
  console.log('🛡️ Ania Security Agent v3 iniciado');
  const reporte = {
    fecha: new Date().toISOString(),
    analizadoPor: 'Ania Security Agent v3',
    hallazgos: [],
    resumen: { critico: 0, alto: 0, medio: 0, bajo: 0 }
  };

  /* ---- 1. npm audit ---- */
  console.log('🔍 Analizando dependencias con npm audit...');
  try{
    let auditData = null;
    try{
      const out = execSync('npm audit --json', { encoding:'utf-8', stdio:'pipe' });
      auditData = JSON.parse(out);
    }catch(err){
      // npm audit devuelve código 1 si hay vulnerabilidades
      if (err.stdout){
        try{ auditData = JSON.parse(err.stdout); }catch(e){}
      }
    }
    if (auditData && auditData.vulnerabilities){
      for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)){
        const severity = vuln.severity;
        const nivel = { 'critical':'critico', 'high':'alto', 'moderate':'medio', 'low':'bajo' }[severity] || 'bajo';
        reporte.hallazgos.push({
          tipo: 'dependencia',
          paquete: pkg,
          severidad: nivel,
          descripcion: `Vulnerabilidad en ${pkg}: ${(vuln.via && vuln.via[0] && vuln.via[0].title) || 'CVE desconocido'}`,
          solucion: vuln.fixAvailable ? 'Actualizar el paquete' : 'No hay fix automático'
        });
        reporte.resumen[nivel]++;
      }
    }
  }catch(e){
    console.error('Error en npm audit:', e.message);
    reporte.hallazgos.push({
      tipo: 'error', severidad: 'medio',
      descripcion: 'No se pudo ejecutar npm audit. Revisa las dependencias manualmente.'
    });
    reporte.resumen.medio++;
  }

  /* ---- 2. Auditoría de Helmet ---- */
  console.log('🔍 Auditando middleware de seguridad...');
  let packageJson = {};
  try{ packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8')); }catch(e){}
  const deps = packageJson.dependencies || {};
  if (!deps.helmet){
    reporte.hallazgos.push({
      tipo: 'configuracion', severidad: 'alto',
      descripcion: 'Falta el middleware Helmet para cabeceras de seguridad.',
      solucion: 'Ejecuta: npm install helmet && app.use(helmet())'
    });
    reporte.resumen.alto++;
  } else {
    console.log('✅ Helmet está instalado.');
  }
  if (!deps['express-rate-limit']){
    reporte.hallazgos.push({
      tipo: 'configuracion', severidad: 'medio',
      descripcion: 'Falta express-rate-limit: los endpoints sensibles pueden ser atacados por fuerza bruta.',
      solucion: 'Ejecuta: npm install express-rate-limit'
    });
    reporte.resumen.medio++;
  } else {
    console.log('✅ Rate limiting instalado.');
  }

  /* ---- 3. Búsqueda de patrones peligrosos en el código ---- */
  console.log('🔍 Buscando patrones peligrosos en el código...');
  const RIESGOS = [
    { re: /\beval\s*\(/, desc: 'Uso de eval() detectado', sev: 'alto' },
    { re: /new\s+Function\s*\(/, desc: 'Uso de new Function() detectado', sev: 'medio' },
    { re: /child_process.*exec\s*\([^,]+,\s*\(\s*\)/, desc: 'exec() sin validación puede ser inyección', sev: 'alto' },
    { re: /TOKEN_SECRET\s*\|\|\s*['"]x['"]/, desc: 'Fallback inseguro en TOKEN_SECRET', sev: 'critico' },
    { re: /ANIA_SECRET\s*\|\|\s*['"]fallback['"]/, desc: 'Fallback inseguro en ANIA_SECRET', sev: 'critico' }
  ];
  const ARCHIVOS = ['servidor.js', 'modulos-backend.js', 'persistencia-local.js', 'agente/ania-agent.js'];
  for (const f of ARCHIVOS){
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const r of RIESGOS){
      if (r.re.test(src)){
        reporte.hallazgos.push({
          tipo: 'codigo', severidad: r.sev,
          descripcion: `${r.desc} en ${f}`,
          solucion: 'Revisar y refactorizar'
        });
        reporte.resumen[r.sev]++;
      }
    }
  }

  if (!fs.existsSync('datos')) fs.mkdirSync('datos');
  fs.writeFileSync(RUTA_REPORTE, JSON.stringify(reporte, null, 2));
  console.log(`✅ Reporte guardado en ${RUTA_REPORTE}`);
  console.log(`   Resumen: ${reporte.resumen.critico} críticos, ${reporte.resumen.alto} altos, ${reporte.resumen.medio} medios, ${reporte.resumen.bajo} bajos.`);
}

main().catch(e => {
  console.error('✗ Error fatal en el agente de seguridad:', e);
  process.exit(1);
});
