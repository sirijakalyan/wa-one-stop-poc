import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CityCombobox, { matchPlaces, countyForTypedCity } from './CityCombobox.jsx';

describe('matchPlaces', () => {
  it('needs at least 2 letters', () => {
    expect(matchPlaces('b')).toEqual([]);
    expect(matchPlaces('')).toEqual([]);
  });
  it('"bel" lists places starting with bel, including Bellevue and Bellingham', () => {
    const names = matchPlaces('bel').map((o) => o.name);
    expect(names).toContain('Bellevue');
    expect(names).toContain('Bellingham');
    expect(names.every((n) => n.toLowerCase().startsWith('bel'))).toBe(true);
  });
  it('gives the county with each place', () => {
    expect(matchPlaces('bellevue')[0]).toEqual({ name: 'Bellevue', county: 'King' });
    expect(matchPlaces('bellingham')[0]).toEqual({ name: 'Bellingham', county: 'Whatcom' });
    expect(matchPlaces('spokane').find((o) => o.name === 'Spokane').county).toBe('Spokane');
  });
  it('lists one option per county for a place that spans counties', () => {
    const b = matchPlaces('bothell').map((o) => `${o.name}/${o.county}`);
    expect(b).toEqual(['Bothell/King', 'Bothell/Snohomish']);
  });
  it('matches the start of a later word too, and is case-insensitive', () => {
    expect(matchPlaces('VERNON').map((o) => o.name)).toContain('Mount Vernon');
  });
  it('typed exact city fills county only when there is exactly one', () => {
    expect(countyForTypedCity('Bellevue')).toBe('King');
    expect(countyForTypedCity('bothell')).toBe('');
    expect(countyForTypedCity('Nowhereville')).toBe('');
  });
});

function Harness() {
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  return (
    <>
      <label htmlFor="c">City</label>
      <CityCombobox id="c" value={city} onChange={setCity} onPick={(o) => { setCity(o.name); setCounty(o.county); }} />
      <output data-testid="county">{county}</output>
    </>
  );
}

describe('CityCombobox', () => {
  it('typing "bel" shows suggestions and clicking Bellevue fills city and King county', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('City'), 'bel');
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Bellevue')).toBeInTheDocument();
    expect(within(list).getAllByText(/County$/).length).toBeGreaterThan(1);
    await user.click(within(list).getByText('Bellevue'));
    expect(screen.getByLabelText('City')).toHaveValue('Bellevue');
    expect(screen.getByTestId('county')).toHaveTextContent('King');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('works from the keyboard: arrow down, Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('City'), 'bellin');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('City')).toHaveValue('Bellingham');
    expect(screen.getByTestId('county')).toHaveTextContent('Whatcom');
  });
  it('Escape closes the list and a city with no match shows no list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('City'), 'bel{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.clear(screen.getByLabelText('City'));
    await user.type(screen.getByLabelText('City'), 'zzzz');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
