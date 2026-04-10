import { useRef, useCallback } from 'react';

export default function useGameSounds() {
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }, []);

  // Stone placement — crisp woody click
  const playPlace = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;

      // Noise burst for the "tap" texture
      const bufLen = ctx.sampleRate * 0.04;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 8);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3200;
      filter.Q.value = 1.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.06);

      // Tonal "tock" — short sine blip
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.15, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(oscGain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  // Capture — satisfying descending pop
  const playCapture = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;

      // Two pops staggered
      for (let i = 0; i < 2; i++) {
        const offset = i * 0.08;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600 - i * 120, t + offset);
        osc.frequency.exponentialRampToValueAtTime(80, t + offset + 0.12);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.15);
      }

      // Noise crunch layer
      const bufLen = ctx.sampleRate * 0.1;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 4);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.12, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      noise.connect(filter).connect(nGain).connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.15);
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  // Win fanfare — ascending arpeggio
  const playWin = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const offset = i * 0.12;

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.5);

        // Harmonic shimmer
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0, t + offset);
        g2.gain.linearRampToValueAtTime(0.06, t + offset + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.4);

        osc2.connect(g2).connect(ctx.destination);
        osc2.start(t + offset);
        osc2.stop(t + offset + 0.4);
      });
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  // Puzzle solved — ascending chime (climbing feel)
  const playClimb = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      // Ascending fifth: feels like stepping up
      const notes = [392, 523, 659]; // G4, C5, E5

      notes.forEach((freq, i) => {
        const offset = i * 0.1;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.18, t + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.35);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.35);
      });
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  // Puzzle wrong — stumble thud
  const playStumble = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  // ELO milestone — summit bell
  const playSummit = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6

      notes.forEach((freq, i) => {
        const offset = i * 0.08;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.15, t + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.6);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.6);
      });
    } catch (e) { /* audio not supported */ }
  }, [getCtx]);

  return { playPlace, playCapture, playWin, playClimb, playStumble, playSummit };
}
