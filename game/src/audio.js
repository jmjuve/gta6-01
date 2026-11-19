// LOWTIDE — audio.js
// One clear job: every sound is synthesized live with WebAudio — engine
// hum that follows speed, waves, sirens, a synthwave driving loop and
// one-shot effects. No audio files, no licensed music.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let waveGain = null;
  let musicTimer = null;
  let sirenOn = false;
  let sirenOscA = null;
  let sirenOscB = null;
  let musicOn = false;
  let step = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 62;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Waves: looped filtered noise, gain follows the tide.
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      waveGain = ctx.createGain(); waveGain.gain.value = 0.0;
      src.connect(bp); bp.connect(waveGain); waveGain.connect(master);
      src.start();
      return true;
    } catch (_) { return false; }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Original synthwave loop: Am – F – C – G arpeggio, 8 steps a bar.
  const CHORDS = [
    [110, 130.8, 164.8, 220], [87.3, 130.8, 174.6, 220],
    [130.8, 164.8, 196, 261.6], [98, 146.8, 196, 246.9],
  ];
  function startMusic() {
    if (!ctx || musicOn || muted) return;
    musicOn = true;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const chord = CHORDS[Math.floor(step / 8) % 4];
      const note = chord[step % 4];
      blip(note * 2, 0.22, 'triangle', 0.05);
      if (step % 8 === 0) blip(chord[0] / 2, 0.5, 'sine', 0.09);
      if (step % 4 === 2) blip(220, 0.08, 'square', 0.02);
      step++;
    }, 190);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null; musicOn = false;
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m) stopMusic(); else startMusic();
    },
    get muted() { return muted; },
    // Called every frame: speed 0..1, tideLevel 0..1, inBoat, wanted.
    update(speed01, tideLevel, inBoat, wanted) {
      if (!ctx || muted) return;
      if (engineOsc) engineOsc.frequency.value = 55 + speed01 * 160 + (inBoat ? 25 : 0);
      if (engineGain) engineGain.gain.value = 0.02 + speed01 * 0.06;
      if (waveGain) waveGain.gain.value = 0.01 + tideLevel * 0.05;
      if (wanted >= 3 && !sirenOn) {
        sirenOn = true;
        sirenOscA = ctx.createOscillator(); sirenOscA.type = 'sine'; sirenOscA.frequency.value = 660;
        sirenOscB = ctx.createOscillator(); sirenOscB.type = 'sine'; sirenOscB.frequency.value = 520;
        const g = ctx.createGain(); g.gain.value = 0.03;
        sirenOscA.connect(g); sirenOscB.connect(g); g.connect(master);
        sirenOscA.start(); sirenOscB.start();
        const lfo = ctx.createOscillator(); lfo.frequency.value = 1.4;
        const lg = ctx.createGain(); lg.gain.value = 0.02;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        sirenOscA._lfo = lfo; sirenOscA._g = g;
      } else if (wanted < 3 && sirenOn) {
        sirenOn = false;
        try { sirenOscA._lfo.stop(); sirenOscA.stop(); sirenOscB.stop(); sirenOscA._g.disconnect(); } catch (_) {}
        sirenOscA = null; sirenOscB = null;
      }
    },
    horn() { blip(370, 0.35, 'sawtooth', 0.12); blip(466, 0.35, 'sawtooth', 0.1); },
    cash() { blip(880, 0.12, 'sine', 0.15); blip(1318, 0.2, 'sine', 0.15, 0.1); },
    crash() { blip(70, 0.3, 'sawtooth', 0.25); blip(45, 0.4, 'square', 0.2, 0.02); },
    shoot() { blip(1400, 0.07, 'square', 0.12); blip(300, 0.1, 'sawtooth', 0.1); },
    pickup() { blip(660, 0.1, 'sine', 0.14); blip(990, 0.16, 'sine', 0.14, 0.08); },
    busted() { blip(220, 0.4, 'sawtooth', 0.2); blip(165, 0.6, 'sawtooth', 0.2, 0.3); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.25, 'triangle', 0.14, i * 0.12)); },
    startMusic, stopMusic,
  };
}
