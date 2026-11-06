import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LangContext } from '../i18n.js';
import PlanFeedback from './PlanFeedback.jsx';

const show = (lang = 'en') => render(<LangContext.Provider value={{ lang, setLang: () => {} }}><PlanFeedback bizKey="t1" /></LangContext.Provider>);
const sent = () => globalThis.fetch.mock.calls.filter((c) => String(c[0]).includes('/api/insights/event')).map((c) => JSON.parse(c[1].body));

describe('Was this plan clear?', () => {
  beforeEach(() => { localStorage.clear(); globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ ok: true }) })); });

  it('counts a Yes straight away and asks only once', async () => {
    const user = userEvent.setup();
    const { unmount } = show();
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(sent()).toEqual([{ type: 'feedback', value: 'yes', reasons: [] }]);
    expect(screen.getByText(/Thank you/)).toBeInTheDocument();
    unmount();
    show();
    expect(screen.queryByText('Was this plan clear?')).not.toBeInTheDocument();
  });

  it('offers tap reasons for Partly, collects no typed text, and sends only the choices', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Partly' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Too long'));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(sent()).toEqual([{ type: 'feedback', value: 'partly', reasons: ['too_long'] }]);
  });

  it('is available in Spanish', () => {
    show('es');
    expect(screen.getByText('¿Fue claro este plan?')).toBeInTheDocument();
  });
});
