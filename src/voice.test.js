import { describe, it, expect } from 'vitest';
import { speakable } from './voice.js';

describe('speakable', () => {
  it('drops brackets, footers and list lines, and says L and I and D O R as letters', () => {
    const text = 'Set up workers\' compensation insurance (Labor & Industries).\nL&I runs this with DOR.\nSource checked on 2026-10-26. Not yet Approved by a named reviewer.\nSteps:\n1. Do a thing';
    const out = speakable(text);
    expect(out).toBe("Set up workers' compensation insurance. L and I runs this with D O R.");
  });
  it('keeps long answers to about three sentences and ends on a full stop', () => {
    const long = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1} about the license.`).join(' ');
    const out = speakable(long);
    expect(out.length).toBeLessThanOrEqual(340);
    expect(out.endsWith('.')).toBe(true);
  });
  it('leaves short text alone', () => {
    expect(speakable('How will your business be set up? If you are not sure, that is fine.')).toBe('How will your business be set up? If you are not sure, that is fine.');
  });
});

describe('speakable ack', () => {
  it('does not read "Got it." before the next question, so the owner can answer sooner', () => {
    expect(speakable('Got it. Do you expect gross income of $12,000 a year or more?')).toBe('Do you expect gross income of $12,000 a year or more?');
  });
});

describe('speak recovers from a stuck speech queue', () => {
  it('resets and retries, last time without a chosen voice, even while speaking stays true', async () => {
    vi.useFakeTimers();
    const { speak } = await import('./voice.js');
    const uttered = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.speechSynthesis = {
      speaking: true, pending: false, paused: false,
      getVoices: () => [{ name: 'Microsoft Sabina', lang: 'es-MX', localService: true }],
      cancel: vi.fn(),
      speak: vi.fn((u) => { uttered.push(u); if (uttered.length === 3) setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); }),
    };
    const onEnd = vi.fn();
    const onSilent = vi.fn();
    speak('Hola', { lang: 'es-US', onEnd, onSilent });
    await vi.advanceTimersByTimeAsync(20000);
    expect(uttered.length).toBe(3);
    expect(uttered[0].voice?.name).toBe('Microsoft Sabina');
    expect(uttered[2].voice).toBeUndefined();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(onSilent).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
