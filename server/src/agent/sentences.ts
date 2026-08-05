/**
 * Splits a token stream into complete sentences so TTS can start speaking
 * before Claude has finished the paragraph. Without this, audio only begins
 * after the whole turn lands and the app feels laggy.
 */
export class SentenceBuffer {
  #buffer = "";
  #onSentence: (sentence: string) => void;

  constructor(onSentence: (sentence: string) => void) {
    this.#onSentence = onSentence;
  }

  push(chunk: string) {
    this.#buffer += chunk;
    // Break only on . ! ? or a newline. Colons and semicolons looked tempting,
    // but splitting there chops a clause mid-thought and the TTS pause lands in
    // the wrong place ("Tapi RAM-nya yang bikin sesak:" / "hampir 90% kepakai").
    // The decimal guard keeps "3.5 GB" from becoming two utterances.
    const pattern = /(.+?(?:[.!?](?=\s|$)|\n))/gs;
    let consumed = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(this.#buffer)) !== null) {
      const piece = match[1] ?? "";
      if (/\d[.,]$/.test(piece.trimEnd()) && piece.trimEnd().length < 8) continue;
      const spoken = forSpeech(piece);
      if (spoken) this.#onSentence(spoken);
      consumed = match.index + piece.length;
    }
    if (consumed > 0) this.#buffer = this.#buffer.slice(consumed);
  }

  /** Speak whatever is left — call at end of turn. */
  flush() {
    const rest = forSpeech(this.#buffer);
    this.#buffer = "";
    if (rest) this.#onSentence(rest);
  }

  /** Throw away pending text — call on barge-in. */
  discard() {
    this.#buffer = "";
  }
}

/**
 * Strips things that sound wrong when read aloud. Claude is told not to emit
 * markdown in spoken replies, but a stray `**` or URL still slips through.
 */
export function forSpeech(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "tautan")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // A fragment with no letters or digits is punctuation noise, not speech.
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : "";
}
