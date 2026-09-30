// 程序化音乐与音效（全部原创旋律，WebAudio 实时合成）
const N = (s) => { // 'C4' -> midi
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3]) + 1) * 12;
};
const f = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const chord = (root, kind) => { const r = N(root); const iv = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], sus: [0, 5, 7], add9: [0, 4, 7, 14] }[kind]; return iv.map((i) => r + i); };

function buildSong(name) {
  const ev = []; const add = (t, inst, n, d, v = 0.5) => ev.push({ t, inst, n, d, v });
  if (name === 'title') { // 水晶前奏风格的原创琶音
    const prog = [['C3', 'M9'], ['A2', 'm9'], ['F2', 'M7'], ['G2', 'sus'], ['E2', 'm7'], ['A2', 'm9'], ['D3', 'm7'], ['G2', 'M']];
    prog.forEach(([r, k], ci) => {
      const c = chord(r, k); const seq = [c[0], c[1] + 12, c[2], c[0] + 12, c[1] + 24, c[2] + 12, c[0] + 24, c[2] + 24];
      const up = [...seq, ...seq.slice().reverse()];
      up.forEach((n, i) => add(ci * 8 + i * 0.5, 'harp', n, 1.6, 0.34 + (i % 4 === 0 ? 0.1 : 0)));
      add(ci * 8, 'pad', c.map((x) => x + 12), 8, 0.16);
      add(ci * 8, 'bass', c[0], 7.5, 0.25);
    });
    const mel = [[0, 'E5', 3], [3, 'D5', 1], [4, 'G5', 4], [8, 'C5', 3], [11, 'B4', 1], [12, 'E5', 4], [16, 'A4', 3], [19, 'C5', 1], [20, 'F5', 4],
      [24, 'D5', 2], [26, 'E5', 2], [28, 'G5', 4], [32, 'B4', 3], [35, 'D5', 1], [36, 'G5', 4], [40, 'C5', 3], [43, 'E5', 1], [44, 'A5', 4], [48, 'F5', 3], [51, 'E5', 1], [52, 'D5', 4], [56, 'D5', 2], [58, 'B4', 2], [60, 'G4', 4]];
    mel.forEach(([t, n, d]) => add(t, 'flute', N(n), d, 0.22));
    return { bpm: 76, len: 64, ev };
  }
  if (name === 'town') { // 3/4 拍海港圆舞曲
    const bars = [['D3', 'M'], ['G2', 'M'], ['A2', 'M'], ['D3', 'M'], ['B2', 'm'], ['G2', 'M'], ['E2', 'm'], ['A2', '7'], ['D3', 'M'], ['G2', 'M'], ['A2', 'M'], ['D3', 'M'], ['G2', 'M'], ['D3', 'M'], ['E2', 'm'], ['D3', 'M']];
    bars.forEach(([r, k], b) => {
      const c = chord(r, k), t = b * 3;
      add(t, 'bass', c[0], 1, 0.4); add(t + 1, 'pluck', c.map((x) => x + 12), 0.5, 0.2); add(t + 2, 'pluck', c.map((x) => x + 12), 0.5, 0.2);
    });
    const mel = [['A4', 2], ['F#4', 1], ['G4', 1], ['B4', 1], ['D5', 1], ['C#5', 2], ['B4', 1], ['A4', 3], ['B4', 1.5], ['A4', 0.5], ['F#4', 1], ['G4', 1], ['E4', 1], ['D4', 1], ['E4', 1.5], ['F#4', 0.5], ['G4', 0.5], ['E4', 0.5], ['D4', 3],
      ['F#4', 1], ['A4', 1], ['D5', 1], ['D5', 2], ['B4', 1], ['C#5', 1], ['E5', 1], ['C#5', 1], ['A4', 3], ['B4', 1], ['D5', 1], ['B4', 1], ['A4', 1], ['F#4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['C#5', 1], ['D5', 3]];
    let t = 0; mel.forEach(([n, d]) => { add(t, 'flute', N(n), d * 0.95, 0.3); t += d; });
    return { bpm: 132, len: 48, ev };
  }
  if (name === 'field') {
    const prog = [['G2', 'add9'], ['E2', 'm7'], ['C3', 'M7'], ['D3', 'sus'], ['G2', 'add9'], ['B2', 'm7'], ['C3', 'M7'], ['D3', '7']];
    prog.forEach(([r, k], ci) => {
      const c = chord(r, k), t = ci * 4;
      add(t, 'pad', c.map((x) => x + 12), 4, 0.12); add(t, 'bass', c[0], 1.5, 0.35); add(t + 2, 'bass', c[0] + 7, 1.5, 0.25);
      [0, 1, 2, 1, 3 % c.length, 2, 1, 2].forEach((ix, i) => add(t + i * 0.5, 'harp', c[ix % c.length] + 12 + (i > 3 ? 12 : 0), 1.2, 0.22));
    });
    const mel = [[0, 'B4', 1.5], [1.5, 'D5', 0.5], [2, 'E5', 2], [4, 'D5', 1.5], [5.5, 'B4', 0.5], [6, 'G4', 2], [8, 'A4', 1], [9, 'B4', 1], [10, 'C5', 1], [11, 'E5', 1], [12, 'D5', 4],
      [16, 'G5', 1.5], [17.5, 'F#5', 0.5], [18, 'D5', 2], [20, 'B4', 1.5], [21.5, 'D5', 0.5], [22, 'F#4', 2], [24, 'G4', 1], [25, 'A4', 1], [26, 'B4', 1], [27, 'C5', 1], [28, 'A4', 4]];
    mel.forEach(([t, n, d]) => add(t, 'flute', N(n), d, 0.24));
    return { bpm: 96, len: 32, ev };
  }
  if (name === 'battle' || name === 'boss') {
    const boss = name === 'boss';
    const prog = boss ? [['D2', 'm'], ['Bb1', 'M'], ['C2', 'M'], ['A1', 'M'], ['D2', 'm'], ['G1', 'm'], ['Bb1', 'M'], ['A1', '7']] : [['A1', 'm'], ['F1', 'M'], ['G1', 'M'], ['E1', 'M'], ['A1', 'm'], ['D2', 'm'], ['F1', 'M'], ['E1', '7']];
    prog.forEach(([r, k], ci) => {
      const c = chord(r, k), t = ci * 4;
      for (let i = 0; i < 8; i++) add(t + i * 0.5, 'bass', c[0] + (i % 4 === 3 ? 12 : 0), 0.45, 0.42);
      if (boss) for (let i = 0; i < 16; i++) add(t + i * 0.25, 'pluck', [c[i % 3] + 24], 0.2, 0.12);
      add(t, 'strings', c.map((x) => x + 24), 1.5, 0.2); add(t + 2.5, 'strings', c.map((x) => x + 24), 1.5, 0.18);
      for (let i = 0; i < 4; i++) { add(t + i, 'kick', 0, 0.2, 0.9); if (i % 2) add(t + i, 'snare', 0, 0.2, 0.5); if (boss && i === 3) add(t + 3.5, 'kick', 0, 0.2, 0.6); }
      for (let i = 0; i < 8; i++) add(t + i * 0.5, 'hat', 0, 0.05, i % 2 ? 0.25 : 0.15);
    });
    const mel = boss
      ? [[0, 'D5', 1.5], [1.5, 'E5', 0.5], [2, 'F5', 1], [3, 'A5', 1], [4, 'G5', 2], [6, 'F5', 1], [7, 'D5', 1], [8, 'E5', 1.5], [9.5, 'C5', 0.5], [10, 'E5', 1], [11, 'G5', 1], [12, 'A5', 4], [16, 'D6', 1.5], [17.5, 'C6', 0.5], [18, 'A5', 1], [19, 'F5', 1], [20, 'G5', 1.5], [21.5, 'Bb5', 0.5], [22, 'A5', 1], [23, 'G5', 1], [24, 'F5', 1], [25, 'E5', 1], [26, 'D5', 1], [27, 'F5', 1], [28, 'E5', 2], [30, 'C#5', 2]]
      : [[0, 'A4', 1], [1, 'C5', 0.5], [1.5, 'E5', 1.5], [3, 'D5', 1], [4, 'C5', 1.5], [5.5, 'A4', 0.5], [6, 'C5', 2], [8, 'B4', 1], [9, 'D5', 0.5], [9.5, 'G5', 1.5], [11, 'F5', 1], [12, 'E5', 2], [14, 'G#4', 2], [16, 'A4', 1], [17, 'E5', 1], [18, 'A5', 2], [20, 'G5', 1], [21, 'F5', 1], [22, 'D5', 2], [24, 'C5', 1.5], [25.5, 'D5', 0.5], [26, 'E5', 1], [27, 'A5', 1], [28, 'G#5', 4]];
    mel.forEach(([t, n, d]) => add(t, 'lead', N(n), d * 0.95, boss ? 0.2 : 0.18));
    return { bpm: boss ? 168 : 152, len: 32, ev };
  }
  if (name === 'dungeon') {
    const prog = [['D3', 'm'], ['Bb2', 'M7'], ['G2', 'm7'], ['A2', '7']];
    prog.forEach(([r, k], ci) => {
      const c = chord(r, k), t = ci * 8;
      add(t, 'pad', c, 8, 0.18); add(t, 'bass', c[0] - 12, 7, 0.3);
      [0, 2.5, 4, 5.5, 7].forEach((o, i) => add(t + o, 'harp', c[(i * 2) % c.length] + 24, 2.5, 0.16));
      add(t + 6, 'drip', 0, 0.3, 0.2); add(t + 3.3, 'drip', 0, 0.3, 0.14);
    });
    return { bpm: 64, len: 32, ev };
  }
  if (name === 'ending') {
    const prog = [['F2', 'M7'], ['G2', 'sus'], ['E2', 'm7'], ['A2', 'm9'], ['D3', 'm7'], ['G2', 'M'], ['C3', 'M9'], ['C3', 'M9']];
    prog.forEach(([r, k], ci) => {
      const c = chord(r, k), t = ci * 4;
      add(t, 'pad', c.map((x) => x + 12), 4, 0.16); add(t, 'bass', c[0], 3.5, 0.28);
      for (let i = 0; i < 8; i++) add(t + i * 0.5, 'harp', c[i % c.length] + 12 + (i >= 4 ? 12 : 0), 1.4, 0.2);
    });
    const mel = [[0, 'A4', 2], [2, 'C5', 2], [4, 'D5', 3], [7, 'G4', 1], [8, 'E5', 2], [10, 'D5', 1], [11, 'C5', 1], [12, 'E5', 4], [16, 'F5', 2], [18, 'E5', 1], [19, 'D5', 1], [20, 'B4', 3], [23, 'G4', 1], [24, 'C5', 4], [28, 'G5', 4]];
    mel.forEach(([t, n, d]) => add(t, 'flute', N(n), d, 0.26));
    return { bpm: 72, len: 32, ev };
  }
  return { bpm: 100, len: 4, ev };
}

class AudioSys {
  constructor() { this.ctx = null; this.songs = {}; this.cur = null; this.musicVol = 0.5; this.sfxVol = 0.8; this.muted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    // 混响
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revGain = c.createGain(); this.revGain.gain.value = 0.35;
    this.rev.connect(this.revGain); this.revGain.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.tick(), 40);
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }
  setVolumes(m, s) { this.musicVol = m; this.sfxVol = s; if (this.ctx) { this.music.gain.value = m; this.sfx.gain.value = s; } }
  env(g, t, a, d, peak, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); }
  out(node, bus, wet = 0.3) { node.connect(bus); if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.rev); } }
  osc(type, freq, t, dur, gainNode, detune = 0) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(gainNode); o.start(t); o.stop(t + dur + 0.05); return o; }
  noise(t, dur, dest) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return s; }
  inst(name, t, n, d, v, bus) {
    const c = this.ctx;
    if (name === 'harp' || name === 'pluck') {
      const notes = Array.isArray(n) ? n : [n];
      for (const m of notes) {
        const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = name === 'harp' ? 3200 : 1800;
        g.connect(lp); this.out(lp, bus, name === 'harp' ? 0.45 : 0.2);
        const dur = name === 'harp' ? Math.max(1.2, d) : 0.35;
        this.env(g, t, 0.004, dur, v * (name === 'harp' ? 0.5 : 0.35));
        this.osc('triangle', f(m), t, dur, g); if (name === 'harp') this.osc('sine', f(m) * 2, t, dur * 0.5, g);
      }
    } else if (name === 'pad' || name === 'strings') {
      const notes = Array.isArray(n) ? n : [n]; const sec = d * this.spb;
      for (const m of notes) {
        const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = name === 'pad' ? 900 : 2200;
        g.connect(lp); this.out(lp, bus, 0.5);
        const att = name === 'pad' ? Math.min(0.9, sec * 0.3) : 0.04;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.18, t + att); g.gain.setValueAtTime(v * 0.18, t + sec * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + sec + 0.3);
        this.osc('sawtooth', f(m), t, sec + 0.3, g, -7); this.osc('sawtooth', f(m), t, sec + 0.3, g, 7);
      }
    } else if (name === 'flute' || name === 'lead') {
      const sec = d * this.spb; const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = name === 'lead' ? 2600 : 3000;
      g.connect(lp); this.out(lp, bus, 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.3, t + 0.05); g.gain.setValueAtTime(v * 0.26, t + Math.max(0.06, sec - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + sec + 0.12);
      const o = this.osc(name === 'lead' ? 'sawtooth' : 'sine', f(n), t, sec + 0.15, g);
      if (name === 'flute') this.osc('triangle', f(n), t, sec + 0.15, g).detune.value = 3;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 0; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f(n) * 0.006, t + Math.min(0.4, sec));
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + sec + 0.2);
    } else if (name === 'bass') {
      const sec = d * this.spb; const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      g.connect(lp); this.out(lp, bus, 0.05); this.env(g, t, 0.01, sec, v * 0.6, 0.001);
      this.osc('triangle', f(n), t, sec, g); this.osc('sine', f(n) / 2, t, sec, g);
    } else if (name === 'kick') {
      const g = c.createGain(); this.out(g, bus, 0.05); this.env(g, t, 0.002, 0.3, v * 0.9);
      const o = this.osc('sine', 150, t, 0.35, g); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    } else if (name === 'snare' || name === 'hat') {
      const g = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = name === 'hat' ? 7000 : 1200;
      g.connect(hp); this.out(hp, bus, name === 'snare' ? 0.2 : 0.05); this.env(g, t, 0.001, name === 'hat' ? 0.05 : 0.18, v * 0.5);
      this.noise(t, 0.25, g);
    } else if (name === 'drip') {
      const g = c.createGain(); this.out(g, bus, 0.8); this.env(g, t, 0.002, 0.25, v * 0.4);
      const o = this.osc('sine', 1400 + Math.random() * 800, t, 0.3, g); o.frequency.exponentialRampToValueAtTime(600, t + 0.2);
    }
  }
  play(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.cur && this.cur.name === name) return;
    if (!this.songs[name]) this.songs[name] = buildSong(name);
    // 淡出旧曲
    const old = this.curBus;
    if (old) { old.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5); setTimeout(() => old.disconnect(), 2500); }
    const bus = this.ctx.createGain(); bus.gain.value = 0.0001; bus.gain.setTargetAtTime(1, this.ctx.currentTime + 0.1, 0.6); bus.connect(this.music);
    this.curBus = bus;
    const s = this.songs[name];
    this.cur = { name, s, start: this.ctx.currentTime + 0.15, idx: 0, loop: 0 };
    this.spb = 60 / s.bpm;
  }
  stop() { if (this.curBus) this.curBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4); this.cur = null; }
  tick() {
    if (!this.cur || !this.ctx) return;
    const { s } = this.cur; const spb = 60 / s.bpm; this.spb = spb;
    const ahead = this.ctx.currentTime + 0.25;
    const sorted = s.sorted || (s.sorted = s.ev.slice().sort((a, b) => a.t - b.t));
    for (let guard = 0; guard < 400; guard++) {
      if (this.cur.idx >= sorted.length) { this.cur.idx = 0; this.cur.loop++; }
      const e = sorted[this.cur.idx];
      const t = this.cur.start + (this.cur.loop * s.len + e.t) * spb;
      if (t > ahead) break;
      if (t > this.ctx.currentTime - 0.05) this.inst(e.inst, t, e.n, e.d, e.v, this.curBus);
      this.cur.idx++;
    }
  }
  // ---------- 音效 ----------
  sfxPlay(name, vol = 1) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + 0.01; const bus = this.sfx;
    const tone = (type, fr, dur, v, fr2, wet = 0.2) => { const g = c.createGain(); this.out(g, bus, wet); this.env(g, t, 0.005, dur, v * vol); const o = this.osc(type, fr, t, dur, g); if (fr2) o.frequency.exponentialRampToValueAtTime(fr2, t + dur); return o; };
    const nz = (fType, fr, dur, v, fr2, delay = 0) => { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = fType; fl.frequency.value = fr; fl.Q.value = 1.2; g.connect(fl); this.out(fl, bus, 0.25); this.env(g, t + delay, 0.004, dur, v * vol); if (fr2) fl.frequency.exponentialRampToValueAtTime(fr2, t + delay + dur); this.noise(t + delay, dur + 0.05, g); };
    const chime = (notes, gap, v, type = 'sine', dur = 0.9) => notes.forEach((m, i) => { const g = c.createGain(); this.out(g, bus, 0.5); this.env(g, t + i * gap, 0.005, dur, v * vol); this.osc(type, f(m), t + i * gap, dur, g); });
    switch (name) {
      case 'click': tone('sine', 1200, 0.06, 0.15); break;
      case 'hover': tone('sine', 1800, 0.03, 0.05); break;
      case 'open': chime([N('E5'), N('B5')], 0.05, 0.12); break;
      case 'close': chime([N('B5'), N('E5')], 0.05, 0.1); break;
      case 'confirm': chime([N('A5'), N('E6')], 0.07, 0.18); break;
      case 'error': tone('square', 220, 0.15, 0.08, 180, 0); break;
      case 'slash': nz('bandpass', 4000, 0.16, 0.5, 700); break;
      case 'hit': nz('lowpass', 1200, 0.15, 0.6, 200); tone('sine', 140, 0.12, 0.4, 60, 0); break;
      case 'crit': nz('lowpass', 2500, 0.2, 0.7, 300); tone('sine', 180, 0.18, 0.5, 60, 0); chime([N('E6')], 0, 0.1); break;
      case 'bow': tone('triangle', 260, 0.18, 0.3, 140, 0); nz('highpass', 3000, 0.1, 0.2); break;
      case 'cast': tone('sine', 400, 0.6, 0.06, 900, 0.5); break;
      case 'fire': nz('lowpass', 900, 0.6, 0.8, 150); tone('sawtooth', 90, 0.4, 0.15, 40); break;
      case 'ice': chime([N('E6'), N('B6'), N('G#6'), N('E7')], 0.03, 0.12, 'triangle', 0.5); nz('highpass', 5000, 0.3, 0.3); break;
      case 'thunder': nz('highpass', 2000, 0.08, 0.9); nz('lowpass', 300, 1.2, 0.8, 60, 0.05); break;
      case 'stone': nz('lowpass', 700, 0.3, 0.7, 100); tone('square', 110, 0.1, 0.1, 50); break;
      case 'wind': nz('bandpass', 1200, 0.6, 0.5, 3000); break;
      case 'heal': chime([N('C6'), N('E6'), N('G6'), N('C7')], 0.06, 0.15, 'sine', 1.2); break;
      case 'buff': chime([N('G5'), N('D6'), N('G6')], 0.05, 0.14, 'triangle', 0.8); break;
      case 'levelup': chime([N('C5'), N('E5'), N('G5'), N('C6'), N('E6'), N('G6'), N('C7')], 0.07, 0.2, 'triangle', 1.5); break;
      case 'quest': chime([N('D5'), N('A5'), N('D6')], 0.12, 0.2, 'triangle', 1.2); break;
      case 'questdone': chime([N('G4'), N('C5'), N('E5'), N('G5'), N('E5'), N('G5'), N('C6')], 0.1, 0.22, 'triangle', 1.4); break;
      case 'fanfare': {
        const seq = [['G4', 0], ['C5', 0.12], ['E5', 0.24], ['G5', 0.36], ['F5', 0.6], ['E5', 0.78], ['D5', 0.96], ['E5', 1.14], ['C5', 1.4]];
        seq.forEach(([n, d]) => { const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp); this.out(lp, bus, 0.4); this.env(g, t + d, 0.02, d === 1.4 ? 2.2 : 0.3, 0.2 * vol); this.osc('sawtooth', f(N(n)), t + d, 2.4, g); this.osc('square', f(N(n)) / 2, t + d, 2.4, g); });
        chime([N('C4'), N('G4'), N('C5'), N('E5')], 0, 0.12, 'triangle', 3); break;
      }
      case 'death': chime([N('E4'), N('C4'), N('A3')], 0.2, 0.18, 'triangle', 1); break;
      case 'kweh': { const g = c.createGain(); this.out(g, bus, 0.2); this.env(g, t, 0.01, 0.35, 0.18 * vol); const o = this.osc('square', 620, t, 0.4, g); o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(980, t + 0.12); o.frequency.linearRampToValueAtTime(520, t + 0.35); break; }
      case 'teleport': chime([N('C5'), N('G5'), N('C6'), N('G6'), N('C7'), N('G7')], 0.08, 0.12, 'sine', 1.2); nz('bandpass', 800, 1.5, 0.2, 4000); break;
      case 'aoe': nz('lowpass', 600, 0.8, 0.9, 80); tone('sine', 90, 0.6, 0.5, 30); break;
      case 'lb': nz('lowpass', 400, 1.8, 1, 60); chime([N('C4'), N('G4'), N('C5'), N('G5'), N('C6')], 0.05, 0.2, 'sawtooth', 1.5); break;
      case 'loot': chime([N('E6'), N('G#6'), N('B6')], 0.06, 0.14); break;
      case 'duty': chime([N('A4'), N('E5'), N('A5'), N('C#6')], 0.09, 0.2, 'triangle', 1.2); break;
      case 'seal': nz('bandpass', 300, 1.0, 0.5, 1200); chime([N('D4'), N('A4')], 0.2, 0.12, 'triangle', 1); break;
      case 'footstep': nz('lowpass', 400, 0.05, 0.08); break;
      case 'water': nz('lowpass', 1500, 0.9, 0.6, 200); break;
    }
  }
}
export const Audio = new AudioSys();
