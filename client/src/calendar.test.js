import { describe, it, expect } from 'vitest';
import { buildIcs, googleUrl, nextDay, fileSafe } from './calendar.js';

const ev = { id: 'dor', date: '2027-03-31', title: 'Renewal due: Business license, Dept. of Revenue', description: 'Confirm the date; check, links\nNew line', url: 'https://x.example/my-business' };
const NOW = new Date('2026-11-04T10:00:00Z');

describe('calendar file', () => {
  it('moves to the next day across month and year ends', () => {
    expect(nextDay('2027-03-31')).toBe('2027-04-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
  it('builds an all-day event with alerts 30, 7 and 1 days before', () => {
    const ics = buildIcs([ev], { now: NOW });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270331');
    expect(ics).toContain('DTEND;VALUE=DATE:20270401');
    expect(ics).toContain('DTSTAMP:20261104T100000Z');
    for (const d of [30, 7, 1]) expect(ics).toContain(`TRIGGER:-P${d}D`);
    expect(ics).toContain('UID:dor-2027-03-31@wa-onestop');
  });
  it('escapes commas, semicolons and new lines and folds long lines', () => {
    const ics = buildIcs([ev], { now: NOW });
    expect(ics).toContain('Confirm the date\; check\\, links\\nNew line');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it('skips events with no valid date and one file can hold several', () => {
    const ics = buildIcs([ev, { ...ev, id: 'esd', date: '2027-01-31' }, { ...ev, id: 'x', date: '' }], { now: NOW });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
  it('makes a Google Calendar link with the date range and no secrets', () => {
    const u = new URL(googleUrl(ev));
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('dates')).toBe('20270331/20270401');
    expect(u.searchParams.get('text')).toBe(ev.title);
  });
  it('makes a safe file name', () => {
    expect(fileSafe('Apply for your Washington business license / (DOR)')).toBe('Apply-for-your-Washington-business-license-DOR');
  });
});
