// agente/seguridad.js · Ania Security Agent v2
// Realiza auditorías de seguridad con npm audit y basesec
const { execSync } = require('child_process');
const fs = require('fs');

const RUTA_REPORTE = 'datos/security-report.json';

async function main(){
  console.log('🛡️ Ania Security Agent v2 iniciado');
  const reporte = {
    fecha: new Date().toISOString(),
    analizadoPor: 'Ania Security Agent v2',
    hallazgos: [],
    resumen: { critico: 0, alto: 0, medio: 0, bajo: 0 }
  };

  // 1. Análisis de dependencias (npm audit)
  console.log('🔍 Analizando dependencias con npm audit...');
  try {
    const auditOutput = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
    const auditData = JSON.parse(auditOutput);
    if (auditData.vulnerabilities) {
      for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
        const severity = vuln.severity; // low, moderate, high, critical
        const nivel = { 'critical': 'critico', 'high': 'alto', 'moderate': 'medio', 'low': 'bajo' }[severity] || 'bajo';
        reporte.hallazgos.push({
          tipo: 'dependencia',
          paquete: pkg,
          severidad: nivel,
          descripcion: `Vulnerabilidad en ${pkg}: ${vuln.via[0]?.title || 'CVE desconocido'}`,
          solucion: vuln.fixAvailable ? 'Actualizar el paquete' : 'No hay fix automático'
        });
        reporte.resumen[nivel]++;
      }
    }
  } catch (e) {
    // npm audit devuelve código 1 si hay vulnerabilidades, pero igual parsea el JSON.
    // Si falla totalmente, lo registramos como error medio.
    if (e.stdout) {
      try {
        const auditData = JSON.parse(e.stdout);
        // ... procesar igual que arriba ...
      } catch (parseErr) {}
    }
    console.error('Error en npm audit:', e.message);
    reporte.hallazgos.push({
      tipo: 'error',
      severidad: 'medio',
      descripcion: 'No se pudo ejecutar npm audit. Revisa las dependencias manualmente.'
    });
  }

  // 2. Análisis estático de código (basesec)
  console.log('🔍 Analizando código con basesec...');
  try {
    // basesec scan . --format json --output basesec-report.json
    execSync('npx basesec scan . --format json --output basesec-report.json', { encoding: 'utf-8', stdio: 'pipe' });
    const basesecReport = JSON.parse(fs.readFileSync('basesec-report.json', 'utf-8'));
    if (basesecReport.findings) {
      basesecReport.findings.forEach(finding => {
        const severity = finding.severity || 'medium';
        const nivel = { 'critical': 'critico', 'high': 'alto', 'medium': 'medio', 'low': 'bajo' }[severity.toLowerCase()] || 'medio';
        reporte.hallazgos.push({
          tipo: 'codigo',
          regla: finding.ruleId || 'desconocida',
          severidad: nivel,
          descripcion: finding.message || 'Hallazgo de seguridad',
          ubicacion: finding.location?.file ? `${finding.location.file}:${finding.location.line || ''}` : 'desconocida'
        });
        reporte.resumen[nivel]++;
      });
    }
    fs.unlinkSync('basesec-report.json'); // Limpiar
  } catch (e) {
    console.error('Error en basesec:', e.message);
    // Si basesec falla, intentamos con express-sec-audit como fallback
    try {
      console.log('🔄 Intentando con express-sec-audit...');
      execSync('npx express-sec-audit . --format json --log-name express-audit.json', { encoding: 'utf-8', stdio: 'pipe' });
      const expressReport = JSON.parse(fs.readFileSync('express-audit.json', 'utf-8'));
      if (expressReport.findings) {
        expressReport.findings.forEach(finding => {
          const severity = finding.severity || 'medium';
          const nivel = { 'critical': 'critico', 'high': 'alto', 'medium': 'medio', 'low': 'bajo' }[severity.toLowerCase()] || 'medio';
          reporte.hallazgos.push({
            tipo: 'codigo',
            regla: finding.ruleId || 'desconocida',
            severidad: nivel,
            descripcion: finding.message || 'Hallazgo de seguridad',
            ubicacion: finding.location?.file ? `${finding.location.file}:${finding.location.line || ''}` : 'desconocida'
          });
          reporte.resumen[nivel]++;
        });
      }
      fs.unlinkSync('express-audit.json');
    } catch (e2) {
      console.error('Error en express-sec-audit:', e2.message);
      reporte.hallazgos.push({
        tipo: 'error',
        severidad: 'bajo',
        descripcion: 'No se pudo ejecutar el análisis estático de código.'
      });
    }
  }

  // 3. Auditoría de cabeceras (verificación de Helmet)
  console.log('🔍 Auditando cabeceras de seguridad...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (!packageJson.dependencies.helmet) {
    reporte.hallazgos.push({
      tipo: 'configuracion',
      severidad: 'alto',
      descripcion: 'Falta el middleware Helmet para cabeceras de seguridad.',
      solucion: 'Ejecuta: npm install helmet && app.use(helmet())'
    });
    reporte.resumen.alto++;
  } else {
    console.log('✅ Helmet está instalado.');
  }

  // Guardar reporte
  if (!fs.existsSync('datos')) fs.mkdirSync('datos');
  fs.writeFileSync(RUTA_REPORTE, JSON.stringify(reporte, null, 2));
  console.log(`✅ Reporte guardado en ${RUTA_REPORTE}`);
  console.log(`   Resumen: ${reporte.resumen.critico} críticos, ${reporte.resumen.alto} altos, ${reporte.resumen.medio} medios, ${reporte.resumen.bajo} bajos.`);
}

main().catch(e => {
  console.error('✗ Error fatal en el agente de seguridad:', e);
  process.exit(1);
});
