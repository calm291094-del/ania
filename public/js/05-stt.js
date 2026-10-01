/* ============================================================
   05-STT · reconocimiento de voz (nativo + Vosk + Whisper offline)
============================================================ */
'use strict';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, recogActive = false;

if(SR){
  recog = new SR();
  recog.lang = 'es-ES';
  recog.maxAlternatives = 5;
  recog.interimResults = true;
  recog.continuous = true;
  recog.onresult = e=>{
    let fin='', inter='';
    for (let i = 0; i < e.results.length; i++) {
      const result = e.results[i];
      if (result.isFinal) {
        let mejor = result[0];
        for (let j = 1; j < result.length; j++) {
          if (result[j].confidence > mejor.confidence) mejor = result[j];
        }
        if (mejor && mejor.transcript) {
          if (mejor.confidence && mejor.confidence < 0.5) {
            console.warn('[STT] Confianza baja:', mejor.confidence, '→', mejor.transcript);
          }
          fin += mejor.transcript + ' ';
        }
      } else {
        if (result[0] && result[0].transcript) inter += result[0].transcript;
      }
    }
    if(inter && !alwaysOn) $('userInput').value = inter;
    if(!fin) return;
    const low = LINGUA.normalizar(fin);
    if(alwaysOn){
      const m = low.match(/\b(ania|ana|anja|aña|annia|hania|onia|anea|aniya|anya|añia|añá|anie|anio|anni?[ae]|a[nñ]{1,2}[iy]a?)\b/);
      if(!m) return;
      let cmd = fin.slice(low.indexOf(m[0]) + m[0].length).replace(/^[\s,.:;¡!¿?]+/,'').trim();
      if(!cmd){ stopSpeak(); return reply('¿Sí? Te escucho.'); }
      stopSpeak();
      toast('ANIA ▸ '+cmd.slice(0,36));
      send(cmd);
    } else { send(fin.trim()); }
  };
  recog.onend = ()=>{
    recogActive = false;
    $('micBtn').classList.remove('live');
    if(S.phase==='listening' && !alwaysOn) setPhase('idle');
    if(alwaysOn && !ttsActive && !(typeof Ears !== 'undefined' && Ears.on)) scheduleRestart();
  };
  recog.onerror = e=>{
    if(e.error==='not-allowed'){ alwaysOn = false; store.set('alwaysListen', false); updateVoiceUI(); toastError('Micrófono denegado'); return; }
    if(e.error==='network' || e.error==='audio-capture') sttErrors++;
    if(S.phase==='listening' && !alwaysOn) setPhase('idle');
  };
}

function scheduleRestart(){
  clearTimeout(restartTimer);
  restartTimer = setTimeout(()=>{
    if(alwaysOn && !(typeof Ears !== 'undefined' && Ears.on)) startListening(true);
  }, sttErrors > 3 ? 2500 : 300);
}
function startListening(silent){
  if(!recog || recogActive) return;
  try{
    recog.start();
    recogActive = true;
    if(!silent){ $('micBtn').classList.add('live'); setPhase('listening'); }
  }catch(e){}
}
function setAlways(v){
  alwaysOn = !!v;
  store.set('alwaysListen', alwaysOn);
  clearTimeout(restartTimer);
  if(alwaysOn){
    ensureAudio();
    if(typeof Ears !== 'undefined' && Ears.asr && !Ears.on){ Ears.start(); }
    else if(!(typeof Ears !== 'undefined' && Ears.on)) startListening(true);
    toast('Escucha activa: di «Ania»');
  } else {
    if(typeof Ears !== 'undefined' && Ears.on) Ears.stop();
    if(recogActive){ try{ recog.stop(); }catch(e){} }
  }
  updateVoiceUI();
}
function updateVoiceUI(){
  $('micBtn').classList.toggle('awake', alwaysOn);
  $('btnAlways').textContent = alwaysOn ? 'ESCUCHA ACTIVA: SÍ' : 'ESCUCHA ACTIVA: NO';
}

/* ---------- micBtn: decide entre nativo, Vosk o Whisper ---------- */
$('micBtn').onclick = async ()=>{
  if (VoskEngine.on){ VoskEngine.stop(); return; }
  if (Ears.on){ Ears.stop(); refreshEarsUI(); return; }
  if (isOffline()){ await VoskEngine.start(); return; }
  if (recog && !recogActive){ stopSpeak(); ensureAudio(); startListening(); return; }
  if (Ears.asr){ await Ears.start(); return; }
  if (!recog){ toastError('Voz no disponible. Usa Chrome/Edge.'); return; }
};

/* ---------- Resample (para Whisper) ---------- */
function resampleTo16k(input, rate){
  if(rate === 16000) return input;
  const ratio = rate/16000;
  const outLen = Math.floor(input.length/ratio);
  const out = new Float32Array(outLen);
  for(let i=0;i<outLen;i++){
    const pos = i*ratio;
    const i0 = Math.floor(pos), i1 = Math.min(input.length-1, i0+1);
    const fr = pos - i0;
    out[i] = input[i0]*(1-fr) + input[i1]*fr;
  }
  return out;
}

/* ---------- Vosk (offline WASM) ---------- */
const VoskEngine = {
  model: null, recognizer: null, stream: null, actx: null, proc: null, sink: null,
  on: false, ready: false,
  _modelUrls: [
    './models/vosk-model-small-es-0.42.tar.gz',
    'https://cdn.statically.io/gh/calm291094-del/ania/v1.0-modelos/vosk-model-small-es-0.42.tar.gz',
    'https://corsproxy.io/?url=https%3A%2F%2Fgithub.com%2Fcalm291094-del%2Fania%2Freleases%2Fdownload%2Fv1.0-modelos%2Fvosk-model-small-es-0.42.tar.gz'
  ],
  async loadModel(){
    if (this.model) return true;
    if (typeof Vosk === 'undefined'){ console.warn('[Vosk] Librería no cargada'); return false; }
    for (let i = 0; i < this._modelUrls.length; i++){
      const url = this._modelUrls[i];
      try{
        toast('Cargando modelo de voz offline... (' + (i+1) + '/' + this._modelUrls.length + ')');
        const model = await Vosk.createModel(url);
        this.model = model; this.ready = true;
        toast('Oído offline listo');
        return true;
      }catch(e){ console.warn('[Vosk] Falló la URL ' + (i+1) + ':', e.message); }
    }
    toastError('No se pudo cargar el modelo de voz offline');
    return false;
  },
  async start(){
    if (this.on) return;
    if (!this.ready){ if(!(await this.loadModel())) return; }
    try{ this.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch(e){ toastError('Micrófono denegado'); return; }
    this.actx = new AudioContext();
    const source = this.actx.createMediaStreamSource(this.stream);
    this.proc = this.actx.createScriptProcessor(4096, 1, 1);
    this.sink = this.actx.createGain(); this.sink.gain.value = 0;
    const self = this;
    const recognizer = new this.model.KaldiRecognizer(this.actx.sampleRate);
    this.recognizer = recognizer;
    recognizer.on('result', (message) => {
      const texto = (message.result && message.result.text) || '';
      if (texto) self.handleTranscript(texto);
    });
    recognizer.on('partialresult', (message) => {
      const parcial = (message.result && message.result.partial) || '';
      if (parcial && !alwaysOn){
        const inp = document.getElementById('userInput');
        if (inp) inp.value = parcial;
      }
    });
    this.proc.onaudioprocess = (ev) => {
      if (!self.on) return;
      const data = ev.inputBuffer.getChannelData(0);
      try{ recognizer.acceptWaveform(data); }catch(e){}
    };
    source.connect(this.proc); this.proc.connect(this.sink); this.sink.connect(this.actx.destination);
    this.on = true;
    setPhase('listening');
    toastInfo('Oído offline activo');
  },
  stop(){
    this.on = false;
    if (this.proc){ try{ this.proc.disconnect(); }catch(e){} this.proc = null; }
    if (this.sink){ try{ this.sink.disconnect(); }catch(e){} this.sink = null; }
    if (this.stream){ this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.actx){ try{ this.actx.close(); }catch(e){} this.actx = null; }
    if (this.recognizer){ try{ this.recognizer.remove(); }catch(e){} this.recognizer = null; }
    if (S.phase === 'listening') setPhase('idle');
    toastInfo('Oído offline detenido');
  },
  handleTranscript(texto){
    const low = LINGUA.normalizar(texto);
    if (alwaysOn){
      const m = low.match(/\b(ania|ana|anja|aña|annia|hania|onia|anea|aniya|anya|añia|añá|anie|anio|anni?[ae]|a[nñ]{1,2}[iy]a?)\b/);
      if (!m) return;
      const cmd = texto.slice(low.indexOf(m[0]) + m[0].length).replace(/^[\s,.:;¡!¿?]+/,'').trim();
      if (!cmd){ stopSpeak(); return reply('¿Sí? Te escucho.'); }
      stopSpeak();
      send(cmd);
    } else { send(texto.trim()); }
  }
};

/* ---------- Ears (Whisper offline) ---------- */
const Ears = {
  on:false, asr:null, stream:null, actx:null, proc:null, sink:null,
  buf:[], capture:false, talkTrail:0, level:0, transcribing:false, paused:false,
  model: store.get('earsModel', 'onnx-community/whisper-base'),
  async load(){
    if(this.asr) return true;
    toast('Cargando oído local (~80 MB, luego offline)...');
    setPhase('thinking');
    let mod = null;
    for(const p of ['./vendor/transformers/transformers.min.js', './engine/transformers.mjs']){
      try{ mod = await import(p); break; }catch(e){}
    }
    if(!mod){ setPhase('idle'); toast('Sin runtime: engine/ o internet', true); return false; }
    try{
      if(mod.env) mod.env.allowLocalModels = false;
      this.asr = await mod.pipeline('automatic-speech-recognition', this.model, { dtype:'q8' });
      setPhase('idle');
      return true;
    }catch(e){ setPhase('idle'); toast('No cargó el modelo', true); return false; }
  },
  async start(){
    if(this.on) return;
    if(!(await this.load())) return;
    try{ this.stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
    catch(e){ toast('Micrófono denegado', true); return; }
    this.actx = new AudioContext();
    const src = this.actx.createMediaStreamSource(this.stream);
    this.proc = this.actx.createScriptProcessor(4096, 1, 1);
    this.sink = this.actx.createGain(); this.sink.gain.value = 0;
    const self = this;
    this.proc.onaudioprocess = ev => {
      const d = ev.inputBuffer.getChannelData(0);
      let s = 0;
      for(let i=0;i<d.length;i++) s += d[i]*d[i];
      const rms = Math.sqrt(s/d.length);
      self.level = Math.min(1, rms*9);
      if(!self.on || self.paused) return;
      if(rms > 0.012) self.talkTrail = Date.now();
      const inSpeech = Date.now() - self.talkTrail < 900;
      if(inSpeech){ self.buf.push(new Float32Array(d)); self.capture = true; }
      else if(self.capture && self.buf.length){ self.capture = false; self.flush(); }
      const secs = self.buf.reduce((a,b)=>a+b.length,0) / self.actx.sampleRate;
      if(secs > 9) self.flush();
    };
    src.connect(this.proc); this.proc.connect(this.sink); this.sink.connect(this.actx.destination);
    this.on = true; this.paused = false;
    if(recogActive){ try{ recog.stop(); }catch(e){} }
    $('earsPill').style.display = 'inline-flex';
    setPhase('listening');
    refreshEarsUI();
  },
  pause(){ this.paused = true; },
  resume(){ if(this.on) this.paused = false; },
  stop(){
    this.on = false; this.paused = false;
    if(this.proc){ try{ this.proc.disconnect(); }catch(e){} this.proc = null; }
    if(this.sink){ try{ this.sink.disconnect(); }catch(e){} this.sink = null; }
    if(this.stream){ this.stream.getTracks().forEach(t=>t.stop()); this.stream = null; }
    if(this.actx){ try{ this.actx.close(); }catch(e){} this.actx = null; }
    this.buf = []; this.capture = false;
    $('earsPill').style.display = 'none';
    if(S.phase==='listening') setPhase('idle');
    refreshEarsUI();
  },
  async flush(){
    if(this.transcribing || !this.buf.length) return;
    this.transcribing = true;
    const rate = this.actx ? this.actx.sampleRate : 48000;
    let total = 0;
    this.buf.forEach(b => total += b.length);
    const merged = new Float32Array(total);
    let off = 0;
    for(const b of this.buf){ merged.set(b, off); off += b.length; }
    this.buf = [];
    const audio = resampleTo16k(merged, rate);
    try{
      const out = await this.asr(audio, { language:'es', task:'transcribe' });
      const text = (out && out.text ? out.text : '').trim();
      if(text) this.handleTranscript(text);
    }catch(e){}
    this.transcribing = false;
  },
  handleTranscript(fin){
    const low = LINGUA.normalizar(fin);
    if(alwaysOn){
      const m = low.match(/\b(ania|ana|anja|aña|annia|hania|onia|anea|aniya|anya|añia|añá|anie|anio|anni?[ae]|a[nñ]{1,2}[iy]a?)\b/);
      if(!m) return;
      let cmd = fin.slice(low.indexOf(m[0]) + m[0].length).replace(/^[\s,.:;¡!¿?]+/,'').trim();
      if(!cmd){ stopSpeak(); return reply('¿Sí? Te escucho.'); }
      stopSpeak();
      send(cmd);
    } else { send(fin.trim()); }
  }
};

(function earPulse(){
  if(Ears.on && S.phase==='listening') drawLevel += (Math.min(1, Ears.level*1.4) - drawLevel)*0.25;
  requestAnimationFrame(earPulse);
})();

function refreshEarsUI(){
  $('btnEars').textContent = Ears.on ? 'OÍDO LOCAL: ACTIVO' : 'ACTIVAR OÍDO LOCAL';
}
$('btnEars').onclick = async ()=>{ Ears.on ? Ears.stop() : await Ears.start(); };
if ($('btnVosk')){
  $('btnVosk').onclick = async ()=>{
    if (VoskEngine.on){ VoskEngine.stop(); $('btnVosk').textContent = 'OÍDO OFFLINE (VOSK)'; }
    else { await VoskEngine.start(); $('btnVosk').textContent = 'DETENER VOSK'; }
  };
}
$('btnEarsModel').onclick = ()=>{
  const cur = store.get('earsModel','onnx-community/whisper-base');
  const next = cur.includes('tiny') ? 'onnx-community/whisper-base' : 'onnx-community/whisper-tiny';
  store.set('earsModel', next); Ears.model = next; Ears.asr = null;
  refreshEarsUI();
  toast('Modelo: '+next.split('/')[1]);
};