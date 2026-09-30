/**
 * speech.js — says a lesson's lines with the device's English voice and
 * reports each word as it is spoken, so the caption can light it up.
 *
 * Two reading styles: 'words' speaks one word at a time (every word lights up
 * exactly when its sound starts), 'natural' speaks whole sentences and uses
 * the voice's word boundaries when the device sends them.
 */

/** Split a line into word tokens with their character ranges. */
export function tokenize(text) {
  return Array.from(text.matchAll(/\S+/g), (m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

/** The token that contains character `charIndex`, or -1. */
export function tokenIndexAt(tokens, charIndex) {
  return Number.isFinite(charIndex) ? tokens.findIndex((t) => charIndex >= t.start && charIndex < t.end) : -1;
}

export class Speaker {
  /**
   * @param {object} o
   * @param {SpeechSynthesis|null} o.synth
   * @param {typeof SpeechSynthesisUtterance} o.Utterance
   * @param {() => boolean} o.enabled      sound on and play not paused
   * @param {() => SpeechSynthesisVoice|undefined} o.voice
   * @param {() => 'words'|'natural'} o.style
   * @param {(text: string) => void} o.onPhrase        a line starts (or, without sound, the line to show)
   * @param {(index: number, word: string) => void} o.onWord   -1 = the whole line
   * @param {(speaking: boolean) => void} o.onSpeaking
   * @param {(reason: string) => void} o.onError
   */
  constructor({
    synth,
    Utterance,
    enabled,
    voice,
    style,
    onPhrase,
    onWord,
    onSpeaking,
    onError,
    schedule = (fn, ms) => setTimeout(fn, ms),
    unschedule = (id) => clearTimeout(id),
  }) {
    Object.assign(this, {
      synth,
      Utterance,
      enabled,
      voice,
      style,
      onPhrase,
      onWord,
      onSpeaking,
      onError,
      schedule,
      unschedule,
    });
    this.generation = 0;
    this.timer = null;
    this.watchdog = null;
    this.current = null;
    this.busy = false;
  }

  stop() {
    this.generation++;
    this.unschedule(this.timer);
    this.unschedule(this.watchdog);
    this.current = null;
    this.busy = false;
    try {
      this.synth?.cancel();
    } catch {
      /* some browsers throw while nothing is queued */
    }
    this.onSpeaking(false);
  }

  /** Say one line or a list of lines, one after another. */
  say(input) {
    this.stop();
    const phrases = (Array.isArray(input) ? input : [input]).filter((x) => typeof x === 'string' && x.trim());
    if (!phrases.length) return;
    if (!this.enabled() || !this.synth || !this.Utterance) {
      // No voice: show the sentence (the second line, when there is one).
      this.onPhrase(phrases[1] || phrases[0]);
      return;
    }
    this.onPhrase(phrases[0]);
    const generation = this.generation;
    this.busy = true;
    const live = () => this.generation === generation && this.enabled();
    const finish = () => {
      if (this.generation !== generation) return;
      this.busy = false;
      this.current = null;
      this.unschedule(this.watchdog);
      this.onSpeaking(false);
    };
    const fail = (reason) => {
      if (!live()) return;
      finish();
      this.onError(reason);
    };

    const speakOne = (text, onStart, onBoundary, onDone) => {
      if (!live()) {
        finish();
        return;
      }
      const utterance = new this.Utterance(text);
      const voice = this.voice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'en-CA';
      utterance.rate = this.style() === 'words' ? 0.9 : 0.83;
      utterance.pitch = 1.02;
      utterance.volume = 1;
      this.current = utterance;
      let ended = false;
      const mine = () => live() && this.current === utterance && !ended;
      utterance.onstart = () => {
        if (!mine()) return;
        this.onSpeaking(true);
        onStart();
      };
      utterance.onboundary = (e) => {
        if (mine()) onBoundary(e);
      };
      utterance.onend = () => {
        if (!mine()) return;
        ended = true;
        this.unschedule(this.watchdog);
        this.current = null;
        onDone();
      };
      utterance.onerror = (e) => {
        if (!mine()) return;
        ended = true;
        this.unschedule(this.watchdog);
        if (['canceled', 'interrupted'].includes(e.error)) finish();
        else fail(e.error);
      };
      // A voice that never starts or never ends must not leave the lesson waiting forever.
      this.unschedule(this.watchdog);
      this.watchdog = this.schedule(() => {
        if (!mine()) return;
        this.stop();
        this.onError('timeout');
      }, 20000);
      try {
        this.synth.resume();
        this.synth.speak(utterance);
      } catch {
        fail('unavailable');
      }
    };

    const sayPhrase = (index) => {
      if (!live() || index >= phrases.length) {
        finish();
        return;
      }
      const text = phrases[index];
      const tokens = tokenize(text);
      this.onPhrase(text);
      const next = () => {
        this.onSpeaking(false);
        this.timer = this.schedule(() => sayPhrase(index + 1), 650);
      };
      if (this.style() === 'words') {
        const sayWord = (w) => {
          if (!live()) {
            finish();
            return;
          }
          if (w >= tokens.length) {
            next();
            return;
          }
          speakOne(
            tokens[w].text,
            () => this.onWord(w, tokens[w].text),
            () => {},
            () => {
              this.onSpeaking(false);
              this.timer = this.schedule(() => sayWord(w + 1), 65);
            },
          );
        };
        sayWord(0);
      } else {
        speakOne(
          text,
          () => this.onWord(-1, text),
          (e) => {
            if (e.name && e.name !== 'word') return;
            const w = tokenIndexAt(tokens, e.charIndex);
            if (w >= 0) this.onWord(w, tokens[w].text);
          },
          next,
        );
      }
    };
    sayPhrase(0);
  }
}
