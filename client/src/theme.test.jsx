import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTheme } from './theme.js';

function Probe() {
  const { theme, choose } = useTheme();
  return (<div><span data-testid="t">{theme}</span><button onClick={() => choose('dark')}>dark</button><button onClick={() => choose('light')}>light</button></div>);
}

describe('theme choice', () => {
  beforeEach(() => { document.documentElement.setAttribute('data-theme', 'light'); localStorage.clear(); });
  it('sets the attribute and remembers the choice', () => {
    render(<Probe />);
    fireEvent.click(screen.getByText('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('wa-theme')).toBe('dark');
    fireEvent.click(screen.getByText('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('wa-theme')).toBe('light');
  });
});
