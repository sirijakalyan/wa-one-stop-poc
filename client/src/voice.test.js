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
