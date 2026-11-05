import { describe, it, expect, vi } from 'vitest';

describe('listener waits through short pauses', () => {
  it('joins speech around a 0.6 second pause and sends it once after 1 second of quiet', async () => {
    vi.useFakeTimers();
    let inst;
    window.SpeechRecognition = class {
      constructor() { inst = this; this.starts = 0; }
      start() { this.starts += 1; }
      stop() { setTimeout(() => this.onend?.(), 0); }
      abort() {}
      say(text, final = true) { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] }); }
    };
    const { createListener } = await import('./voice.js');
    const onFinal = vi.fn();
    const onEnd = vi.fn();
    const l = createListener({ onFinal, onEnd });
    l.start();
    inst.say('I want to open');
    inst.onend(); // browser closes the mic after a short silence
    expect(inst.starts).toBe(2); // reopened
    await vi.advanceTimersByTimeAsync(600);
    expect(onFinal).not.toHaveBeenCalled();
    inst.say('a food business');
    await vi.advanceTimersByTimeAsync(1100);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('I want to open a food business');
    await vi.advanceTimersByTimeAsync(10);
    expect(onEnd).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });
});
