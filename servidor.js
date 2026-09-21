// servidor.js · ANIA local — sirve la carpeta con cabeceras de aislamiento
// Uso:  node servidor.js  →  http://localhost:8080
// Las cabeceras COOP/COEP activan SharedArrayBuffer → WASM multihilo (GGUF rápido)
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm',
  '.gguf':'application/octet-stream', '.png':'image/png', '.svg':'image/svg+xml',
  '.txt':'text/plain', '.md':'text/plain', '.pdf':'application/pdf'
};

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if(p === '/') p = '/index.html';
  const file = path.join(__dirname, path.normalize(p));
  if(!file.startsWith(__dirname)){ res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}).listen(8080, () => console.log('ANIA local · http://localhost:8080'));
