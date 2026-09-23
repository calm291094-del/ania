// servidor.js · ANIA — sirve la app y la API en el mismo puerto
// Render usa: node servidor.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000; // Render asigna el puerto

// ----- CORS: permite que tu frontend (GitHub Pages, local, etc.) hable con este backend -----
app.use(cors({
  origin: [
    'https://calm291094-del.github.io',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5500'
  ],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// ----- Servir archivos estáticos (HTML, CSS, JS, imágenes) desde la carpeta "public" -----
// Todos los archivos dentro de "public" estarán disponibles en la raíz de la URL.
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ----- Ruta raíz: sirve el index.html de Ania -----
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      ok: true,
      mensaje: 'ANIA backend funcionando. Coloca tu index.html en la carpeta "public".',
      endpoints: ['/ania/health', '/ania/ping']
    });
  }
});

// ----- Ruta de salud (Render la usa para saber si el servicio está vivo) -----
app.get('/ania/health', (req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// ----- Ruta de prueba -----
app.get('/ania/ping', (req, res) => {
  res.json({ mensaje: 'Ania backend activo', servidor: 'ania-backend' });
});

// ----- SPA Fallback: cualquier otra ruta devuelve el index.html -----
// Esto es vital para que tu aplicación de una sola página funcione en todas sus rutas.
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Ruta no encontrada. Asegúrate de que index.html esté en la carpeta "public".' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('ANIA servidor escuchando en puerto ' + PORT);
  console.log('Sirviendo archivos estáticos desde: ' + publicDir);
});
