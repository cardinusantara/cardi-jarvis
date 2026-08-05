/**
 * Web Speech API fallback, used when no ElevenLabs key is configured.
 *
 * Chrome-only in practice, and less accurate on mixed Indonesian/English
 * technical speech — but it costs nothing and needs no setup, so the app is
 * fully usable out of the box.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

const getRecognitionCtor = (): RecognitionCtor | null => {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const browserSttSupported = () => getRecognitionCtor() !== null;

export interface BrowserRecognition {
  stop(): void;
}

export function startBrowserRecognition(
  language: string,
  handlers: {
    onPartial: (text: string) => void;
    onFinal: (text: string) => void;
    onError: (message: string) => void;
  },
): BrowserRecognition | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = language === "id" ? "id-ID" : language;
  recognition.continuous = true;
  recognition.interimResults = true;

  let stopped = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        const trimmed = text.trim();
        if (trimmed) handlers.onFinal(trimmed);
      } else {
        interim += text;
      }
    }
    if (interim.trim()) handlers.onPartial(interim.trim());
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are routine while idling — not worth surfacing.
    if (event.error !== "no-speech" && event.error !== "aborted") {
      handlers.onError(event.error);
    }
  };

  // Chrome ends the session on its own every so often; restart until told to stop.
  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        /* already restarting */
      }
    }
  };

  recognition.start();

  return {
    stop() {
      stopped = true;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* already gone */
      }
    },
  };
}

export const browserTtsSupported = () => typeof speechSynthesis !== "undefined";

export function browserSpeak(text: string, language: string, onStateChange: (speaking: boolean) => void) {
  if (!browserTtsSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "id" ? "id-ID" : language;
  utterance.rate = 1.05;
  utterance.onstart = () => onStateChange(true);
  utterance.onend = () => onStateChange(speechSynthesis.speaking);
  utterance.onerror = () => onStateChange(false);
  speechSynthesis.speak(utterance);
}

export function browserStopSpeaking() {
  if (browserTtsSupported()) speechSynthesis.cancel();
}
