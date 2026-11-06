// The plan as a PDF, laid out like the My business page: a navy banner, the five phases, and one card per step
// with its status labels, why it applies, the agency link, what to have ready, the steps and the source.
// Everything is built in the browser from the plan the server worked out. Nothing is uploaded.
const NAVY = [15, 42, 67];
const TEAL = [14, 124, 134];
const INK = [29, 43, 58];
const MUTED = [90, 107, 125];
const LINE = [211, 221, 231];
const PILL = {
  applies: { fill: [223, 243, 230], text: [23, 96, 58] },
  maybe: { fill: [255, 241, 207], text: [122, 82, 0] },
  pending: { fill: [230, 233, 238], text: [70, 80, 95] },
  checked: { fill: [224, 240, 240], text: [14, 106, 115] },
};
const BAR = { applies: [31, 157, 109], maybe: [217, 158, 30], pending: [150, 160, 172] };

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export async function buildPlanPdf({ data, label, t, today }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = W - 2 * M;
  let y = 0;

  const set = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color); };
  const wrap = (text, width, size, style = 'normal') => { set(size, style); return doc.splitTextToSize(clean(text), width); };

  // Banner on the first page.
  doc.setFillColor(...NAVY).rect(0, 0, W, 118, 'F');
  doc.setFillColor(...TEAL).rect(0, 118, W, 4, 'F');
  set(11, 'bold', [160, 215, 220]); doc.text(t('save.pdfBrand'), M, 40);
  set(24, 'bold', [255, 255, 255]);
  const titleRows = doc.splitTextToSize(label ? `${t('save.pdfTitle')}: ${label}` : t('save.pdfTitle'), CW);
  doc.text(titleRows.slice(0, 2), M, 70);
  set(11, 'normal', [205, 222, 235]);
  doc.text(`${data.items.length} ${data.items.length === 1 ? t('plan.step') : t('plan.steps')}  |  ${today}`, M, 70 + 22 * Math.min(2, titleRows.length) + 2);
  y = 146;

  // The owner's answers, as the chips on My business.
  const chips = Object.values(data.answerLabels || {}).filter(Boolean);
  if (chips.length) {
    let x = M;
    set(9.5, 'normal', INK);
    for (const c of chips) {
      const w = doc.getTextWidth(c) + 16;
      if (x + w > W - M) { x = M; y += 24; }
      doc.setDrawColor(...LINE).setFillColor(247, 249, 252).roundedRect(x, y - 12, w, 20, 10, 10, 'FD');
      set(9.5, 'normal', INK); doc.text(c, x + 8, y + 2);
      x += w + 6;
    }
    y += 26;
  }
  set(10, 'normal', MUTED);
  for (const r of wrap(t('save.pdfIntro'), CW, 10)) { doc.text(r, M, y); y += 14; }
  y += 8;

  const phases = Object.entries(data.phases || {});
  for (const [p, name] of phases) {
    const inPhase = data.items.filter((i) => String(i.phase) === p);
    if (!inPhase.length) continue;
    let headed = false; // the phase title is drawn with its first card, never alone at the bottom of a page

    for (const it of inPhase) {
      const pending = it.verification?.status === 'pending';
      const kind = pending ? 'pending' : it.status === 'applies' ? 'applies' : 'maybe';
      const inner = CW - 28;
      const blocks = [];
      const text = (str, size, style, color, gap = 3) => { const rows = wrap(str, inner, size, style); if (rows.length) blocks.push({ rows, size, style, color, gap, lh: size * 1.32 }); };
      const g = it.guide || {};
      text(it.title, 13, 'bold', NAVY, 4);
      if (pending) text(t('item.pendingNote'), 9.5, 'normal', [122, 82, 0], 5);
      text(it.reason, 10.5, 'normal', INK, 6);
      if (it.agency) text(`${t('save.pdfAgency')}: ${it.agency}`, 9.5, 'normal', MUTED, 6);
      const meaning = g.meaning || it.detail;
      if (meaning) { text(t('guide.means'), 10, 'bold', NAVY, 2); text(meaning, 10, 'normal', INK, 6); }
      const need = (g.prepare || []).map((x) => (typeof x === 'string' ? x : x?.text)).filter(Boolean);
      if (need.length) { text(t('item.need'), 10, 'bold', NAVY, 2); need.forEach((x) => text(`-  ${x}`, 10, 'normal', INK, 1)); blocks[blocks.length - 1].gap = 6; }
      const steps = (g.steps || []).map((s) => clean(s.text)).filter(Boolean);
      if (steps.length) { text(t('gstep.title'), 10, 'bold', NAVY, 2); steps.forEach((x, n) => text(`${n + 1}.  ${x}`, 10, 'normal', INK, 2)); blocks[blocks.length - 1].gap = 6; }
      const link = it.apply?.url ? { label: it.apply.label || t('src.openAgency'), url: it.apply.url } : null;
      if (!link) text(it.noLink || t('item.noLink'), 9.5, 'normal', MUTED, 6);
      const src = [it.source?.label, it.lastVerified ? `${t('src.last')}: ${it.lastVerified}` : ''].filter(Boolean).join('  |  ');
      const srcRows = src ? wrap(`${t('src.title')}: ${src}`, inner, 8.5) : [];
      const urlRows = it.source?.url ? doc.splitTextToSize(it.source.url, inner) : [];

      const bodyH = blocks.reduce((a, b) => a + b.rows.length * b.lh + b.gap, 0)
        + (link ? 24 : 0) + srcRows.length * 11.5 + urlRows.length * 11.5 + 30;
      const cardH = Math.min(bodyH, H - 2 * M - 10);
      if (y + cardH + (headed ? 0 : 40) > H - 46) { doc.addPage(); y = M; }
      if (!headed) {
        headed = true;
        doc.setFillColor(...TEAL).rect(M, y - 14, 4, 22, 'F');
        set(15, 'bold', NAVY); doc.text(clean(name), M + 12, y + 2);
        y += 26;
      }

      doc.setDrawColor(...LINE).setFillColor(255, 255, 255).roundedRect(M, y, CW, cardH, 8, 8, 'FD');
      doc.setFillColor(...BAR[kind]).roundedRect(M, y, 5, cardH, 2, 2, 'F');
      let cy = y + 20;
      // status labels
      let px = M + 16;
      const pill = (txt, k) => {
        set(8.5, 'bold', PILL[k].text);
        const w = doc.getTextWidth(txt) + 14;
        doc.setFillColor(...PILL[k].fill).roundedRect(px, cy - 10, w, 15, 7.5, 7.5, 'F');
        set(8.5, 'bold', PILL[k].text); doc.text(txt, px + 7, cy + 1);
        px += w + 6;
      };
      pill(pending ? t('pill.pending') : it.status === 'applies' ? t('pill.applies') : t('pill.maybe'), kind);
      if (it.verification?.status === 'checked') pill(`${t('pill.checked')}${it.lastVerified ? ` ${it.lastVerified}` : ''}`, 'checked');
      cy += 18;
      for (const b of blocks) {
        set(b.size, b.style, b.color);
        for (const r of b.rows) { doc.text(r, M + 16, cy); cy += b.lh; }
        cy += b.gap;
      }
      if (link) {
        set(10, 'bold', [255, 255, 255]);
        const bw = Math.min(inner, doc.getTextWidth(link.label) + 24);
        doc.setFillColor(...TEAL).roundedRect(M + 16, cy - 11, bw, 20, 6, 6, 'F');
        set(10, 'bold', [255, 255, 255]); doc.textWithLink(link.label, M + 28, cy + 3, { url: link.url });
        cy += 24;
      }
      if (srcRows.length) { set(8.5, 'normal', MUTED); srcRows.forEach((r) => { doc.text(r, M + 16, cy); cy += 11.5; }); }
      if (urlRows.length) { set(8.5, 'normal', TEAL); urlRows.forEach((r, n) => { n === 0 ? doc.textWithLink(r, M + 16, cy, { url: it.source.url }) : doc.text(r, M + 16, cy); cy += 11.5; }); }
      y += cardH + 12;
    }
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    set(8.5, 'normal', MUTED);
    doc.text(t('save.pdfFooter'), M, H - 24);
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: 'right' });
  }
  return doc;
}
