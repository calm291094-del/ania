/* ============================================================
   03-CANVAS · reactor, bgfx, astro, clima modo visual
============================================================ */
'use strict';

/* ---------- Astro ---------- */
function moonInfo(){
  const syn = 29.53058867;
  let age = ((Date.now()-Date.UTC(2000,0,6,18,14))/864e5) % syn;
  if(age < 0) age += syn;
  const frac = age/syn;
  const illum = Math.round((1-Math.cos(frac*Math.PI*2))/2*100);
  const names = [[1.85,'nueva'],[5.54,'creciente'],[9.23,'cuarto creciente'],[12.92,'gibosa creciente'],[16.61,'llena'],[20.3,'gibosa menguante'],[24.09,'cuarto menguante'],[27.78,'menguante'],[99,'nueva']];
  return { age:Math.round(age*10)/10, phase:names.find(n=>age<n[0])[1], illum };
}
const SHOWERS = [['Cuadrántidas',0,3],['Líridas',3,22],['Eta Acuáridas',4,5],['Perseidas',7,12],['Oriónidas',9,21],['Leónidas',10,17],['Gemínidas',11,13],['Úrsidas',11,22]];
function nextShower(){
  const now = new Date();
  let best=null, bd=1e9;
  for(const [name,m,d] of SHOWERS){
    for(const y of [now.getFullYear(), now.getFullYear()+1]){
      const diff = Math.ceil((new Date(y,m,d)-now)/864e5);
      if(diff>=0 && diff<bd){ bd=diff; best={name, diff}; }
    }
  }
  return best;
}

/* ---------- Clima visual + colores ---------- */
const WX = { mode:'none' };
function setWeatherMode(code){
  if(code===undefined || code===null){ WX.mode='none'; bgfxMode(); return; }
  const h = new Date().getHours();
  const night = h<6 || h>=20;
  if(code>=51 || (code>=80 && code<=82)) WX.mode = code>=95 ? 'storm' : 'rain';
  else if(code===0 || code===1) WX.mode = night ? 'night-clear' : 'day-clear';
  else WX.mode = night ? 'night-cloud' : 'day-cloud';
  bgfxMode();
}
function themeColor(alpha){
  let [r,g,b] = ACC_RGB;
  if(WX.mode==='rain' || WX.mode==='storm'){
    r=Math.round(r*.6+95*.4); g=Math.round(g*.6+168*.4); b=Math.round(b*.6+255*.4);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------- Reactor ---------- */
const cv = $('reactor'), ctx = cv.getContext('2d');
let CW=0, R=0, DPR=1, FONT='10px monospace';
const seeds = Array.from({length:72}, ()=>Math.random());
const orbits = Array.from({length:14}, ()=>({r:.5+Math.random()*.28, a:Math.random()*Math.PI*2, v:.2+Math.random()*.6, s:1+Math.random()*1.5}));
let hexChars = Array.from({length:26}, ()=>Math.floor(Math.random()*16).toString(16));
let lastHex = 0;

function sizeReactor(){
  const w = $('reactorWrap').clientWidth;
  DPR = Math.min(devicePixelRatio||1, 2);
  cv.width = w*DPR; cv.height = w*DPR;
  CW = w; R = w/2;
  FONT = Math.max(9, R*0.075)+'px '+getComputedStyle(document.body).fontFamily;
}
addEventListener('resize', sizeReactor); sizeReactor();

const PH = {
  idle:{spin:0.18,lvl:0.10},
  listening:{spin:0.55,lvl:0.38},
  thinking:{spin:1.9,lvl:0.16},
  speaking:{spin:0.35,lvl:0}
};
let drawLevel = 0.1;

function setPhase(p){
  S.phase = p;
  const lbl = {idle:'EN ESPERA', listening:'ESCUCHANDO', thinking:'PROCESANDO', speaking:'HABLANDO'}[p];
  const el = $('phase');
  el.textContent = lbl;
  el.classList.toggle('amber', p==='listening'||p==='thinking');
  if (typeof LogoController !== 'undefined' && LogoController.setState){
    LogoController.setState(p);
  }
}

function reactorLoop(ms){
  const t = ms/1000;
  const ph = PH[S.phase] || PH.idle;
  const isThink = S.phase==='thinking';
  let target = ph.lvl;
  if(S.phase==='speaking') target = 0.35 + 0.55*Math.abs(Math.sin(t*8.7)*0.6 + Math.sin(t*21.3+1.4)*0.3 + Math.sin(t*3.1)*0.25);
  if(S.phase==='listening') target = 0.25 + 0.45*Math.abs(Math.sin(t*5.2)*Math.sin(t*1.7+2));
  if(S.phase==='idle') target = 0.08 + 0.05*Math.sin(t*1.3);
  drawLevel += (target-drawLevel)*0.12;
  if(ms-lastHex > (isThink?140:600)){
    hexChars = hexChars.map(()=>Math.floor(Math.random()*16).toString(16));
    lastHex = ms;
  }
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,CW,CW);
  ctx.translate(R,R);
  const TAU = Math.PI*2;
  const rot = t*ph.spin;
  for(let i=0;i<64;i++){
    const a = i/64*TAU + rot*0.4;
    const long = (i%8===0);
    const r1 = R*0.97, r2 = r1-(long?12:6);
    ctx.strokeStyle = themeColor(long?0.85:0.3);
    ctx.lineWidth = long?2:1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
    ctx.lineTo(Math.cos(a)*r2, Math.sin(a)*r2);
    ctx.stroke();
  }
  ctx.font = FONT; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let i=0;i<26;i++){
    const a = i/26*TAU + rot*(isThink?1.2:0.12);
    const r = R*0.83;
    ctx.fillStyle = themeColor(i%5===0?0.85:0.4);
    ctx.fillText(hexChars[i], Math.cos(a)*r, Math.sin(a)*r);
  }
  if(typeof Brain !== 'undefined' && Brain.localReady){
    ctx.strokeStyle = themeColor(0.85); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,R*0.50, t*0.8, t*0.8+1.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,R*0.50, t*0.8+Math.PI, t*0.8+Math.PI+1.1); ctx.stroke();
  }
  if(isThink){
    ctx.strokeStyle = themeColor(0.9); ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,0,R*0.74, rot*3, rot*3+0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,R*0.74, rot*3+Math.PI, rot*3+Math.PI+0.7); ctx.stroke();
    ctx.lineCap='butt';
  }
  for(let i=0;i<72;i++){
    const a = i/72*TAU + rot*0.2;
    const h = 3 + drawLevel*R*0.28*(0.35+0.65*Math.abs(Math.sin(i*2.7+t*6+seeds[i]*10)));
    const r1 = R*0.60;
    ctx.strokeStyle = themeColor(0.25+drawLevel*0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
    ctx.lineTo(Math.cos(a)*(r1+h), Math.sin(a)*(r1+h));
    ctx.stroke();
  }
  for(const o of orbits){
    const a = o.a + t*o.v*ph.spin;
    ctx.fillStyle = themeColor(0.5);
    ctx.beginPath(); ctx.arc(Math.cos(a)*R*o.r, Math.sin(a)*R*o.r, o.s, 0, TAU); ctx.fill();
  }
  ctx.setLineDash([3,7]);
  ctx.strokeStyle = themeColor(0.5); ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.arc(0,0,R*0.42,0,TAU); ctx.stroke();
  ctx.setLineDash([]);
  const beat = S.phase==='idle' ? (Math.sin(t*2.2)>0.9?0.3:0) : 0;
  const core = R*0.13 + drawLevel*R*0.05 + beat*R*0.03;
  ctx.fillStyle = themeColor(0.16);
  ctx.beginPath(); ctx.arc(0,0,core*2.1,0,TAU); ctx.fill();
  ctx.fillStyle = themeColor(0.92);
  ctx.beginPath(); ctx.arc(0,0,core,0,TAU); ctx.fill();
  ctx.fillStyle = '#040806';
  ctx.beginPath(); ctx.arc(0,0,core*0.35,0,TAU); ctx.fill();
  requestAnimationFrame(reactorLoop);
}
requestAnimationFrame(reactorLoop);

/* ---------- Fondo (lluvia, estrellas) ---------- */
const bgfx = $('bgfx'), bctx = bgfx.getContext('2d');
let bgDrops=[], bgStars=[], bgActive=false;
function sizeBgfx(){ bgfx.width = innerWidth; bgfx.height = innerHeight; }
addEventListener('resize', sizeBgfx); sizeBgfx();

function bgfxMode(){
  const want = (WX.mode==='rain' || WX.mode==='storm' || WX.mode==='night-clear');
  bgActive = want;
  if(!want){ bctx.clearRect(0,0,bgfx.width,bgfx.height); return; }
  bgDrops = Array.from({length: WX.mode==='storm'?110:70}, ()=>({x:Math.random()*bgfx.width, y:Math.random()*bgfx.height, v:5+Math.random()*7, l:8+Math.random()*14}));
  bgStars = Array.from({length:80}, ()=>({x:Math.random()*bgfx.width, y:Math.random()*bgfx.height, s:Math.random()*1.5+0.4, p:Math.random()*Math.PI*2}));
}
function bgfxLoop(t){
  if(bgActive){
    bctx.clearRect(0,0,bgfx.width,bgfx.height);
    if(WX.mode==='night-clear'){
      for(const s of bgStars){
        const a = 0.2 + 0.55*Math.abs(Math.sin(t/900 + s.p));
        bctx.fillStyle = `rgba(205,255,235,${a})`;
        bctx.fillRect(s.x, s.y, s.s, s.s);
      }
    } else {
      bctx.strokeStyle = 'rgba(140,190,230,.25)'; bctx.lineWidth = 1;
      for(const d of bgDrops){
        bctx.beginPath(); bctx.moveTo(d.x, d.y); bctx.lineTo(d.x-2, d.y+d.l); bctx.stroke();
        d.y += d.v; d.x -= 0.6;
        if(d.y > bgfx.height){ d.y = -d.l; d.x = Math.random()*bgfx.width; }
      }
    }
  }
  requestAnimationFrame(bgfxLoop);
}
requestAnimationFrame(bgfxLoop);