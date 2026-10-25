import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import PremiumSelect from './PremiumSelect';
import { findTypeaheadMatch } from '../../utils/typeahead';
import { CURRENCY_OPTIONS } from '../../constants/currencies';

describe('findTypeaheadMatch', () => {
  const labels = ['USD ($)', 'SAR (ر.س)', 'SEK (kr)', 'SGD (S$)', 'EUR (€)'];
  it('matches by prefix, case-insensitively', () => {
    expect(findTypeaheadMatch(labels, 'se', -1)).toBe(2);
    expect(findTypeaheadMatch(labels, 'SG', -1)).toBe(3);
    expect(findTypeaheadMatch(labels, 'eur', 0)).toBe(4);
  });
  it('cycles through items when the same letter repeats', () => {
    expect(findTypeaheadMatch(labels, 's', -1)).toBe(1);
    expect(findTypeaheadMatch(labels, 's', 1)).toBe(2);
    expect(findTypeaheadMatch(labels, 'ss', 2)).toBe(3);
    expect(findTypeaheadMatch(labels, 's', 3)).toBe(1); // wraps
  });
  it('returns -1 when nothing matches', () => {
    expect(findTypeaheadMatch(labels, 'zz', 0)).toBe(-1);
    expect(findTypeaheadMatch([], 'a', -1)).toBe(-1);
  });
});

describe('PremiumSelect keyboard', () => {
  afterEach(cleanup);

  const Harness = ({ onChange = () => {} }) => {
    const [value, setValue] = useState('USD');
    return (
      <PremiumSelect
        value={value}
        options={CURRENCY_OPTIONS}
        onChange={(v) => { setValue(v); onChange(v); }}
      />
    );
  };
  const trigger = () => screen.getByRole('combobox');
  const highlighted = () => {
    const id = trigger().getAttribute('aria-activedescendant');
    return id ? document.getElementById(id).textContent : null;
  };

  it('typing "S" then "E" jumps to SEK and Enter selects it', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 's' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(highlighted()).toBe('SEK (kr)'); // first "S…" in list order after USD
    fireEvent.keyDown(trigger(), { key: 'e' });
    expect(highlighted()).toBe('SEK (kr)');
    fireEvent.keyDown(trigger(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('SEK');
    expect(trigger().textContent).toContain('SEK (kr)');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('repeating a letter cycles through the options starting with it', () => {
    render(<Harness />);
    fireEvent.keyDown(trigger(), { key: 's' });
    expect(highlighted()).toBe('SEK (kr)');
    fireEvent.keyDown(trigger(), { key: 's' });
    expect(highlighted()).toBe('SGD (S$)');
    fireEvent.keyDown(trigger(), { key: 's' });
    expect(highlighted()).toBe('SAR (ر.س)');
  });

  it('typing works while the menu is already open (after a click)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: 'S' });
    fireEvent.keyDown(trigger(), { key: 'E' });
    fireEvent.keyDown(trigger(), { key: 'K' });
    expect(highlighted()).toBe('SEK (kr)');
    fireEvent.keyDown(trigger(), { key: ' ' }); // space after a word in progress just extends the search
    fireEvent.keyDown(trigger(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('SEK');
  });

  it('arrow keys, Home/End move the highlight; Escape closes without changing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' }); // opens on next item
    expect(highlighted()).toBe('EUR (€)');
    fireEvent.keyDown(trigger(), { key: 'End' });
    expect(highlighted()).toBe('YER (﷼)');
    fireEvent.keyDown(trigger(), { key: 'Home' });
    expect(highlighted()).toBe('USD ($)');
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('mouse selection still works', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'PHP (₱)' }));
    expect(onChange).toHaveBeenLastCalledWith('PHP');
  });
});
