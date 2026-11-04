import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashRenewals } from './Dashboard.jsx';

const data = {
  label: 'Cafe',
  items: [
    { id: 'dor', title: 'Apply for your license', agency: 'Dept. of Revenue (BLS)', renewal: '2027-03-31', apply: { url: 'https://secure.dor.wa.gov/x' } },
    { id: 'esd', title: 'Employer taxes', agency: 'Employment Security Dept.', renewal: '' },
  ],
};

describe('calendar buttons on renewal dates', () => {
  it('offers calendar buttons only for a step with a date, and asks for a date otherwise', () => {
    render(<DashRenewals data={data} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /Download a calendar file for Apply for your license/ })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Add Apply for your license to Google Calendar/ });
    expect(link.getAttribute('href')).toContain('https://calendar.google.com/calendar/render');
    expect(link.getAttribute('href')).toContain('dates=20270331%2F20270401');
    expect(screen.queryByRole('button', { name: /calendar file for Employer taxes/ })).toBeNull();
    expect(screen.getByText('Enter a date first')).toBeInTheDocument();
  });
  it('downloads one file for all dated renewals', async () => {
    const created = [];
    globalThis.URL.createObjectURL = vi.fn((b) => { created.push(b); return 'blob:x'; });
    globalThis.URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DashRenewals data={data} onSave={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add all to my calendar (.ics file)' }));
    expect(created).toHaveLength(1);
    expect(click).toHaveBeenCalled();
    const text = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(created[0]); });
    click.mockRestore();
    expect(text).toContain('DTSTART;VALUE=DATE:20270331');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(text).toContain('Renewal due: Apply for your license');
  });
  it('disables "Add all" when no date is set', () => {
    render(<DashRenewals data={{ ...data, items: data.items.map((i) => ({ ...i, renewal: '' })) }} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add all to my calendar (.ics file)' })).toBeDisabled();
  });
});
