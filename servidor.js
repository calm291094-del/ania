const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Render asigna el puerto automáticamente

// ----- CORS: permite que tu frontend (GitHub Pages, local, etc.) hable con este backend -----
app.use(cors({
  origin: [
    'https://calm291094-del.github.io',   // Tu GitHub Pages
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5500'
  ],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// ----- Servir archivos estáticos (opcional) -----
// Si quieres que el backend también sirva tu index.html, crea una carpeta "public"
// y mete dentro tu index.html. Luego descomenta las dos líneas siguientes.
// app.use(express.static(path.join(__dirname, 'public')));
// app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ----- Ruta de salud (Render la usa para saber si el servicio está vivo) -----
app.get('/ania/health', (req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// ----- Ruta de prueba -----
app.get('/ania/ping', (req, res) => {
  res.json({ mensaje: 'Ania backend activo', servidor: 'ania-backend' });
});

// ----- Ruta raíz (para que no salga "Cannot GET /") -----
app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'ANIA backend funcionando correctamente',
    endpoints: [
      '/ania/health',
      '/ania/ping'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('ANIA backend escuchando en puerto ' + PORT);
});
