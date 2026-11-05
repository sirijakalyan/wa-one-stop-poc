import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminReminders, { minusDays, hourLabel, pacificHour } from './AdminReminders.jsx';

const DATA = {
  ok: true, emailMode: 'live', history: [],
  config: { windows: [30, 14, 7, 1], sendHour: 9, timezone: 'America/Los_Angeles' },
  zones: [{ id: 'America/Los_Angeles', label: 'Pacific Time (Seattle)' }, { id: 'UTC', label: 'UTC' }],
};
const api = { saveReminderSettings: vi.fn(), testReminderEmail: vi.fn() };
vi.mock('../api.js', () => ({
  api: { reminderSettings: vi.fn(), saveReminderSettings: (...a) => api.saveReminderSettings(...a), testReminderEmail: (...a) => api.testReminderEmail(...a) },
  useLoad: () => ({ data: DATA, error: '', loading: false, reload: () => {} }),
}));

beforeEach(() => { api.saveReminderSettings.mockReset().mockResolvedValue({ ok: true }); api.testReminderEmail.mockReset().mockResolvedValue({ message: 'A test email was sent to a@b.c.' }); });

describe('admin email reminder schedule', () => {
  it('counts back from a date without shifting with time zones', () => {
    expect(minusDays('2027-03-31', 30).toISOString().slice(0, 10)).toBe('2027-03-01');
    expect(minusDays('2027-03-31', 1).toISOString().slice(0, 10)).toBe('2027-03-30');
    expect(hourLabel(0)).toBe('12:00 AM');
    expect(hourLabel(9)).toBe('9:00 AM');
    expect(hourLabel(13)).toBe('1:00 PM');
  });

  it('shows what a send time means on the clock in Washington (Pacific Time)', () => {
    const winter = new Date('2026-12-15T12:00:00Z');
    const summer = new Date('2026-07-15T12:00:00Z');
    expect(pacificHour(9, 'America/New_York', winter)).toBe(6);
    expect(pacificHour(9, 'America/Chicago', winter)).toBe(7);
    expect(pacificHour(9, 'America/Denver', winter)).toBe(8);
    expect(pacificHour(9, 'America/Los_Angeles', winter)).toBe(9);
    expect(pacificHour(9, 'America/New_York', summer)).toBe(6);
    expect(pacificHour(12, 'UTC', winter)).toBe(4);
    expect(pacificHour(12, 'UTC', summer)).toBe(5);
  });

  it('starts with 30, 14, 7 and 1 ticked, a preview of those dates, and Save off until something changes', () => {
    render(<AdminReminders />);
    for (const name of ['30 days away', '14 days away', '7 days away', '1 day away']) expect(screen.getByRole('checkbox', { name })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Same day' })).not.toBeChecked();
    expect(screen.getByText('Mar 1')).toBeInTheDocument();
    expect(screen.getByText('Mar 17')).toBeInTheDocument();
    expect(screen.getByText('Mar 24')).toBeInTheDocument();
    expect(screen.getByText('Mar 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled();
    expect(screen.queryByText(/Demo mode/)).toBeNull(); // no demo banner on this screen
  });

  it('ticking a day updates the preview and saves the sorted days, hour and zone', async () => {
    render(<AdminReminders />);
    fireEvent.click(screen.getByRole('checkbox', { name: '14 days away' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Same day' }));
    expect(screen.queryByText('Mar 17')).toBeNull();
    fireEvent.change(screen.getByLabelText('Send time'), { target: { value: '8' } });
    const save = screen.getByRole('button', { name: 'Save schedule' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(api.saveReminderSettings).toHaveBeenCalledWith({ windows: [30, 7, 1, 0], sendHour: 8, timezone: 'America/Los_Angeles' }));
    expect(await screen.findByText(/Saved\. Owners get reminders/)).toBeInTheDocument();
  });

  it('adds custom days, rejects a bad number, and cannot save with no days', () => {
    render(<AdminReminders />);
    fireEvent.click(screen.getByRole('button', { name: /Add custom days/ }));
    fireEvent.change(screen.getByLabelText('Days before renewal'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/0 to 365/);
    fireEvent.change(screen.getByLabelText('Days before renewal'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('checkbox', { name: '60 days away' })).toBeChecked();
    for (const n of ['60 days away', '30 days away', '14 days away', '7 days away', '1 day away']) fireEvent.click(screen.getByRole('checkbox', { name: n }));
    expect(screen.getByText('Choose at least one day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled();
  });

  it('sends a test email and shows what happened', async () => {
    render(<AdminReminders />);
    fireEvent.click(screen.getByRole('button', { name: 'Send me a test email' }));
    expect(await screen.findByText('A test email was sent to a@b.c.')).toBeInTheDocument();
  });
});
