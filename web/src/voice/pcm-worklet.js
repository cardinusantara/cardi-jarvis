/**
 * Converts the mic's Float32 frames to PCM16 and posts them to the main thread.
 *
 * No resampling here on purpose: the AudioContext is asked for the rate we want
 * and we tell the server whatever rate we actually got. Resampling in a worklet
 * is a good way to introduce aliasing nobody notices until the transcript is bad.
 */
class PcmWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    const pcm = new Int16Array(channel.length);
    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > peak) peak = magnitude;
    }

    this.port.postMessage({ pcm: pcm.buffer, peak }, [pcm.buffer]);
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
