// One look for every email the app sends: a clean HTML version plus a plain-text version for mail apps that need it.
// Inline styles and tables only, because mail apps ignore most other CSS. No scripts, no images, no tracking.
const BRAND = 'WA Business One-Stop-Shop';
const NAVY = '#0f2a43';
const TEAL = '#0e7c86';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

// heading: big title. paragraphs: array of strings, or { text, bold: ['phrase'] } (bold phrases are matched inside the text).
// facts: [{ label, value }] shown as a small table. button: { label, url }. note: small print under the button.
// footer: small print at the bottom; footerLinks: [{ label, url }].
export function renderEmail({ heading, paragraphs = [], facts = [], sections = [], button, note = '', footer = '', footerLinks = [] }) {
  const boldify = (p) => {
    const text = typeof p === 'string' ? p : p.text;
    const bold = typeof p === 'string' ? [] : p.bold || [];
    let out = esc(text);
    for (const b of bold) out = out.split(esc(b)).join(`<strong style="color:${NAVY}">${esc(b)}</strong>`);
    return out;
  };
  const plainP = (p) => (typeof p === 'string' ? p : p.text);
  // sections: [{ heading, steps: [{ title, tone: 'applies'|'maybe'|'pending', pills: [], reason, agency, meaning, needTitle, need: [], stepsTitle, steps: [], link: {label,url}, noLink, source }] }]
  // Used for a plan: one card per step, the same content as My business.
  const toneColor = { applies: '#1f9d6d', maybe: '#d99e1e', pending: '#96a0ac' };
  const pillStyle = { applies: 'background:#dff3e6;color:#17603a', maybe: 'background:#fff1cf;color:#7a5200', pending: 'background:#e6e9ee;color:#46505f', checked: 'background:#e0f0f0;color:#0e6a73' };
  const stepHtml = (st) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;border:1px solid #dbe3ec;border-left:5px solid ${toneColor[st.tone] || toneColor.maybe};border-radius:10px"><tr><td style="padding:14px 16px">
${(st.pills || []).map((p) => `<span style="display:inline-block;margin:0 6px 8px 0;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;${pillStyle[p.kind] || pillStyle.pending}">${esc(p.text)}</span>`).join('')}
<div style="font-size:16px;font-weight:700;color:${NAVY};line-height:1.35;margin:0 0 6px">${esc(st.title)}</div>
${st.reason ? `<div style="font-size:14px;line-height:1.5;margin:0 0 8px">${esc(st.reason)}</div>` : ''}
${st.agency ? `<div style="font-size:13px;color:#5a6b7d;margin:0 0 8px">${esc(st.agencyLabel || 'Agency')}: ${esc(st.agency)}</div>` : ''}
${st.meaning ? `<div style="font-size:13px;line-height:1.5;margin:0 0 8px"><strong style="color:${NAVY}">${esc(st.meaningTitle || '')}</strong><br>${esc(st.meaning)}</div>` : ''}
${st.need?.length ? `<div style="font-size:13px;margin:0 0 8px"><strong style="color:${NAVY}">${esc(st.needTitle || '')}</strong><ul style="margin:4px 0 0;padding-left:20px;line-height:1.5">${st.need.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
${st.steps?.length ? `<div style="font-size:13px;margin:0 0 8px"><strong style="color:${NAVY}">${esc(st.stepsTitle || '')}</strong><ol style="margin:4px 0 0;padding-left:20px;line-height:1.5">${st.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
${safeUrl(st.link?.url) ? `<a href="${esc(st.link.url)}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:9px 16px;border-radius:8px;margin:2px 0 8px">${esc(st.link.label)}</a>` : st.noLink ? `<div style="font-size:13px;color:#5a6b7d;margin:0 0 8px">${esc(st.noLink)}</div>` : ''}
${st.source ? `<div style="font-size:12px;color:#7a8a9b;line-height:1.5">${esc(st.source)}${safeUrl(st.sourceUrl) ? `<br><a href="${esc(st.sourceUrl)}" style="color:#0e6a73">${esc(st.sourceUrl)}</a>` : ''}</div>` : ''}
</td></tr></table>`;
  const sectionsHtml = sections.map((sec) => `<tr><td style="padding:14px 28px 0"><div style="border-left:4px solid ${TEAL};padding:2px 0 2px 10px;margin:0 0 12px;font-size:18px;font-weight:700;color:${NAVY}">${esc(sec.heading)}</div>${sec.steps.map(stepHtml).join('')}</td></tr>`).join('\n');
  const sectionsText = sections.flatMap((sec) => [`== ${sec.heading} ==`, '', ...sec.steps.flatMap((st, n) => [
    `${n + 1}. ${st.title}${st.pills?.length ? ` [${st.pills.map((p) => p.text).join(', ')}]` : ''}`,
    ...(st.reason ? [`   ${st.reason}`] : []),
    ...(st.agency ? [`   ${st.agencyLabel || 'Agency'}: ${st.agency}`] : []),
    ...(st.meaning ? [`   ${st.meaningTitle || ''}: ${st.meaning}`] : []),
    ...(st.need?.length ? [`   ${st.needTitle || ''}:`, ...st.need.map((x) => `    - ${x}`)] : []),
    ...(st.steps?.length ? [`   ${st.stepsTitle || ''}:`, ...st.steps.map((x, i) => `    ${i + 1}) ${x}`)] : []),
    ...(safeUrl(st.link?.url) ? [`   ${st.link.label}: ${st.link.url}`] : st.noLink ? [`   ${st.noLink}`] : []),
    ...(st.source ? [`   ${st.source}${safeUrl(st.sourceUrl) ? ` ${st.sourceUrl}` : ''}`] : []),
    '',
  ])]);
  const url = button ? safeUrl(button.url) : '';

  const text = [
    heading,
    '',
    ...paragraphs.map(plainP).flatMap((p) => [p, '']),
    ...(facts.length ? [...facts.map((f) => `${f.label}: ${f.value}`), ''] : []),
    ...sectionsText,
    ...(button && url ? [`${button.label}: ${url}`, ''] : []),
    ...(note ? [note, ''] : []),
    ...(footer ? [footer] : []),
    ...footerLinks.filter((l) => safeUrl(l.url)).map((l) => `${l.label}: ${l.url}`),
    '',
    BRAND,
  ].join('\n').replace(/\n{3,}/g, '\n\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d2b3a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${NAVY};padding:20px 28px;color:#ffffff;font-size:16px;font-weight:600;letter-spacing:.2px">${esc(BRAND)}</td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0;font-size:22px;line-height:1.3;color:${NAVY}">${esc(heading)}</h1></td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.6">
${paragraphs.map((p) => `<p style="margin:0 0 14px">${boldify(p)}</p>`).join('\n')}
</td></tr>
${facts.length ? `<tr><td style="padding:4px 28px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dbe3ec;border-radius:10px;background:#f7f9fc">
${facts.map((f, i) => `<tr><td style="padding:10px 14px;font-size:13px;color:#5a6b7d;width:38%;${i ? 'border-top:1px solid #dbe3ec;' : ''}vertical-align:top">${esc(f.label)}</td><td style="padding:10px 14px;font-size:14px;font-weight:600;color:${NAVY};${i ? 'border-top:1px solid #dbe3ec;' : ''}vertical-align:top">${esc(f.value)}</td></tr>`).join('\n')}
</table></td></tr>` : ''}
${sectionsHtml}
${button && url ? `<tr><td style="padding:18px 28px 6px"><a href="${esc(url)}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${esc(button.label)}</a></td></tr>` : ''}
${note ? `<tr><td style="padding:10px 28px 0;font-size:13px;line-height:1.5;color:#5a6b7d">${esc(note)}</td></tr>` : ''}
<tr><td style="padding:22px 28px 26px;font-size:12px;line-height:1.6;color:#7a8a9b">
${footer ? `<p style="margin:0 0 6px">${esc(footer)}</p>` : ''}
${footerLinks.filter((l) => safeUrl(l.url)).map((l) => `<a href="${esc(l.url)}" style="color:#5a6b7d">${esc(l.label)}</a>`).join(' &nbsp;|&nbsp; ')}
</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

// The small page opened from a link in an email (confirm or stop). Plain HTML, no scripts.
export function renderMessagePage(title, message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#eef2f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d2b3a">
<div style="max-width:32rem;margin:3rem auto;padding:0 1rem"><div style="background:#fff;border-radius:14px;overflow:hidden">
<div style="background:${NAVY};color:#fff;padding:18px 24px;font-weight:600">${esc(BRAND)}</div>
<div style="padding:24px"><h1 style="margin:0 0 10px;font-size:22px;color:${NAVY}">${esc(title)}</h1><p style="margin:0;line-height:1.6">${esc(message)}</p></div>
</div></div></body></html>`;
}

export const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
