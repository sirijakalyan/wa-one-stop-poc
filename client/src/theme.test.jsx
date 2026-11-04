import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTheme } from './theme.js';

function Probe() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>{theme}</button>;
}

describe('theme toggle', () => {
  beforeEach(() => { document.documentElement.setAttribute('data-theme', 'light'); localStorage.clear(); });
  it('switches light to dark, sets the attribute and remembers it', () => {
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('wa-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('wa-theme')).toBe('light');
  });
});
