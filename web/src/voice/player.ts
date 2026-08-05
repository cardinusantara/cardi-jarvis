/**
 * Sequential audio queue for TTS.
 *
 * Sentences arrive one at a time and must play in order without gaps. Web Audio
 * rather than <audio> elements: stopping is instantaneous, which is what makes
 * barge-in feel like interrupting a person instead of pausing a recording.
 */
import { audioBus } from "./audio-bus.js";

export class AudioQueue {
  #context: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;
  #queue: AudioBuffer[] = [];
  #current: AudioBufferSourceNode | null = null;
  #playing = false;
  #onStateChange: (speaking: boolean) => void;

  constructor(onStateChange: (speaking: boolean) => void) {
    this.#onStateChange = onStateChange;
  }

  async #ensureContext(): Promise<AudioContext> {
    if (!this.#context || this.#context.state === "closed") {
      this.#context = new AudioContext();
      // Route playback through the shared analyser so the orb pulses with the
      // assistant's own voice, not just the mic.
      this.#analyser = audioBus.attachPlayback(this.#context);
      this.#analyser.connect(this.#context.destination);
    }
    if (this.#context.state === "suspended") await this.#context.resume();
    return this.#context;
  }

  async push(base64: string) {
    const context = await this.#ensureContext();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const buffer = await context.decodeAudioData(bytes.buffer as ArrayBuffer);
    this.#queue.push(buffer);
    if (!this.#playing) void this.#drain();
  }

  async #drain() {
    this.#playing = true;
    this.#onStateChange(true);
    const context = await this.#ensureContext();

    while (this.#queue.length) {
      const buffer = this.#queue.shift()!;
      await new Promise<void>((resolve) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.#analyser ?? context.destination);
        source.onended = () => resolve();
        this.#current = source;
        source.start();
      });
      this.#current = null;
    }

    this.#playing = false;
    this.#onStateChange(false);
  }

  /** Barge-in: drop everything, immediately. */
  stop() {
    this.#queue.length = 0;
    if (this.#current) {
      this.#current.onended = null;
      try {
        this.#current.stop();
      } catch {
        /* already finished */
      }
      this.#current = null;
    }
    this.#playing = false;
    this.#onStateChange(false);
  }

  get speaking() {
    return this.#playing;
  }
}
