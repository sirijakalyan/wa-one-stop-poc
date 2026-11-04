// Calendar files for renewal dates. Everything is built in the browser; nothing is sent anywhere.
// Each renewal becomes an all-day event on the date the owner entered, with alerts 30, 7 and 1 days before.

const pad = (n) => String(n).padStart(2, '0');
const compact = (iso) => iso.replaceAll('-', '');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// The day after an ISO date, as an ISO date (an all-day event ends the next day).
export function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 bytes are folded, as the calendar format requires.
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// events: [{ id, date: 'YYYY-MM-DD', title, description, url }]
export function buildIcs(events, { now = new Date(), alarmText = 'Renewal coming up' } = {}) {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WA Business One-Stop//Renewals//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events.filter((x) => isDate(x.date))) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${e.date}@wa-onestop`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.description)}`,
    );
    if (e.url) lines.push(`URL:${e.url}`);
    for (const days of [30, 7, 1]) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(alarmText)}`, `TRIGGER:-P${days}D`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// A link that opens Google Calendar's "new event" page with the details filled in.
export function googleUrl(e) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${compact(e.date)}/${compact(nextDay(e.date))}`, details: e.description });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSafe = (s) => String(s || 'renewal').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'renewal';
