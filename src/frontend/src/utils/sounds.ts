// Web Audio API sound effects for Wave Chat
// Uses OscillatorNode — no external assets needed

function createCtx(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

export function playMessageSound() {
  const ctx = createCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // ignore
  }
}

export function playLikeSound() {
  const ctx = createCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // ignore
  }
}

export function playFollowSound() {
  const ctx = createCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // ignore
  }
}

let callToneCtx: AudioContext | null = null;
let callToneOsc: OscillatorNode | null = null;
let callToneGain: GainNode | null = null;
let callToneInterval: ReturnType<typeof setInterval> | null = null;

export function playCallIncomingSound() {
  stopCallIncomingSound();
  try {
    callToneCtx = new AudioContext();
    const playTone = () => {
      if (!callToneCtx) return;
      callToneOsc = callToneCtx.createOscillator();
      callToneGain = callToneCtx.createGain();
      callToneOsc.connect(callToneGain);
      callToneGain.connect(callToneCtx.destination);
      callToneOsc.type = "sine";
      callToneOsc.frequency.value = 880;
      callToneGain.gain.setValueAtTime(0.1, callToneCtx.currentTime);
      callToneGain.gain.exponentialRampToValueAtTime(
        0.001,
        callToneCtx.currentTime + 0.4,
      );
      callToneOsc.start(callToneCtx.currentTime);
      callToneOsc.stop(callToneCtx.currentTime + 0.4);
    };
    playTone();
    callToneInterval = setInterval(playTone, 1200);
  } catch {
    // ignore
  }
}

export function stopCallIncomingSound() {
  if (callToneInterval) {
    clearInterval(callToneInterval);
    callToneInterval = null;
  }
  if (callToneCtx) {
    callToneCtx.close().catch(() => {});
    callToneCtx = null;
    callToneOsc = null;
    callToneGain = null;
  }
}
