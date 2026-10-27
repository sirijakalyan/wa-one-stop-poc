import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notifications from './Notifications.jsx';
import { api } from '../api.js';

vi.mock('../api.js', async (orig) => {
  const real = await orig();
  return { ...real, api: { ...real.api, notifications: vi.fn(), setEmailOptIn: vi.fn(), renewalReminder: vi.fn(), markRead: vi.fn() } };
});

beforeEach(() => vi.clearAllMocks());

describe('Notifications email reminders', () => {
  it('keeps the simulated checkbox when the server has no mailer', async () => {
    api.notifications.mockResolvedValue({ notifications: [], emailOptIn: false, emailMode: 'off' });
    render(<Notifications />);
    expect(await screen.findByText(/Email me when something changes \(simulated\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Email me renewal reminders/)).toBeNull();
  });

  it('asks for an email and sends a confirmation when a mailer exists', async () => {
    api.notifications.mockResolvedValue({ notifications: [], emailOptIn: false, emailMode: 'live', email: '', emailConfirmed: false });
    api.setEmailOptIn.mockResolvedValue({ ok: true, note: 'Check your inbox and click the confirm link.' });
    render(<Notifications />);
    await userEvent.type(await screen.findByLabelText(/Email me renewal reminders/), 'owner@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send confirmation' }));
    await waitFor(() => expect(api.setEmailOptIn).toHaveBeenCalledWith(true, 'owner@example.com'));
    expect(await screen.findByText(/Check your inbox/)).toBeInTheDocument();
  });

  it('shows pending confirmation and lets the visitor remove their address', async () => {
    api.notifications.mockResolvedValue({ notifications: [], emailOptIn: true, emailMode: 'live', email: 'owner@example.com', emailConfirmed: false });
    api.setEmailOptIn.mockResolvedValue({ ok: true });
    render(<Notifications />);
    expect(await screen.findByText(/Waiting for your confirmation/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Turn off and remove my email/ }));
    await waitFor(() => expect(api.setEmailOptIn).toHaveBeenCalledWith(false));
  });
});
