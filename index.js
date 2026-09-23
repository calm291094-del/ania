const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // Render asigna el puerto por variable de entorno

// Configurar CORS: permite peticiones desde tu frontend (GitHub Pages, etc.)
app.use(cors({
  origin: [
    'https://calm291094-del.github.io', // Tu GitHub Pages (si usas ese dominio)
    'http://localhost:8080',            // Para pruebas locales
    'http://localhost:3000',
    'https://*.onrender.com'            // Por si luego sirves el front desde Render
  ],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// Ruta de salud (Render la usa para saber si el servicio está vivo)
app.get('/ania/health', (req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// Ruta de prueba
app.get('/ania/ping', (req, res) => {
  res.json({ mensaje: 'Ania backend activo' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('ANIA backend escuchando en puerto ' + PORT);
});