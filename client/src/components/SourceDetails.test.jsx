import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceDetails from './SourceDetails.jsx';

const rule = {
  source: { label: 'DOR, Open a business', url: 'https://dor.wa.gov/open-business' },
  supports: 'Wizard returns licenses.', limits: '', owner: '[NEEDS HUMAN INPUT: content owner]', reviewer: null,
  verification: { status: 'pending', note: 'Not reviewed.' }, lastVerified: null,
};

describe('SourceDetails', () => {
  it('shows title, URL, support, status, date, owner and reviewer placeholder', () => {
    render(<SourceDetails rule={rule} />);
    expect(screen.getByText('DOR, Open a business')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dor\.wa\.gov\/open-business/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Wizard returns licenses.')).toBeInTheDocument();
    expect(screen.getByText(/Pending verification/)).toBeInTheDocument();
    expect(screen.getByText('Not yet verified')).toBeInTheDocument();
    expect(screen.getByText(/NEEDS HUMAN INPUT: second-person reviewer/)).toBeInTheDocument();
  });
});

describe('SourceDetails content', () => {
  it('holds provenance only and does not repeat conditions or limits', () => {
    render(<SourceDetails rule={{ ...rule, limits: 'Some condition text.' }} />);
    expect(screen.queryByText('Some condition text.')).not.toBeInTheDocument();
    for (const label of ['Source title', 'Official URL', 'What it supports', 'Last verified', 'Status', 'Approval', 'Owner', 'Reviewer']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
