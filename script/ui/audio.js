// ===== ÁUDIO 16-BITS (Web Audio API) =====
// Trilha e efeitos chiptune 100% sintetizados — sem assets e sem dependências.
// Timbres clássicos dos consoles: onda de pulso (25%/12.5%), triângulo e ruído.
// Nada toca antes do primeiro gesto do usuário (política de autoplay dos browsers).

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Linha de baixo em colcheias: tônica, com a quinta nos contratempos.
const linhaBaixo = (raizes) => {
  const out = [];
  raizes.forEach((r, bar) => {
    for (let i = 0; i < 8; i++)
      out.push([bar * 16 + i * 2, i === 2 || i === 6 ? r + 7 : r, 2]);
  });
  return out;
};
const porBar = (bars, offsets) => bars.flatMap((b) => offsets.map((o) => b * 16 + o));

// Notas como [passo (semicolcheia), nota MIDI, duração em passos].
const TRACKS = {
  // tema do título: Am F C G, animado
  title: {
    bpm: 150, steps: 64, leadWave: 'pulse25',
    bass: linhaBaixo([45, 41, 48, 43]),          // A2 F2 C3 G2
    lead: [
      [0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 79, 2], [8, 81, 4], [12, 76, 4],
      [16, 77, 2], [18, 72, 2], [20, 69, 2], [22, 72, 2], [24, 77, 4], [28, 81, 4],
      [32, 79, 2], [34, 76, 2], [36, 72, 2], [38, 76, 2], [40, 79, 4], [44, 84, 4],
      [48, 83, 2], [50, 79, 2], [52, 74, 2], [54, 79, 2], [56, 83, 4], [60, 86, 2], [62, 88, 2],
    ],
    kick: porBar([0, 1, 2, 3], [0, 8]),
    snare: porBar([0, 1, 2, 3], [4, 12]),
    hat: porBar([0, 1, 2, 3], [0, 2, 4, 6, 8, 10, 12, 14]),
  },
  // tema do menu: C Am F G, tranquilo
  menu: {
    bpm: 112, steps: 64, leadWave: 'triangle',
    bass: [
      [0, 48, 8], [8, 43, 8], [16, 45, 8], [24, 40, 8],
      [32, 41, 8], [40, 36, 8], [48, 43, 8], [56, 50, 8],
    ],
    lead: [
      [0, 76, 6], [8, 79, 6], [16, 72, 6], [24, 76, 6],
      [32, 69, 6], [40, 77, 6], [48, 74, 6], [56, 79, 4], [60, 83, 4],
    ],
    kick: porBar([0, 1, 2, 3], [0]),
    snare: porBar([0, 1, 2, 3], [8]),
    hat: porBar([0, 1, 2, 3], [0, 4, 8, 12]),
  },
};

class ArcadeAudio {
  constructor() {
    this.ctx = null;
    this.mudo = localStorage.getItem('cmb-mudo') === '1';
    this.loopTimer = null;
    this.trackBus = null;
  }

  // Deve ser chamado dentro de um gesto do usuário (click/tecla).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;                              // sem suporte: app segue mudo
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mudo ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.2;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.4;
    this.sfxGain.connect(this.master);
    this.waves = { pulse25: this.criarPulso(0.25), pulse125: this.criarPulso(0.125) };
    // 1s de ruído branco para a bateria (hat/caixa) e para o "clique" do zap
    const n = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  // Onda de pulso com duty-cycle arbitrário via série de Fourier.
  criarPulso(duty) {
    const N = 64;
    const real = new Float32Array(N), imag = new Float32Array(N);
    for (let i = 1; i < N; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
    return this.ctx.createPeriodicWave(real, imag);
  }

  alternarMudo() {
    this.mudo = !this.mudo;
    localStorage.setItem('cmb-mudo', this.mudo ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(this.mudo ? 0 : 1, this.ctx.currentTime, 0.01);
    return this.mudo;
  }

  nota(wave, midi, t, dur, vol, dest, slideHz) {
    const osc = this.ctx.createOscillator();
    if (this.waves[wave]) osc.setPeriodicWave(this.waves[wave]);
    else osc.type = wave;
    osc.frequency.setValueAtTime(midiHz(midi), t);
    if (slideHz) osc.frequency.exponentialRampToValueAtTime(slideHz, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setTargetAtTime(0, t + dur - 0.03, 0.02);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  bateria(tipo, t, dest) {
    if (tipo === 'kick') {
      const o = this.ctx.createOscillator();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.setTargetAtTime(0, t + 0.02, 0.04);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.2);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    if (tipo === 'hat') {
      f.type = 'highpass'; f.frequency.value = 6500;
      g.gain.setValueAtTime(0.12, t);
      g.gain.setTargetAtTime(0, t, 0.015);
    } else {                                        // caixa
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
      g.gain.setValueAtTime(0.3, t);
      g.gain.setTargetAtTime(0, t + 0.01, 0.04);
    }
    src.connect(f).connect(g).connect(dest);
    src.start(t); src.stop(t + 0.15);
  }

  agendarTrack(track, t0, dest) {
    const spb = 60 / track.bpm / 4;                 // duração da semicolcheia
    for (const [s, m, len] of track.bass)
      this.nota('triangle', m, t0 + s * spb, len * spb * 0.9, 0.5, dest);
    for (const [s, m, len] of track.lead)
      this.nota(track.leadWave, m, t0 + s * spb, len * spb * 0.9, 0.3, dest);
    for (const s of track.kick) this.bateria('kick', t0 + s * spb, dest);
    for (const s of track.snare) this.bateria('snare', t0 + s * spb, dest);
    for (const s of track.hat) this.bateria('hat', t0 + s * spb, dest);
  }

  tocarMusica(nome) {
    if (!this.ctx) return;
    this.pararMusica();
    const track = TRACKS[nome];
    const loopDur = track.steps * (60 / track.bpm / 4);
    const bus = this.ctx.createGain();
    bus.connect(this.musicGain);
    this.trackBus = bus;
    let inicio = this.ctx.currentTime + 0.08;
    const loop = () => {
      this.agendarTrack(track, inicio, bus);
      inicio += loopDur;
      // reagenda o próximo loop pouco antes do atual acabar (relógio do áudio manda)
      this.loopTimer = setTimeout(loop, (inicio - this.ctx.currentTime - 0.25) * 1000);
    };
    loop();
  }

  pararMusica() {
    clearTimeout(this.loopTimer);
    if (this.trackBus) {
      const bus = this.trackBus;
      bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      setTimeout(() => bus.disconnect(), 300);
      this.trackBus = null;
    }
  }

  // ---------- Efeitos ----------
  ficha() {                                         // moeda entrando (coin)
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.nota('pulse25', 83, t, 0.08, 0.5, this.sfxGain);
    this.nota('pulse25', 88, t + 0.08, 0.3, 0.5, this.sfxGain);
  }

  blip() {                                          // clique de interface
    if (!this.ctx) return;
    this.nota('pulse25', 88, this.ctx.currentTime, 0.05, 0.3, this.sfxGain);
  }

  erro() {                                          // buzina de "errou!"
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.nota('square', 55, t, 0.12, 0.4, this.sfxGain);
    this.nota('square', 51, t + 0.13, 0.28, 0.4, this.sfxGain);
  }

  jingle() {                                        // fanfarra de rota encontrada
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => this.nota('pulse25', m, t + i * 0.07, 0.09, 0.45, this.sfxGain));
    this.nota('pulse25', 88, t + 0.3, 0.4, 0.5, this.sfxGain);
  }

  motor(dur = 1.5) {                                // carro acelerando
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(190, t + dur * 0.85);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(1100, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.15);
    g.gain.setTargetAtTime(0, t + dur - 0.15, 0.08);
    o.connect(f).connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.2);
  }

  zap() {                                           // TV de tubo desligando
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.setTargetAtTime(0, t + 0.25, 0.05);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.5);
    const click = this.ctx.createBufferSource();    // "tec" do tubo apagando
    click.buffer = this.noiseBuf;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.25, t + 0.3);
    cg.gain.setTargetAtTime(0, t + 0.31, 0.01);
    click.connect(cg).connect(this.sfxGain);
    click.start(t + 0.3); click.stop(t + 0.4);
  }
}

export const audio = new ArcadeAudio();
