/* ============================================================
   04-AUDIO · TTS (voz), beeps, música procedural, wake lock
============================================================ */
'use strict';

/* ---------- AudioContext base ---------- */
let AC = null;
function ensureAudio(){
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(AC && AC.state==='suspended') AC.resume();
}
function beep(freq, dur, delay){
  if(!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type='square'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, AC.currentTime+delay);
  g.gain.exponentialRampToValueAtTime(0.18, AC.currentTime+delay+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+delay+dur);
  o.connect(g); g.connect(AC.destination);
  o.start(AC.currentTime+delay); o.stop(AC.currentTime+delay+dur+0.05);
}
function alarmSound(){ [0,0.22,0.44].forEach((d,i)=> beep(i===2?1175:880, 0.16, d)); }

/* ---------- Voz TTS (prosodia con ánimo) ---------- */
let voices = [];
function loadVoices(){
  voices = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
  if(!voices.length) voices = speechSynthesis.getVoices();
  if(typeof renderVoiceSelect === 'function') renderVoiceSelect();
  if(!S.voice){
    const saved = store.get('voiceName', null);
    if(saved){ const v = voices.find(x=>x.name===saved); if(v) S.voice = v; }
  }
  if(!S.voice) S.voice = pickFemale();
}
function pickFemale(){
  const hints = /female|mujer|sabina|laura|monica|paulina|helena|elvira|esperanza|carolina|marisol|isabela|google espa|dalia|salome|camila/i;
  return voices.find(v=>hints.test(v.name)) || voices.find(v=>/google espa/i.test(v.name)) || voices.find(v=>/^es[-_]/i.test(v.lang)) || voices[0] || null;
}
if('speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

function mood(){
  const h = new Date().getHours();
  let m = {rate:0, pitch:0, tag:'serena'};
  if(h>=6 && h<12) m = {rate:.06, pitch:.05, tag:'energética'};
  else if(h>=12 && h<18) m = {rate:.02, pitch:.02, tag:'neutra'};
  else if(h>=18) m = {rate:-.05, pitch:-.02, tag:'íntima'};
  if(h>=23 || h<5) m = {rate:-.12, pitch:-.05, tag:'somnolienta'};
  if(WX.mode==='rain') m = {rate:-.03, pitch:0, tag:'acogedora'};
  return m;
}

let alwaysOn = store.get('alwaysListen', false);
let sttErrors = 0, restartTimer = null, ttsActive = false;

function speak(text, onend){
  if(S.muted || !('speechSynthesis' in window) || !text){ if(onend) onend(); return; }
  try{ speechSynthesis.cancel(); }catch(e){}
  const frases = String(text).replace(/\([^)]*\)/g,' ').match(/[^.!?…]+[.!?…]*/g) || [text];
  const mo = mood();
  let i = 0;
  const next = ()=>{
    if(i >= frases.length){ setPhase('idle'); if(onend) onend(); if(alwaysOn) scheduleRestart(); return; }
    const u = new SpeechSynthesisUtterance(frases[i].trim());
    if(S.voice){ u.voice = S.voice; u.lang = S.voice.lang; } else u.lang='es-ES';
    u.rate = Math.min(1.6, Math.max(.6, S.rate * (1 + mo.rate)));
    u.pitch = Math.min(2, Math.max(.5, S.pitch * (1 + mo.pitch)));
    u.onstart = ()=>{
      ttsActive = true;
      setPhase('speaking');
      if(alwaysOn){
        clearTimeout(restartTimer);
        if(recogActive){ try{ recog.abort(); }catch(e){} }
        if(typeof Ears !== 'undefined' && Ears.on) Ears.pause();
      }
    };
    u.onend = ()=>{ i++; setTimeout(next, 140); };
    u.onerror = ()=>{ i++; setTimeout(next, 60); };
    speechSynthesis.speak(u);
  };
  next();
}
function stopSpeak(){
  try{ speechSynthesis.cancel(); }catch(e){}
  setPhase('idle');
}

/* ---------- Wake Lock ---------- */
let wakeLock = null;
async function wakeOn(){
  if(!SECURE || !navigator.wakeLock){ return; }
  try{ wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}
function wakeOff(){ if(wakeLock){ wakeLock.release().catch(()=>{}); wakeLock = null; } }

/* ---------- Ambiente (lluvia, cafetería) ---------- */
const Ambient = {
  mode:null, master:null, nodes:[], timer:null,
  start(mode){
    ensureAudio(); this.stop(); if(!AC) return;
    this.mode = mode;
    this.master = AC.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(AC.destination);
    this.master.gain.exponentialRampToValueAtTime(mode==='lluvia'?0.45:0.35, AC.currentTime+2);
    const len = AC.sampleRate*4;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for(let i=0;i<len;i++){ const w = Math.random()*2-1; last = (last + 0.02*w)/1.02; d[i] = last*3.5; }
    const src = AC.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = AC.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = mode==='lluvia' ? 800 : 420;
    src.connect(filt); filt.connect(this.master);
    src.start();
    this.nodes.push(src);
    if(mode==='lluvia'){
      this.timer = setInterval(()=>{ if(Math.random()<0.8) this.plip(900+Math.random()*1600, 0.04); }, 220);
    } else {
      this.timer = setInterval(()=>{
        if(Math.random()<0.3) this.plip(1800+Math.random()*1400, 0.05);
        if(Math.random()<0.5) this.plip(120+Math.random()*90, 0.1, 'sine');
      }, 650);
    }
    $('ambBtn').style.display = 'grid';
    $('ambBtn').classList.add('play');
    toast(mode==='lluvia' ? 'Lluvia' : 'Cafetería');
  },
  plip(freq, dur, type){
    if(!AC || !this.master) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type||'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, AC.currentTime+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(AC.currentTime+dur+0.05);
  },
  stop(){
    if(this.master){
      try{ this.master.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+0.8); }catch(e){}
      const m = this.master;
      setTimeout(()=>{ try{ m.disconnect(); }catch(e){} }, 1200);
    }
    this.nodes.forEach(n=>{ try{ n.stop(); }catch(e){} });
    this.nodes = []; this.master = null;
    clearInterval(this.timer); this.timer = null; this.mode = null;
    if(!Music.on){ $('ambBtn').style.display='none'; $('ambBtn').classList.remove('play'); }
  }
};

/* ---------- Música lo-fi procedural ---------- */
const Music = {
  on:false, master:null, timer:null, beat:0, BPM:72, _crackle:null,
  CHORDS: [ {n:[60,64,67,71], b:36}, {n:[57,60,64,67], b:33}, {n:[53,57,60,64], b:29}, {n:[55,59,62,65], b:31} ],
  f(m){ return 440*Math.pow(2,(m-69)/12); },
  start(){
    ensureAudio(); this.stop(); if(!AC) return;
    this.on = true; this.beat = 0;
    this.master = AC.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(AC.destination);
    this.master.gain.exponentialRampToValueAtTime(0.55, AC.currentTime+2.5);
    this.crackle();
    const beatDur = 60/this.BPM;
    const tick = ()=>{
      if(!this.on) return;
      const b = this.beat;
      const ch = this.CHORDS[Math.floor(b/8) % this.CHORDS.length];
      if(b % 8 === 0){ this.pad(ch); this.bassNote(ch.b); }
      if(b % 4 === 0) this.kick();
      if(b % 4 === 2) this.hat();
      if(b % 2 === 1 && Math.random() < 0.5) this.pluck(pick(ch.n)+12);
      this.beat++;
      this.timer = setTimeout(tick, beatDur*1000);
    };
    tick();
    $('ambBtn').style.display = 'grid';
    $('ambBtn').classList.add('play');
    toast('Lo-fi procedural');
  },
  pad(ch){
    ch.n.forEach(m=>{
      const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = this.f(m);
      f.type = 'lowpass'; f.frequency.value = 1400;
      const dur = (60/this.BPM)*8;
      g.gain.setValueAtTime(0.0001, AC.currentTime);
      g.gain.linearRampToValueAtTime(0.05, AC.currentTime+0.8);
      g.gain.setValueAtTime(0.05, AC.currentTime+dur-1.2);
      g.gain.linearRampToValueAtTime(0.0001, AC.currentTime+dur);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(); o.stop(AC.currentTime+dur+0.1);
    });
  },
  bassNote(m){
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = this.f(m);
    const dur = (60/this.BPM)*7.5;
    g.gain.setValueAtTime(0.0001, AC.currentTime);
    g.gain.linearRampToValueAtTime(0.13, AC.currentTime+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(AC.currentTime+dur+0.1);
  },
  kick(){
    const o = AC.createOscillator(), g = AC.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(150, AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, AC.currentTime+0.12);
    g.gain.setValueAtTime(0.5, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+0.16);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(AC.currentTime+0.2);
  },
  hat(){
    const len = AC.sampleRate*0.05;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1)*(1-i/len);
    const s = AC.createBufferSource(); s.buffer = buf;
    const f = AC.createBiquadFilter(); f.type='highpass'; f.frequency.value = 7000;
    const g = AC.createGain(); g.gain.value = 0.08;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
  },
  pluck(m){
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square'; o.frequency.value = this.f(m);
    g.gain.setValueAtTime(0.0001, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.045, AC.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+0.35);
    const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 2200;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(); o.stop(AC.currentTime+0.4);
  },
  crackle(){
    const len = AC.sampleRate*3;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()<0.002 ? (Math.random()*2-1)*0.35 : (Math.random()*2-1)*0.012);
    const s = AC.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 4500;
    const g = AC.createGain(); g.gain.value = 0.5;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
    this._crackle = s;
  },
  stop(){
    this.on = false;
    clearTimeout(this.timer);
    if(this.master){
      try{ this.master.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+1); }catch(e){}
      const m = this.master;
      setTimeout(()=>{ try{ m.disconnect(); }catch(e){} }, 1500);
    }
    this.master = null;
    if(this._crackle){ try{ this._crackle.stop(); }catch(e){} this._crackle = null; }
    if(!Ambient.mode){ $('ambBtn').style.display='none'; $('ambBtn').classList.remove('play'); }
  }
};
$('ambBtn').onclick = ()=>{ Ambient.stop(); Music.stop(); };