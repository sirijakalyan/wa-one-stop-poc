import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './AppContext.jsx';
import { ROUTES } from './routes.js';

// A tiny fake of the demo server so screens render without it.
const SAMPLE = {
  id: 'restaurant', title: 'Restaurant', blurb: 'An LLC with employees.',
  answers: { structure: 'llc', desc: '', cats: ['food'], city: '', hiring: 'yes', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'yes' },
};
const RULE = {
  id: 'dor', title: 'Apply for your Washington business license', agency: 'Dept. of Revenue (BLS)', phase: 2,
  source: { label: 'DOR', url: 'https://dor.wa.gov/' }, apply: null, verification: { status: 'checked' },
  lastVerified: '2026-10-26', version: 1, draft: null, owner: 'x', reviewer: null,
};
function fakeFetch(url, opts = {}) {
  const method = opts.method || 'GET';
  const json = (data, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve({ ok, ...data }) });
  if (url === '/api/samples') return json({ samples: [SAMPLE] });
  if (url === '/api/rules') return json({ rules: [RULE], phases: { 2: 'License your business' } });
  if (url === '/api/changes') return json({ changes: [] });
  if (url === '/api/notifications') return json({ notifications: [], emailOptIn: false });
  if (url === '/api/dashboard') return json({ saved: false, unread: 0 });
  if (url === '/api/checklist' && method === 'GET') return json({ saved: false });
  if (url === '/api/suggest') return json({ categories: ['food'] });
  if (url === '/api/checklist' && method === 'POST') return json({ saved: true });
  return json({});
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  window.scrollTo = vi.fn();
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}

describe('page footer guidance', () => {
  const paths = [...ROUTES.map((r) => r.path), '/this-page-does-not-exist'];

  it.each(paths)('shows the full demo disclaimer in the footer on %s, with no demo banner', (path) => {
    renderAt(path);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/confirm with the relevant agency/i);
    expect(screen.getByTestId('footer-disclaimer')).toHaveTextContent(
      'Demo only, not official guidance. Confirm with the relevant agency. Not legal advice. Not a live product.',
    );
    expect(screen.queryByTestId('demo-disclaimer')).toBeNull();
  });
});

describe('layout', () => {
  it('has a skip link, a main landmark and every screen in the navigation', async () => {
    renderAt('/');
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const r of ROUTES.filter((x) => x.nav !== false)) expect(nav).toHaveTextContent(r.label);
    // Admin is not in the owner navigation. It is reachable from the footer.
    expect(within(nav).queryByRole('link', { name: /Admin/ })).toBeNull();
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: /Admin rules/ })).toHaveAttribute('href', '/admin');
    await waitFor(() => expect(screen.getByText('Restaurant')).toBeInTheDocument());
  });

  it('shows the not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('questionnaire', () => {
  it('blocks Next until a structure is chosen, then moves on', async () => {
    const user = userEvent.setup();
    renderAt('/questionnaire');
    expect(screen.getByText(/Question 1 of/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose one option/i);
    await user.click(screen.getByLabelText(/Limited liability company/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Question 2 of/)).toBeInTheDocument();
  });

  it('still asks for the business type when the description is blank, with nothing preselected', async () => {
    const user = userEvent.setup();
    renderAt('/questionnaire');
    await user.click(screen.getByLabelText(/^Sole proprietor/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('What kind of business is this?')).toBeInTheDocument();
    expect(screen.getByText(/Only "Construction contracting" adds the Labor & Industries contractor registration step/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Construction contracting/)).not.toBeChecked();
    await user.click(screen.getByLabelText(/Construction contracting/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Which city and county will you work in?')).toBeInTheDocument();
  });

  it('explains that subcontractors do not make the business a construction contractor', async () => {
    const user = userEvent.setup();
    renderAt('/questionnaire');
    await user.click(screen.getByLabelText(/^LLC|^Limited liability company/));
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Next' })); // structure, desc, type, city
    await user.click(screen.getByLabelText('Yes')); // hiring
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Will you use subcontractors or independent contractors?')).toBeInTheDocument();
    expect(screen.getByText(/It does not make your business a construction contractor/)).toBeInTheDocument();
  });
});

describe('screens with no saved checklist', () => {
  it('old checklist and progress addresses open My business, which invites you to start', async () => {
    renderAt('/checklist');
    await waitFor(() => expect(screen.getByText(/appear here once you save a plan/i)).toBeInTheDocument());
  });
});

describe('old addresses still work', () => {
  it.each(['/dashboard', '/checklist'])('%s redirects to My business', async (path) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: /My business/ })).toBeInTheDocument();
  });
  it.each(['/guide', '/questionnaire', '/notifications', '/sources', '/admin'])('%s still opens', async (path) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('admin key gate', () => {
  it('asks for the key when the server requires one, and unlocks with a matching key', async () => {
    const user = userEvent.setup();
    let authorized = false;
    const base = fakeFetch;
    vi.stubGlobal('fetch', vi.fn((url, opts = {}) => {
      if (url === '/api/admin/status') {
        const sent = opts.headers?.['x-admin-key'];
        authorized = sent === 'right-key';
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, required: true, keyConfigured: true, authorized }) });
      }
      return base(url, opts);
    }));
    renderAt('/admin');
    expect(await screen.findByLabelText('Admin key')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
    await user.type(screen.getByLabelText('Admin key'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Unlock admin' }));
    expect(await screen.findByText(/That key did not match/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Admin key'));
    await user.type(screen.getByLabelText('Admin key'), 'right-key');
    await user.click(screen.getByRole('button', { name: 'Unlock admin' }));
    expect(await screen.findByRole('heading', { name: 'Rule desk' })).toBeInTheDocument();
    expect(screen.getByText(/Unlocked for this browser/)).toBeInTheDocument();
    sessionStorage.clear();
  });

  it('says admin is locked when the server has no key set', async () => {
    const base = fakeFetch;
    vi.stubGlobal('fetch', vi.fn((url, opts = {}) => (url === '/api/admin/status'
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, required: true, keyConfigured: false, authorized: false }) })
      : base(url, opts))));
    renderAt('/admin');
    expect(await screen.findByText(/Admin is locked/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Admin key')).toBeNull();
  });
});

describe('visitor id', () => {
  it('sends the same anonymous id with every request and keeps it in localStorage', async () => {
    localStorage.removeItem('wa-visitor-id');
    renderAt('/');
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const id = localStorage.getItem('wa-visitor-id');
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    const ids = fetch.mock.calls.map(([, o]) => o?.headers?.['x-visitor-id']).filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set([id]));
  });
});
