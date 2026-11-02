import { describe, it, expect } from 'vitest';

describe('a stopped greeting', () => {
  it('does not report that it ended, so a replacement greeting is not cut short', async () => {
    const { speak, stopSpeaking } = await import('./voice.js');
    const queue = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.speechSynthesis = { speak: (u) => { queue.push(u); setTimeout(() => u.onstart?.(), 0); }, cancel: () => {}, getVoices: () => [] };
    let ended = 0;
    speak('Hi, there. Tell me, please.', { fadeIn: true, onEnd: () => { ended += 1; } });
    for (let n = 0; n < 40 && !queue.length; n += 1) await new Promise((r) => setTimeout(r, 50)); // a line right after a cancel waits a moment
    expect(queue.length).toBe(1);
    stopSpeaking();
    queue[0].onend?.(); // the browser reports the cancelled piece as finished
    await new Promise((r) => setTimeout(r, 50));
    expect(ended).toBe(0);
    expect(queue.length).toBe(1);
    delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
});
