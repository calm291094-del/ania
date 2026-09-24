// agente/seguridad.js · Ania Security Agent v1
// Realiza auditorías de seguridad y guarda un informe en datos/security-report.json
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUTA_REPORTE = 'datos/security-report.json';

async function main(){
  console.log('🛡️ Ania Security Agent iniciado');
  const reporte = {
    fecha: new Date().toISOString(),
    analizadoPor: 'Ania Security Agent v1',
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
        const severity = vuln.severity; // 'low', 'moderate', 'high', 'critical'
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
    console.error('Error en npm audit:', e.message);
    reporte.hallazgos.push({
      tipo: 'error',
      severidad: 'medio',
      descripcion: 'No se pudo ejecutar npm audit. Revisa las dependencias manualmente.'
    });
  }

  // 2. Análisis estático de código (njsscan)
  console.log('🔍 Analizando código con njsscan...');
  try {
    const njsscanOutput = execSync('npx njsscan --sarif -o njsscan.sarif .', { encoding: 'utf-8', stdio: 'pipe' });
    const sarif = JSON.parse(fs.readFileSync('njsscan.sarif', 'utf-8'));
    if (sarif.runs && sarif.runs[0]?.results) {
      sarif.runs[0].results.forEach(result => {
        const ruleId = result.ruleId;
        const message = result.message.text;
        const severity = result.level === 'error' ? 'alto' : result.level === 'warning' ? 'medio' : 'bajo';
        reporte.hallazgos.push({
          tipo: 'codigo',
          regla: ruleId,
          severidad: severity,
          descripcion: message,
          ubicacion: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'desconocida'
        });
        reporte.resumen[severity]++;
      });
    }
    fs.unlinkSync('njsscan.sarif'); // Limpiar
  } catch (e) {
    console.error('Error en njsscan:', e.message);
    reporte.hallazgos.push({
      tipo: 'error',
      severidad: 'bajo',
      descripcion: 'No se pudo ejecutar njsscan. Asegúrate de que el archivo es .js y el proyecto es Node.js.'
    });
  }

  // 3. Auditoría de cabeceras (simulada; en producción, usar OWASP ZAP)
  console.log('🔍 Auditando cabeceras de seguridad...');
  // En un entorno real, aquí se haría una petición al servidor para verificar las cabeceras.
  // Por ahora, verificamos que Helmet está en package.json.
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
