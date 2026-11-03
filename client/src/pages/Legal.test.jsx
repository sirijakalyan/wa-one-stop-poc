import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <AppProvider><App /></AppProvider>
  </MemoryRouter>,
);

describe('Terms and Privacy pages', () => {
  it('the terms page opens without signing in', async () => {
    renderAt('/terms');
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });
  it('the privacy page says what is kept and that typed questions may go to an AI service', async () => {
    renderAt('/privacy');
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
    expect(screen.getByText(/may be sent to an AI service/)).toBeInTheDocument();
  });
  it('each page sets its own title', async () => {
    renderAt('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' });
    expect(document.title).toMatch(/^Privacy policy \|/);
  });
  it('the footer links to both pages', async () => {
    renderAt('/terms');
    await screen.findByRole('heading', { level: 1, name: 'Terms of use' });
    expect(screen.getAllByRole('link', { name: 'Privacy policy' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Terms of use' }).length).toBeGreaterThan(0);
  });
});
