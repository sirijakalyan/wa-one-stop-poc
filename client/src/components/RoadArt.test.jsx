import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LangContext } from '../i18n.js';
import RoadArt from './RoadArt.jsx';

const show = (lang) => render(<LangContext.Provider value={{ lang, setLang: () => {} }}><RoadArt /></LangContext.Provider>);

describe('road to opening day', () => {
  it('lists the steps in order, ending at opening day', () => {
    show('en');
    const list = screen.getByRole('list', { name: 'Your road to opening day' });
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toHaveLength(5);
    expect(items[0]).toContain('Form your business');
    expect(items[1]).toContain('about 10 business days online');
    expect(items[2]).toContain('Permits for your industry');
    expect(items[3]).toContain('If you hire');
    expect(items[4]).toContain('Opening day');
  });

  it('is available in Spanish', () => {
    show('es');
    expect(screen.getByRole('list', { name: 'Su camino al día de apertura' })).toBeInTheDocument();
    expect(screen.getByText('Día de apertura')).toBeInTheDocument();
  });

  it('keeps the picture out of the reading order', () => {
    const { container } = show('en');
    expect(container.querySelector('svg.trail-svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
