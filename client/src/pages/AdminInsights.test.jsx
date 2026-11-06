import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LangContext } from '../i18n.js';
import { api } from '../api.js';
import AdminInsights from './AdminInsights.jsx';

const report = {
  ok: true, days: 30, since: '2026-10-08', minGroup: 5,
  kpis: [
    { id: 'time', value: 4.3, unit: 'min', target: 10, goal: 'under', n: 12 },
    { id: 'finished', value: 50, unit: '%', target: 60, goal: 'atleast', n: 12 },
    { id: 'clear', value: null, unit: '%', target: 80, goal: 'atleast', n: null },
    { id: 'sources', value: 100, unit: '%', target: 100, goal: 'atleast', n: 10 },
    { id: 'done', value: null, unit: '%', target: 40, goal: 'atleast', n: null },
  ],
  funnel: { started: 12, shown: 6, saved: null },
  saved: { device: null, link: null, account: null },
  feedback: { yes: null, partly: null, no: null, total: null, reasons: {} },
  modes: { voice: null, typing: 9, form: null, sample: null }, langs: { en: 12, es: null },
  dropoff: [{ id: 'salestax', answered: 7, left: 5, total: 12 }], steps: [], voiceBlocked: { denied: null, unsupported: null }, daily: [],
};

describe('admin Insights', () => {
  it('shows the five measures with targets, hides small groups, and explains how numbers are collected', async () => {
    vi.spyOn(api, 'adminInsights').mockResolvedValue(report);
    render(<LangContext.Provider value={{ lang: 'en', setLang: () => {} }}><AdminInsights /></LangContext.Provider>);
    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByText('Time from first message to a plan')).toBeInTheDocument();
    expect(screen.getByText(/Target: under 10 min \[est\.\]/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not enough data yet \(fewer than 5\)/).length).toBe(2);
    expect(screen.getAllByText('fewer than 5').length).toBeGreaterThan(3);
    expect(screen.getByText('Sales tax')).toBeInTheDocument();
    expect(screen.getByText('How these numbers are collected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('exports a readable CSV (Group, Measure, Result, Note) in the chosen language', async () => {
    vi.spyOn(api, 'adminInsights').mockResolvedValue(report);
    let text = '';
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = class { constructor(parts) { text = parts.join(''); } };
    URL.createObjectURL = () => 'blob:x'; URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<LangContext.Provider value={{ lang: 'es', setLang: () => {} }}><AdminInsights /></LangContext.Provider>);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Exportar CSV' }));
    globalThis.Blob = OrigBlob;
    const lines = text.replace('\ufeff', '').split('\r\n');
    expect(lines[0]).toBe('"Grupo","Medida","Resultado","Nota"');
    expect(text).toContain('"Medidas clave"');
    expect(text).toContain('Meta: menos de 10 min [est.]');
    expect(text).not.toMatch(/"kpi"|"funnel"|"section"/);
  });
});
