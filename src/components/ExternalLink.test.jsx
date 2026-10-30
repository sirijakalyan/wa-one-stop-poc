import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChecklistItem from './ChecklistItem.jsx';
import ExternalLink from './ExternalLink.jsx';

describe('ExternalLink', () => {
  it('opens in a new tab with noopener and noreferrer', () => {
    render(<ExternalLink href="https://dor.wa.gov/open-business">DOR</ExternalLink>);
    const a = screen.getByRole('link', { name: /DOR/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('rel')).toContain('noreferrer');
  });

  it('shows fallback text and the address when asked', () => {
    render(<ExternalLink href="https://x.wa.gov/a" fallback="Search for it." showFallback>Go</ExternalLink>);
    expect(screen.getByText(/Search for it\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
  });

  it('checklist item with no apply link shows the county message and no link button', () => {
    const item = { id: 'health', status: 'applies', agency: 'County', title: 'County permit', reason: 'r', detail: '', done: false,
      source: { label: 'State checklist', url: 'https://business.wa.gov/x' }, apply: null,
      noLink: 'Confirm which permits you need with your county health department.', verification: { status: 'checked' } };
    render(<ul><ChecklistItem item={item} /></ul>);
    expect(screen.getByText(/county health department/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Go to/ })).not.toBeInTheDocument();
  });
});
