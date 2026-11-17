// All sound is synthesized with WebAudio — no audio files, nothing to download.
// The engine starts on the first user gesture (browsers block audio before one) and
// stays silent in screenshot scenes, which never gesture. Music is a small step
// sequencer: a dark bass pulse with sparse plucks in A minor, busier as waves rise.

import { readMuted, saveMuted } from './storage.js';

const MUSIC_BPM = 112;
const STEP_SECONDS = 60 / MUSIC_BPM / 2; // eighth notes
// A-minor bass line, one note per eighth step (Hz, 0 = rest).
const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
// Sparse pluck melody over two bars (Hz, 0 = rest); played an octave up.
const PLUCK = [
  440, 0, 0, 523.25, 0, 0, 659.25, 0, 0, 523.25, 0, 0, 0, 0, 0, 0,
  440, 0, 0, 523.25, 0, 0, 587.33, 0, 659.25, 0, 0, 0, 523.25, 0, 0, 0,
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let muted = readMuted();
  let musicStep = 0;
  let nextStepTime = 0;
  let intensity = 0; // 0..1, set from the wave: more plucks as waves rise

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      const len = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      nextStepTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    get muted() {
      return muted;
    },
    /** Call from a user gesture; does nothing in screenshot scenes. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** 0..1: how busy the music gets. */
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
    },
    /** Advance the music sequencer; call every frame with dt. */
    update() {
      if (!ctx || muted) return;
      while (nextStepTime < ctx.currentTime + 0.25) {
        const step = musicStep % 32;
        const bass = BASS[step % 16];
        if (bass > 0) {
          const t0 = nextStepTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = bass;
          gain.gain.setValueAtTime(0.5, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + STEP_SECONDS * 1.8);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t0);
          osc.stop(t0 + STEP_SECONDS * 2);
        }
        const pluck = PLUCK[step];
        if (pluck > 0 && Math.random() < 0.35 + intensity * 0.6) {
          const t0 = nextStepTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = pluck;
          gain.gain.setValueAtTime(0.22, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + STEP_SECONDS * 2.5);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t0);
          osc.stop(t0 + STEP_SECONDS * 3);
        }
        musicStep += 1;
        nextStepTime += STEP_SECONDS;
      }
    },
    shoot() {
      tone(720 + Math.random() * 120, 0.07, 'square', 0.05, 0, 320);
    },
    hit() {
      noise(0.05, 0.06, 2400);
    },
    enemyDie() {
      noise(0.18, 0.14, 900);
      tone(220, 0.16, 'sawtooth', 0.06, 0, 55);
    },
    bruteDie() {
      noise(0.35, 0.2, 600);
      tone(160, 0.3, 'sawtooth', 0.1, 0, 40);
    },
    hurt() {
      tone(140, 0.22, 'sawtooth', 0.14, 0, 60);
      noise(0.12, 0.1, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.09);
      tone(990, 0.12, 'sine', 0.09, 0.07);
    },
    shard() {
      tone(1180, 0.06, 'sine', 0.05);
    },
    waveClear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, i * 0.09));
    },
    bossWarn() {
      tone(98, 0.5, 'sawtooth', 0.12, 0, 65);
      tone(98, 0.5, 'sawtooth', 0.12, 0.55, 65);
    },
    bossDie() {
      noise(0.6, 0.22, 500);
      [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, 0.15 + i * 0.1));
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.35, 'triangle', 0.11, i * 0.11));
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, i * 0.16));
    },
    upgrade() {
      tone(784, 0.1, 'sine', 0.09);
      tone(1174.66, 0.18, 'sine', 0.09, 0.08);
    },
    click() {
      tone(880, 0.05, 'sine', 0.06);
    },
  };
}
