// Sound, all synthesised with WebAudio: no audio files are loaded. Short effects are
// one-shot oscillators and noise bursts; the siren and engine hum follow the game
// state; a small procedural music loop plays a warm chord progression.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // Am - F - C - G, as warm pad chords with a walking bass line.
  const CHORDS = [
    [110.0, 130.81, 164.81, 220.0],
    [87.31, 130.81, 174.61, 220.0],
    [130.81, 164.81, 196.0, 261.63],
    [98.0, 146.83, 196.0, 246.94],
  ];
  const BASS = [55.0, 43.65, 65.41, 49.0];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noise(dur, vol, lowpass = 1200) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted || ctx.state !== 'running') return;
      const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      const bass = BASS[Math.floor(musicStep / 4) % BASS.length];
      const beat = musicStep % 4;
      if (beat === 0) {
        for (const f of chord) tone(f, 1.9, 'triangle', 0.16);
        tone(bass, 0.9, 'sine', 0.3);
      } else if (beat === 2) {
        tone(bass * 1.5, 0.4, 'sine', 0.2);
      }
      if (beat === 1 || beat === 3) noise(0.05, 0.05, 6000);
      musicStep += 1;
    }, 300);
  }

  return {
    ensure,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot(weapon) {
      if (weapon === 'shotgun') { noise(0.22, 0.5, 900); tone(120, 0.18, 'square', 0.25, 0, 60); }
      else if (weapon === 'smg') { noise(0.08, 0.3, 2400); tone(220, 0.06, 'square', 0.15, 0, 90); }
      else { noise(0.12, 0.4, 1800); tone(180, 0.1, 'square', 0.2, 0, 70); }
    },
    punch() { tone(140, 0.12, 'sine', 0.4, 0, 60); noise(0.06, 0.2, 500); },
    explosion() { noise(0.7, 0.7, 500); tone(70, 0.6, 'sine', 0.5, 0, 30); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, 0.09); },
    cash() { tone(880, 0.1, 'triangle', 0.25); tone(1174, 0.1, 'triangle', 0.25, 0.1); tone(1568, 0.2, 'triangle', 0.25, 0.2); },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      tone(659, 0.14, 'triangle', 0.3, 0.14);
      tone(784, 0.14, 'triangle', 0.3, 0.28);
      tone(1046, 0.3, 'triangle', 0.3, 0.42);
    },
    click() { tone(440, 0.05, 'square', 0.12); },
    hurt() { tone(200, 0.15, 'sawtooth', 0.2, 0, 90); },
    carHit() { noise(0.1, 0.3, 700); },
    /** Called every frame: siren follows the wanted level, engine follows speed. */
    update(wanted, driving, speedRatio) {
      if (!ctx || muted) return;
      try {
        const t = ctx.currentTime;
        sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.05 : 0, t, 0.3);
        if (wanted > 0) {
          if (!sirenTimer) {
            let high = false;
            sirenTimer = window.setInterval(() => {
              if (!ctx) return;
              high = !high;
              sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, ctx.currentTime, 0.05);
            }, 380);
          }
        } else if (sirenTimer) {
          window.clearInterval(sirenTimer);
          sirenTimer = null;
        }
        engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speedRatio * 110, t, 0.1);
      } catch {
        // Audio is decoration; a failure never stops the game.
      }
    },
  };
}
