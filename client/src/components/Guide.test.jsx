import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ChecklistItem from './ChecklistItem.jsx';
import SourceDetails from './SourceDetails.jsx';
import Guide from './Guide.jsx';

const base = {
  id: 'dshs', status: 'applies', agency: 'DSHS', title: 'Report new hires to DSHS', reason: 'You plan to hire.', detail: '', done: false,
  source: { label: 'DSHS, New Hire Reporting', url: 'https://www.dshs.wa.gov/x' },
  apply: { label: 'Go to DSHS new hire reporting', url: 'https://www.dshs.wa.gov/x' }, fallback: 'Search dshs.wa.gov.',
  supports: 'DSHS states the window.', limits: '', owner: '[NEEDS HUMAN INPUT: content owner]', reviewer: null,
  verification: { status: 'checked', note: 'Read.' }, lastVerified: '2026-10-26',
  guide: {
    meaning: 'Employers report new hires.', who: ['Employers.'], conditions: ['Tribal exemption.'],
    prepare: ['Employee name.'], prepareNote: '', steps: [{ text: 'Gather info.' }, { text: 'File it.', external: true }],
    facts: [{ label: 'Deadline', text: '20 days.', asOf: '2026-10-26', status: 'verified', source: { label: 'DSHS, New Hire Reporting', url: 'https://www.dshs.wa.gov/x' } }], whyExternal: 'Reports are filed in DSHS DCS Online.',
  },
};

describe('Guide', () => {
  it('shows every section, the dated facts, and why the user leaves the site', () => {
    render(<Guide item={base} />);
    for (const h of ['What it means', 'Who it applies to', 'Conditions and exceptions', 'What to prepare', 'Steps', 'Amounts and timing stated by the agency']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText(/Checked 2026-10-26/)).toBeInTheDocument();
    expect(screen.getByText(/Why you leave this site/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Why it may apply to you' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Go to DSHS new hire reporting/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows a pending banner and no invented preparation for a pending rule', () => {
    const pending = { ...base, id: 'health', apply: null, guide: { ...base.guide, pending: true, pendingNote: 'County source not reviewed.', prepare: [], prepareNote: 'Not reviewed.', facts: [], steps: [{ text: 'Contact the county.' }] } };
    render(<Guide item={pending} />);
    expect(screen.getByRole('note')).toHaveTextContent('Not confirmed');
    expect(screen.getByText('Not reviewed.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is part of the checklist item', () => {
    const { container } = render(<ul><ChecklistItem item={base} /></ul>);
    expect(within(container.querySelector('li.item')).getByTestId('guide-dshs')).toBeInTheDocument();
  });
});

describe('Checked versus Approved', () => {
  it('a checked rule without a reviewer is not Approved', () => {
    render(<SourceDetails rule={base} />);
    expect(screen.getByText('Not yet Approved')).toBeInTheDocument();
    expect(screen.getByText(/NEEDS HUMAN INPUT: second-person reviewer/)).toBeInTheDocument();
  });
  it('shows Approved only when a reviewer is recorded', () => {
    render(<SourceDetails rule={{ ...base, reviewer: 'Demo reviewer' }} />);
    expect(screen.getByText('Approved by Demo reviewer')).toBeInTheDocument();
  });
});

describe('Needs verification facts', () => {
  it('flags an unverified figure and states estimates are not guaranteed', () => {
    const item = { ...base, guide: { ...base.guide, facts: [{ label: 'Other processing times', text: 'No estimate shown.', asOf: '2026-10-26', status: 'needs-verification', source: { label: 'L&I, Register as a Contractor', url: 'https://lni.wa.gov/x' } }] } };
    render(<Guide item={item} />);
    expect(screen.getByText('Needs verification')).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed dates/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /L&I, Register as a Contractor/ })).toHaveAttribute('target', '_blank');
  });
});
