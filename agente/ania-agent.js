// ania-agent.js v1.1 · puente local de ANIA con tu PC (Windows)
// Instalación:  npm init -y  &&  npm i ws  &&  node ania-agent.js
// Requiere Node.js 18+. Escucha SOLO en 127.0.0.1 con token + listas blancas.
const { WebSocketServer } = require('ws');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN = process.env.ANIA_TOKEN || 'cambia-esta-clave';   // ← CÁMBIALA
const PORT = parseInt(process.env.ANIA_PORT || '8765', 10);
const SHOTS = path.join(os.homedir(), 'Pictures', 'Ania');

// raíces donde permito buscar/abrir (agrega o quita según tu máquina)
const ROOTS = [ path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Documents'),
                path.join(os.homedir(), 'Downloads'), path.join(os.homedir(), 'Videos'),
                path.join(os.homedir(), 'Music'), 'C:\\Users\\Public', 'D:\\', 'E:\\' ].filter(p=>{
  try{ return fs.existsSync(p); }catch(e){ return false; }
});

// lista blanca de aplicaciones
const APPS = {
  explorer:'explorer', pc:'explorer', equipo:'explorador', calculadora:'calc', calc:'calc',
  notepad:'notepad', 'bloc de notas':'notepad', word:'winword', excel:'excel',
  powerpoint:'powerpnt', chrome:'chrome', navegador:'chrome', edge:'msedge',
  code:'code', vscode:'code', spotify:'spotify', papelera:'explorer shell:RecycleBinFolder'
};

if(!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, {recursive:true});

const wss = new WebSocketServer({ host:'127.0.0.1', port:PORT });
console.log('ANIA AGENTE v1.1 · ws://127.0.0.1:'+PORT);
console.log('Raíces permitidas:', ROOTS.join(' | '));

/* ---------- helpers PowerShell ---------- */
function ps(script, timeout, cb){
  execFile('powershell', ['-NoProfile','-Command', script], {timeout}, (err, stdout)=> cb(err, String(stdout||'').trim()));
}
function sendKey(key, times, cb){
  let s = '$w=New-Object -ComObject WScript.Shell;';
  for(let i=0;i<times;i++) s += '$w.SendKeys([char]0x'+key.toString(16).toUpperCase()+');';
  ps(s, 15000, cb);
}

/* ---------- captura de pantalla (guarda + base64) ---------- */
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

/* ---------- búsqueda en disco ---------- */
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

/* ---------- dispatcher ---------- */
wss.on('connection', ws=>{
  console.log('· Ania conectada desde el navegador');
  ws.on('message', async raw=>{
    let m; try{ m = JSON.parse(raw); }catch{ return; }
    if(m.token !== TOKEN){ return ws.send(JSON.stringify({id:m.id, ok:false, error:'token inválido'})); }
    try{
      switch(m.type){
        case 'ping':
          return ws.send(JSON.stringify({id:m.id, ok:true, pong:true}));

        case 'openApp': {
          const app = APPS[String(m.app||'').toLowerCase()];
          if(!app) return ws.send(JSON.stringify({id:m.id, ok:false, error:'app no permitida: '+m.app}));
          exec('start "" "'+app+'"', ()=>{});
          return ws.send(JSON.stringify({id:m.id, ok:true}));
        }

        case 'openPath': {
          const p = String(m.path||'');
          if(!ROOTS.some(r=>p.toLowerCase().startsWith(r.toLowerCase())) || p.includes('..'))
            return ws.send(JSON.stringify({id:m.id, ok:false, error:'ruta fuera de raíces permitidas'}));
          exec('start "" "'+p.replace(/"/g,'')+'"', ()=>{});
          return ws.send(JSON.stringify({id:m.id, ok:true}));
        }

        case 'openUrl': {
          const url = String(m.url||'');
          if(!/^https?:\/\//i.test(url))
            return ws.send(JSON.stringify({id:m.id, ok:false, error:'solo http(s)'}));
          exec('start "" "'+url.replace(/"/g,'')+'"', ()=>{});
          return ws.send(JSON.stringify({id:m.id, ok:true}));
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
          if(a==='shutdown'){ exec('shutdown /s /t '+Math.max(1, m.minutes||10), ()=>{}); }
          else if(a==='restart'){ exec('shutdown /r /t '+Math.max(1, m.minutes||10), ()=>{}); }
          else if(a==='abort'){ exec('shutdown /a', ()=>{}); }
          else if(a==='hibernate'){ exec('shutdown /h', ()=>{}); }
          else return ws.send(JSON.stringify({id:m.id, ok:false, error:'acción desconocida'}));
          return ws.send(JSON.stringify({id:m.id, ok:true}));
        }

        case 'lock':
          exec('rundll32 user32.dll,LockWorkStation', ()=>{});
          return ws.send(JSON.stringify({id:m.id, ok:true}));

        case 'volume': {
          const a = String(m.action||'');
          const steps = Math.min(50, Math.max(1, m.steps||5));
          const key = a==='up' ? 0xAF : a==='down' ? 0xAE : 0xAD; // subir/bajar/silenciar
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
