import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header.jsx';
import { AppProvider } from '../AppContext.jsx';

describe('Header', () => {
  it('shows only owner links, with a Menu button that opens and closes the list for phones', async () => {
    render(<MemoryRouter><AppProvider><Header /></AppProvider></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'My business', 'Sign in', 'Create account']);
    const btn = screen.getByRole('button', { name: /Menu/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: /Close/ })).toHaveAttribute('aria-expanded', 'true');
    expect(nav).toHaveClass('is-open');
    await userEvent.keyboard('{Escape}');
    expect(nav).not.toHaveClass('is-open');
  });
});
