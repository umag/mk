// Procedural, asset-free sound — short organic textures (wood / paper / leather)
// synthesized with the Web Audio API. Subtle by design; toggle with mute.

type Kind = "add" | "advance" | "pickup" | "drop" | "delete" | "open" | "magnet";

let actx: AudioContext | null = null;
let muted = false;
let master = 0.5;

function ctx(): AudioContext | null {
  try {
    if (!actx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actx = new AC();
    }
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; if (!muted) ctx(); return muted; }

function whiteBuffer(c: AudioContext, dur: number): AudioBuffer {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

interface NoiseOpts { dur: number; type: BiquadFilterType; freq: number; freqTo?: number; q?: number; gain: number; attack?: number; }
function noise(c: AudioContext, t: number, o: NoiseOpts) {
  const src = c.createBufferSource();
  src.buffer = whiteBuffer(c, o.dur);
  const filt = c.createBiquadFilter();
  filt.type = o.type;
  filt.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t + o.dur);
  filt.Q.value = o.q ?? 0.8;
  const g = c.createGain();
  const a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain * master, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + o.dur + 0.02);
}

interface ToneOpts { dur: number; freq: number; freqTo?: number; type?: OscillatorType; gain: number; attack?: number; }
function tone(c: AudioContext, t: number, o: ToneOpts) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "triangle";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqTo), t + o.dur);
  const g = c.createGain();
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain * master, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

export function playSound(kind: Kind) {
  if (muted) return;
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + 0.001;
  switch (kind) {
    case "add": // paper — a light, crisp tap
      noise(c, t, { dur: 0.09, type: "bandpass", freq: 2600, q: 0.7, gain: 0.16, attack: 0.002 });
      noise(c, t, { dur: 0.05, type: "highpass", freq: 3200, gain: 0.05 });
      break;
    case "advance": // wood block — a warm tock that drops in pitch
      tone(c, t, { dur: 0.11, freq: 240, freqTo: 150, type: "triangle", gain: 0.22 });
      tone(c, t, { dur: 0.06, freq: 600, freqTo: 380, type: "sine", gain: 0.08 });
      noise(c, t, { dur: 0.03, type: "bandpass", freq: 1800, q: 1.2, gain: 0.05 });
      break;
    case "pickup": // leather — a soft, muffled lift
      noise(c, t, { dur: 0.13, type: "lowpass", freq: 520, freqTo: 380, gain: 0.12, attack: 0.02 });
      break;
    case "drop": // wood + leather thunk
      tone(c, t, { dur: 0.12, freq: 150, freqTo: 90, type: "triangle", gain: 0.2 });
      noise(c, t, { dur: 0.08, type: "lowpass", freq: 600, gain: 0.1, attack: 0.003 });
      break;
    case "delete": // paper crumple — descending rustle
      noise(c, t, { dur: 0.2, type: "bandpass", freq: 2400, freqTo: 700, q: 0.6, gain: 0.13, attack: 0.004 });
      break;
    case "open": // soft paper turn
      noise(c, t, { dur: 0.12, type: "lowpass", freq: 1400, freqTo: 800, gain: 0.07, attack: 0.01 });
      break;
    case "magnet": // boards snap together — a soft magnetic clack
      tone(c, t, { dur: 0.10, freq: 190, freqTo: 120, type: "triangle", gain: 0.17 });
      noise(c, t, { dur: 0.035, type: "bandpass", freq: 2400, q: 1.5, gain: 0.06, attack: 0.002 });
      break;
  }
}
