import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistItem from './ChecklistItem.jsx';

const SRC = { label: 'DSHS, New Hire Reporting', url: 'https://www.dshs.wa.gov/x' };
const item = (over = {}) => ({
  id: 'dshs', status: 'applies', agency: 'DSHS', title: 'Report new hires to DSHS', reason: 'You plan to hire.',
  detail: 'Extra rule-record detail.', done: false, source: SRC,
  apply: { label: 'Go to DSHS new hire reporting', url: SRC.url }, fallback: 'Search dshs.wa.gov.',
  supports: 'DSHS states the window.', owner: '[NEEDS HUMAN INPUT: content owner]', reviewer: null,
  verification: { status: 'checked', note: 'Page read.' }, lastVerified: '2026-10-26',
  guide: { meaning: 'Employers report new hires.', who: ['Employers.'], conditions: [], prepare: [], prepareNote: 'n', steps: [{ text: 'File it.', external: true }], facts: [], whyExternal: 'Filed in DCS Online.' },
  ...over,
});
const pendingItem = () => item({
  id: 'health', title: 'Check for a county health department permit', agency: 'County', apply: null,
  noLink: 'The demo does not know your county.', source: { label: 'DOR, Open a business', url: 'https://dor.wa.gov/open-business' },
  verification: { status: 'pending', note: 'County source not reviewed.' }, lastVerified: null,
  guide: { meaning: 'Food businesses may need a permit.', who: ['Food service.'], conditions: [], prepare: [], prepareNote: 'n', steps: [{ text: 'Contact the county.' }], facts: [], whyExternal: '', pending: true, pendingNote: 'The county source has not been reviewed.' },
});
const renderItem = (it, onToggle) => render(<ul><ChecklistItem item={it} onToggle={onToggle} /></ul>);

describe('ChecklistItem card', () => {
  it('confirmed rule shows "Applies to you", one action button and the simulated tick box', () => {
    const { container } = renderItem(item(), () => {});
    const li = container.querySelector('li.item');
    expect(within(li).getByText('Applies to you')).toBeInTheDocument();
    expect(within(li).queryByText('Pending verification')).not.toBeInTheDocument();
    expect(within(li.querySelector('.item-actions')).getAllByRole('link', { name: /Go to DSHS new hire reporting/ })).toHaveLength(1);
    expect(within(li).getByLabelText('Mark as done')).toBeInTheDocument();
    expect(within(li).getByText(/Simulated\. Your own note\. Nothing is submitted/)).toBeInTheDocument();
  });

  it('pending rule shows "Pending verification" prominently and never "Applies to you"', () => {
    const { container } = renderItem(pendingItem(), () => {});
    const li = container.querySelector('li.item');
    expect(within(li).getByText('Pending verification', { selector: '.pill' })).toBeInTheDocument();
    expect(within(li).queryByText('Applies to you')).not.toBeInTheDocument();
    expect(within(li).getByText(/Not confirmed yet\. Check with the agency before you rely on it/)).toBeInTheDocument();
    expect(li.querySelector('.item-actions a')).toBeNull();
    expect(within(li).getByText(/does not know your county/)).toBeInTheDocument();
  });

  it('the card no longer repeats the source link, status line or reason inside the Guide', () => {
    const { container } = renderItem(item(), () => {});
    const li = container.querySelector('li.item');
    expect(li.querySelectorAll('.meta')).toHaveLength(0);
    expect(within(li).getAllByText('You plan to hire.')).toHaveLength(1);
    // One button on the card. The same address appears only inside Source details (start link and Official URL).
    expect(li.querySelectorAll(`.item-actions a[href="${SRC.url}"]`)).toHaveLength(1);
    expect(li.querySelectorAll(`.source-details a[href="${SRC.url}"]`)).toHaveLength(2);
    expect(li.querySelectorAll('.guide a')).toHaveLength(0);
  });

  it('default card is light: Guide and Source details stay closed and the agency, fallback text and URL are tucked inside', () => {
    const { container } = renderItem(item({ after: 'Apply for your license', reason: 'You plan to hire.' }), () => {});
    const li = container.querySelector('li.item');
    expect(li.querySelectorAll('details')).toHaveLength(2);
    for (const d of li.querySelectorAll('details')) expect(d.open).toBe(false);
    expect(li.querySelector('.pill.agency')).toBeNull();
    expect(li.querySelector('.item-actions .link-fallback')).toBeNull();
    expect(li.querySelector('.item-actions .link-url')).toBeNull();
    // nothing is deleted: the agency, the fallback help and the sequence hint are still in the card, inside the closed panels
    expect(li.querySelector('.source-details')).toHaveTextContent('DSHS');
    expect(li.querySelector('.source-details .link-fallback')).toHaveTextContent('Search dshs.wa.gov.');
    expect(li.querySelector('.guide')).toHaveTextContent('Comes after: Apply for your license');
  });

  it('a long reason is clamped with a Show more button and nothing is removed', async () => {
    const long = 'You need to register with the Department of Revenue if any one trigger is true. For you: you plan to hire within 90 days, you sell something that requires collecting sales tax, you expect gross income of $12,000 a year or more and you use a name other than your full legal name.';
    const { container } = renderItem(item({ reason: long }), () => {});
    const p = container.querySelector('p.why');
    expect(p).toHaveClass('clamp');
    expect(p).toHaveTextContent(long);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(p).not.toHaveClass('clamp');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('ticking Mark as done calls the handler and does not open any link', async () => {
    const onToggle = vi.fn();
    const { container } = renderItem(item(), onToggle);
    await userEvent.click(within(container).getByLabelText('Mark as done'));
    expect(onToggle).toHaveBeenCalledWith('dshs', true);
  });

  it('checked rule shows a "Source checked" badge with the date, distinct from "Applies to you", and never says approved', () => {
    const { container } = renderItem(item(), () => {});
    const li = container.querySelector('li.item');
    const badge = within(li).getByTestId('source-checked');
    expect(badge).toHaveTextContent('Source checked Oct 26, 2026');
    expect(badge).toHaveClass('source-checked');
    expect(badge).not.toHaveClass('applies');
    expect(within(li).getByText('Applies to you')).toBeInTheDocument();
    expect(badge.getAttribute('title')).toMatch(/not an agency approval/i);
    expect(badge).not.toHaveTextContent(/approved/i);
    expect(li).not.toHaveTextContent(/Approved by/); // no reviewer is recorded, so nothing claims human approval
  });

  it('the badge date does not shift with the time zone', () => {
    const { container } = renderItem(item({ lastVerified: '2026-01-01' }), () => {});
    expect(within(container).getByTestId('source-checked')).toHaveTextContent('Jan 1, 2026');
  });

  it('checked rule with no recorded date shows the badge without inventing a date', () => {
    const { container } = renderItem(item({ lastVerified: null }), () => {});
    expect(within(container).getByTestId('source-checked').textContent.trim()).toBe('Source checked');
  });

  it('pending rule never shows the "Source checked" badge', () => {
    const { container } = renderItem(pendingItem(), () => {});
    expect(within(container).queryByTestId('source-checked')).toBeNull();
    expect(container.textContent).not.toMatch(/Source checked/);
  });

  describe('county health page on the food permit step', () => {
    const withCounty = (countyHealth) => pendingItem_withCounty(countyHealth);
    function pendingItem_withCounty(countyHealth) {
      return { ...pendingItem(), countyHealth };
    }

    it('shows the found page as a link, labelled as not yet verified', () => {
      const { container } = renderItem(withCounty({
        state: 'found', county: 'King County', url: 'https://kingcounty.gov/x', agency: 'Public Health, Seattle & King County', note: '', searchedOn: '2026-10-27',
      }), () => {});
      const box = within(container).getByTestId('county-health');
      expect(within(box).getByRole('link', { name: /King County health department page/ })).toHaveAttribute('href', 'https://kingcounty.gov/x');
      expect(box).toHaveTextContent(/Found by search on Oct 27, 2026\. Not yet checked by a person/);
      expect(box).toHaveTextContent('Public Health, Seattle & King County');
      expect(container.querySelector('li.item')).toHaveTextContent('Pending verification'); // a found link does not remove the pending label
    });

    it('shows who checked a verified page', () => {
      const { container } = renderItem(withCounty({ state: 'verified', county: 'Mason County', url: 'https://example.gov/m', reviewedBy: 'A. Reviewer', reviewedAt: '2026-11-02' }), () => {});
      const box = within(container).getByTestId('county-health');
      expect(box).toHaveTextContent('Checked by A. Reviewer on Nov 2, 2026');
      expect(box).not.toHaveTextContent(/Not yet checked/);
    });

    it('says plainly when nothing was found, with no link', () => {
      const msg = 'We could not find an official health department page for Skagit County. Please contact the Skagit County health department directly.';
      const { container } = renderItem(withCounty({ state: 'not-found', county: 'Skagit County', message: msg }), () => {});
      const box = within(container).getByTestId('county-health');
      expect(box).toHaveTextContent(msg);
      expect(within(box).queryByRole('link')).toBeNull();
    });

    it('asks for a county when none was entered', () => {
      const { container } = renderItem(withCounty({ state: 'no-county', message: 'Add your county (use Edit answers) and we will look for its health department page.' }), () => {});
      expect(within(container).getByTestId('county-health')).toHaveTextContent(/Add your county/);
    });
  });

  it('shows an extra found-by-search link beside the rule link, labelled as not yet checked, and keeps the pending label', () => {
    const it = { ...pendingItem(), apply: { label: "See ESD's guide to employer taxes", url: 'https://esd.wa.gov/guide' },
      foundLinks: [{ label: 'ESD employer registration steps', url: 'https://www.esd.wa.gov/employer-taxes/register-your-business', agency: 'Employment Security Department', note: 'Lists the steps.', searchedOn: '2026-10-27' }] };
    const { container } = renderItem(it, () => {});
    const li = container.querySelector('li.item');
    expect(within(li.querySelector('.item-actions')).getByRole('link', { name: /See ESD's guide to employer taxes/ })).toHaveAttribute('href', 'https://esd.wa.gov/guide');
    const box = within(li).getByTestId('found-links');
    expect(within(box).getByRole('link', { name: /ESD employer registration steps/ })).toHaveAttribute('href', 'https://www.esd.wa.gov/employer-taxes/register-your-business');
    expect(box).toHaveTextContent(/Found by search on Oct 27, 2026\. Not yet checked by a person/);
    expect(within(li).getByText('Pending verification', { selector: '.pill' })).toBeInTheDocument();
  });

  it('shows no extra-link area when there are none', () => {
    const { container } = renderItem(item(), () => {});
    expect(within(container).queryByTestId('found-links')).toBeNull();
  });
});
