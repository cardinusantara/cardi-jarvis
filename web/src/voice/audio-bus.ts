/**
 * Shared analyser taps for the orb.
 *
 * Mic and playback live in separate AudioContexts on purpose: the mic context
 * runs at 16 kHz (what the transcriber wants) and forcing playback through it
 * would resample speech down to telephone quality. So each side gets its own
 * analyser and the orb reads whichever is currently making sound.
 */

/**
 * Explicitly backed by ArrayBuffer, not ArrayBufferLike: the Web Audio typings
 * refuse a possibly-shared buffer, and these never are.
 */
type Bytes = Uint8Array<ArrayBuffer>;

export interface AudioFrame {
  freq: Bytes;
  wave: Bytes;
  /** 0–1 loudness, already smoothed. */
  level: number;
  source: "mic" | "playback" | "none";
}

const BINS = 128;

class Tap {
  readonly analyser: AnalyserNode;
  readonly freq: Bytes;
  readonly wave: Bytes;

  constructor(context: AudioContext) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = BINS * 2;
    this.analyser.smoothingTimeConstant = 0.75;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.wave = new Uint8Array(this.analyser.fftSize);
  }

  read(): number {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.freq.length; i++) sum += this.freq[i]!;
    return sum / (this.freq.length * 255);
  }
}

class AudioBus {
  #mic: Tap | null = null;
  #playback: Tap | null = null;
  #level = 0;
  readonly #silent: Bytes = new Uint8Array(BINS);
  readonly #flat: Bytes = new Uint8Array(BINS * 2).fill(128);

  attachMic(context: AudioContext): AnalyserNode {
    this.#mic = new Tap(context);
    return this.#mic.analyser;
  }

  detachMic() {
    this.#mic = null;
  }

  attachPlayback(context: AudioContext): AnalyserNode {
    this.#playback ??= new Tap(context);
    return this.#playback.analyser;
  }

  /**
   * Called once per animation frame by the orb.
   *
   * `prefer` pins the source instead of picking the louder one. The orb passes
   * its own state: while Cardi is speaking we want the animation driven purely
   * by her voice, never by mic bleed or room noise crossing the threshold
   * between words; while listening, purely by the user's voice. Without this,
   * a quiet beat between two TTS sentences can dip the playback level below
   * mic level for a frame and the orb visibly flinches toward "your voice".
   */
  read(prefer: "mic" | "playback" | "auto" = "auto"): AudioFrame {
    const playbackLevel = this.#playback?.read() ?? 0;
    const micLevel = this.#mic?.read() ?? 0;

    let tap: Tap | null = null;
    let source: AudioFrame["source"] = "none";
    if (prefer === "playback") {
      if (this.#playback) {
        tap = this.#playback;
        source = "playback";
      }
    } else if (prefer === "mic") {
      if (this.#mic) {
        tap = this.#mic;
        source = "mic";
      }
    } else if (playbackLevel > 0.008 && playbackLevel >= micLevel) {
      tap = this.#playback;
      source = "playback";
    } else if (micLevel > 0.004) {
      tap = this.#mic;
      source = "mic";
    }

    const raw = source === "playback" ? playbackLevel : source === "mic" ? micLevel : 0;
    // Fast attack, slow release — the orb should snap awake and settle gently.
    this.#level += (raw - this.#level) * (raw > this.#level ? 0.45 : 0.08);

    return {
      freq: tap?.freq ?? this.#silent,
      wave: tap?.wave ?? this.#flat,
      level: this.#level,
      source,
    };
  }
}

export const audioBus = new AudioBus();
