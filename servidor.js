// servidor.js · ANIA — servidor único para Render y local
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// CORS abierto (Ania es pública, cualquiera puede usar la app)
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ----- API de Ania -----
app.get('/ania/health', (req, res) => res.json({ ok: true, t: Date.now() }));
app.get('/ania/ping', (req, res) => res.json({ mensaje: 'Ania backend activo' }));

// ----- Archivos estáticos del frontend (public/) -----
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  }
}));

// ----- Fallback SPA: cualquier ruta devuelve index.html -----
app.get('*', (req, res) => {
  const idx = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.status(404).send('index.html no encontrado en /public');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('ANIA en http://localhost:' + PORT);
  console.log('Sirviendo desde: ' + PUBLIC_DIR);
});
