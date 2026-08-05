import workletUrl from "./pcm-worklet.js?url";
import { audioBus } from "./audio-bus.js";

export interface MicHandle {
  sampleRate: number;
  stop(): Promise<void>;
}

/** Rates the ElevenLabs realtime endpoint accepts as `pcm_<rate>`. */
const SUPPORTED = [8000, 16000, 22050, 24000, 44100, 48000];

export const nearestSupportedRate = (rate: number): number =>
  SUPPORTED.reduce((best, candidate) =>
    Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best,
  );

/**
 * Opens the mic and streams PCM16 frames.
 *
 * We ask the AudioContext for 16 kHz — Chrome honours it and resamples the
 * device stream itself, which is both cheaper and more correct than doing it in
 * a worklet. If a browser refuses, we take whatever rate it gives and tell the
 * server; every common rate is supported upstream anyway.
 */
export async function startMic(
  onChunk: (pcm: ArrayBuffer) => void,
  onLevel: (peak: number) => void,
): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: 16000 });
  } catch {
    context = new AudioContext();
  }
  if (context.state === "suspended") await context.resume();

  await context.audioWorklet.addModule(workletUrl);

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "pcm-worklet", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
  });

  node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
    onChunk(event.data.pcm);
    onLevel(event.data.peak);
  };

  source.connect(node);
  // Second tap, purely for the orb: it needs spectrum and waveform, which the
  // PCM worklet doesn't produce.
  source.connect(audioBus.attachMic(context));

  return {
    sampleRate: nearestSupportedRate(context.sampleRate),
    async stop() {
      node.port.onmessage = null;
      audioBus.detachMic();
      source.disconnect();
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close().catch(() => {});
    },
  };
}
