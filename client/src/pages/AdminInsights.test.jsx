import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LangContext } from '../i18n.js';
import { api } from '../api.js';
import AdminInsights from './AdminInsights.jsx';

const report = {
  ok: true, days: 30, since: '2026-10-08', minGroup: 5,
  kpis: [
    { id: 'time', value: 4.3, unit: 'min', target: 'under 10', n: 12 },
    { id: 'finished', value: 50, unit: '%', target: '60 or more', n: 12 },
    { id: 'clear', value: null, unit: '%', target: '80 or more', n: null },
    { id: 'sources', value: 100, unit: '%', target: '100', n: 10 },
    { id: 'done', value: null, unit: '%', target: '40 or more', n: null },
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
});
