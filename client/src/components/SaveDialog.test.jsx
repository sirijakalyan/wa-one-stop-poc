import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LangContext } from '../i18n.js';
import { api } from '../api.js';
import SaveDialog from './SaveDialog.jsx';

const props = (over = {}) => ({ items: [{ id: 'a', title: 'Form your business', agency: 'Secretary of State' }], label: 'Food truck', answers: { structure: 'llc' }, user: null, busy: false, error: '', onClose: vi.fn(), onDevice: vi.fn(), onAccount: vi.fn(), ...over });
const show = (p, lang = 'en') => render(<LangContext.Provider value={{ lang, setLang: () => {} }}><SaveDialog {...p} /></LangContext.Provider>);

describe('Keep your plan', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('offers save on this device, email me a link and create an account, and each one does its job', async () => {
    const user = userEvent.setup();
    const p = props();
    show(p);
    expect(screen.getByRole('dialog', { name: 'Keep your plan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save on this device/ }));
    expect(p.onDevice).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Create an account/ }));
    expect(p.onAccount).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeEnabled();
  });

  it('emails the steps and a link, and says where it went', async () => {
    const user = userEvent.setup();
    const send = vi.spyOn(api, 'emailPlan').mockResolvedValue({ ok: true, sent: true, live: true, hasLink: true });
    show(props());
    await user.click(screen.getByRole('button', { name: /Email me a link/ }));
    await user.type(screen.getByLabelText('Your email'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send my link' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com', label: 'Food truck', answers: { structure: 'llc' } }));
    expect(await screen.findByText(/We sent your steps and a link to owner@example.com/)).toBeInTheDocument();
  });

  it('shows the reason when the email cannot be sent', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'emailPlan').mockRejectedValue(new Error('Enter an email address like name@example.com.'));
    show(props());
    await user.click(screen.getByRole('button', { name: /Email me a link/ }));
    await user.type(screen.getByLabelText('Your email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Send my link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an email address');
  });

  it('hides Create an account for a signed-in owner, closes on Escape, and speaks Spanish', async () => {
    const user = userEvent.setup();
    const p = props({ user: { email: 'a@b.co' } });
    show(p, 'es');
    expect(screen.getByRole('dialog', { name: 'Guarde su plan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear una cuenta/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(p.onClose).toHaveBeenCalled();
  });
});
