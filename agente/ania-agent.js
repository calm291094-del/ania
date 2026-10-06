// ania-agent.js v1.2 · puente local de ANIA con tu PC (Windows)
// ⭐ FIX #4 · Sin inyección de comandos: execFile + validación estricta
const { WebSocketServer } = require('ws');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { URL } = require('url');

const TOKEN = process.env.ANIA_TOKEN;
if (!TOKEN){
  console.error('✗ Falta la variable ANIA_TOKEN en el entorno');
  process.exit(1);
}
const TOKEN_BUF = Buffer.from(TOKEN);

const PORT = parseInt(process.env.ANIA_PORT || '8765', 10);
const SHOTS = path.join(os.homedir(), 'Pictures', 'Ania');

const ROOTS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Videos'),
  path.join(os.homedir(), 'Music'),
  'C:\\Users\\Public',
  'D:\\', 'E:\\'
].filter(p => { try{ return fs.existsSync(p); }catch(e){ return false; } });

const APPS = {
  explorer:'explorer', pc:'explorer', equipo:'explorador', calculadora:'calc', calc:'calc',
  notepad:'notepad', 'bloc de notas':'notepad', word:'winword', excel:'excel',
  powerpoint:'powerpnt', chrome:'chrome', navegador:'chrome', edge:'msedge',
  code:'code', vscode:'code', spotify:'spotify'
};

if(!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, {recursive:true});

const wss = new WebSocketServer({ host:'127.0.0.1', port:PORT });
console.log('ANIA AGENTE v1.2 · ws://127.0.0.1:'+PORT);
console.log('Raíces permitidas:', ROOTS.join(' | '));

/* ============================================================
   HELPERS SEGUROS
============================================================ */
function _tokenOk(t){
  if (typeof t !== 'string') return false;
  const b = Buffer.from(t);
  return b.length === TOKEN_BUF.length && crypto.timingSafeEqual(b, TOKEN_BUF);
}

function _execDirecto(bin, args, cb){
  execFile(bin, args || [], { windowsHide:true, timeout:5000 }, err => cb && cb(err));
}
function _abrirNativo(target, cb){
  // rundll32 url.dll,FileProtocolHandler es seguro y no pasa por cmd.exe
  execFile('rundll32', ['url.dll,FileProtocolHandler', target],
    { windowsHide:true, timeout:5000 }, err => cb && cb(err));
}

function ps(script, timeout, cb){
  execFile('powershell', ['-NoProfile','-Command', script], {timeout}, (err, stdout) => cb(err, String(stdout||'').trim()));
}
function sendKey(key, times, cb){
  let s = '$w=New-Object -ComObject WScript.Shell;';
  for(let i=0;i<times;i++) s += '$w.SendKeys([char]0x'+key.toString(16).toUpperCase()+');';
  ps(s, 15000, cb);
}

function screenshot(cb){
  const file = path.join(SHOTS, 'ania-'+Date.now()+'.png');
  const f = file.replace(/\\/g,'\\\\').replace(/'/g,"''");
  const script = `
    Add-Type -AssemblyName System.Drawing;
    Add-Type -AssemblyName System.Windows.Forms;
    $b=[System.Windows.Forms.SystemInformation]::VirtualScreen;
    $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;
    $g=[System.Drawing.Graphics]::FromImage($bmp);
    $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size);
    $bmp.Save('${f}');
    $g.Dispose(); $bmp.Dispose();
    [Convert]::ToBase64String([IO.File]::ReadAllBytes('${f}'))
  `;
  ps(script, 25000, (err, out)=> cb(err, out, file));
}

function walk(root, pattern, out, depth, limit){
  if(out.length >= limit || depth > 6) return;
  let entries;
  try{ entries = fs.readdirSync(root, {withFileTypes:true}); }catch(e){ return; }
  for(const e of entries){
    if(out.length >= limit) return;
    if(e.name.startsWith('$') || e.name.startsWith('.')) continue;
    const full = path.join(root, e.name);
    if(e.isDirectory()){
      if(/node_modules|AppData|Windows|WinSxS/i.test(e.name)) continue;
      walk(full, pattern, out, depth+1, limit);
    } else if(e.name.toLowerCase().includes(pattern)){
      out.push({name:e.name, path:full});
    }
  }
}

/* ============================================================
   WEBSOCKET
============================================================ */
wss.on('connection', ws=>{
  console.log('· Ania conectada desde el navegador');
  ws.on('message', async raw=>{
    let m; try{ m = JSON.parse(raw); }catch{ return; }

    // ⭐ FIX #4 · comparación de tiempo constante
    if(!_tokenOk(m.token)){
      return ws.send(JSON.stringify({id:m.id, ok:false, error:'token inválido'}));
    }

    try{
      switch(m.type){
        case 'ping':
          return ws.send(JSON.stringify({id:m.id, ok:true, pong:true}));

        case 'openApp': {
          const app = APPS[String(m.app||'').toLowerCase()];
          if(!app) return ws.send(JSON.stringify({id:m.id, ok:false, error:'app no permitida: '+m.app}));
          _execDirecto(app, [], ()=> ws.send(JSON.stringify({id:m.id, ok:true})));
          return;
        }

        case 'openPath': {
          const p = String(m.path||'');
          const raizOk = ROOTS.some(r => p.toLowerCase().startsWith(r.toLowerCase()));
          if (!raizOk || p.includes('..'))
            return ws.send(JSON.stringify({id:m.id, ok:false, error:'ruta fuera de raíces permitidas'}));
          _abrirNativo(p, ()=> ws.send(JSON.stringify({id:m.id, ok:true})));
          return;
        }

        case 'openUrl': {
          const raw = String(m.url||'');
          let u;
          try{ u = new URL(raw); }catch(e){
            return ws.send(JSON.stringify({id:m.id, ok:false, error:'URL inválida'}));
          }
          if (!/^https?:$/.test(u.protocol))
            return ws.send(JSON.stringify({id:m.id, ok:false, error:'solo http(s)'}));
          _abrirNativo(u.toString(), ()=> ws.send(JSON.stringify({id:m.id, ok:true})));
          return;
        }

        case 'search': {
          const pat = String(m.pattern||'').toLowerCase();
          if(pat.length < 2) return ws.send(JSON.stringify({id:m.id, ok:false, error:'patrón muy corto'}));
          const out = [];
          for(const r of ROOTS) walk(r, pat, out, 0, 80);
          return ws.send(JSON.stringify({id:m.id, ok:true, results:out.slice(0,50)}));
        }

        case 'power': {
          const a = String(m.action||'');
          const min = Math.max(1, Math.min(60, m.minutes||10));
          const segundos = min * 60;
          let args = null;
          if (a==='shutdown') args = ['/s', '/t', String(segundos)];
          else if (a==='restart') args = ['/r', '/t', String(segundos)];
          else if (a==='abort') args = ['/a'];
          else if (a==='hibernate') args = ['/h'];
          if (!args) return ws.send(JSON.stringify({id:m.id, ok:false, error:'acción desconocida'}));
          _execDirecto('shutdown', args, ()=> ws.send(JSON.stringify({id:m.id, ok:true})));
          return;
        }

        case 'lock':
          _execDirecto('rundll32', ['user32.dll,LockWorkStation'], ()=> ws.send(JSON.stringify({id:m.id, ok:true})));
          return;

        case 'volume': {
          const a = String(m.action||'');
          const steps = Math.min(50, Math.max(1, m.steps||5));
          const key = a==='up' ? 0xAF : a==='down' ? 0xAE : 0xAD;
          sendKey(key, a==='mute'?1:steps, err=> ws.send(JSON.stringify({id:m.id, ok:!err})));
          return;
        }

        case 'media': {
          const a = String(m.action||'');
          const key = a==='playpause' ? 0xB3 : a==='next' ? 0xB0 : a==='prev' ? 0xB1 : 0xB3;
          sendKey(key, 1, err=> ws.send(JSON.stringify({id:m.id, ok:!err})));
          return;
        }

        case 'screenshot':
          return screenshot((err, b64, file)=>{
            if(err) return ws.send(JSON.stringify({id:m.id, ok:false, error:'no pude capturar (¿bloqueado en sesión?)'}));
            ws.send(JSON.stringify({id:m.id, ok:true, data:b64, path:file}));
          });

        case 'clipboard':
          return ps('Get-Clipboard', 8000, (err, out)=>{
            if(err || !out) return ws.send(JSON.stringify({id:m.id, ok:false, error:'vacío'}));
            ws.send(JSON.stringify({id:m.id, ok:true, text:out.slice(0,2000)}));
          });

        case 'list':
          return ws.send(JSON.stringify({id:m.id, ok:true, roots:ROOTS, apps:Object.keys(APPS)}));

        default:
          return ws.send(JSON.stringify({id:m.id, ok:false, error:'comando desconocido: '+m.type}));
      }
    }catch(e){
      ws.send(JSON.stringify({id:m.id, ok:false, error:e.message}));
    }
  });
  ws.on('close', ()=> console.log('· Ania desconectada'));
});
