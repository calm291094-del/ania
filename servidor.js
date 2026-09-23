// servidor.js · ANIA local — sirve la carpeta con cabeceras de aislamiento
// Uso:  node servidor.js  →  http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm',
  '.gguf':'application/octet-stream', '.png':'image/png', '.svg':'image/svg+xml',
  '.txt':'text/plain', '.md':'text/plain', '.pdf':'application/pdf'
};

const PORT = process.env.PORT || 8080; // Render asigna el puerto
const PUBLIC_DIR = path.join(__dirname, 'public'); // Carpeta de archivos estáticos

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if(p === '/') p = '/index.html';
  
  // 1. Intentar servir un archivo estático de la carpeta 'public'
  let filePath = path.join(PUBLIC_DIR, p);
  
  // Seguridad: evitar que se acceda fuera de la carpeta public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 2. Si el archivo no existe, servir el index.html (SPA fallback)
      // Esto permite que rutas como /dashboard o /tareas funcionen.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          return res.end('404 Not Found');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cache-Control': 'no-cache'
        });
        res.end(data2);
      });
      return;
    }
    
    // Archivo encontrado
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('ANIA local · http://localhost:' + PORT));
