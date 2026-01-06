import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Calendar } from './calendar';

describe('Calendar', () => {
  it('renders dropdown layout with custom classes and handles month changes', () => {
    const onMonthChange = vi.fn();
    const { container } = render(
      <Calendar
        mode="single"
        month={new Date(2024, 0, 1)}
        captionLayout="dropdown"
        fromYear={2024}
        toYear={2025}
        onMonthChange={onMonthChange}
        className="test-calendar"
        classNames={{ nav: 'custom-nav' }}
      />
    );

    expect(container.querySelector('.test-calendar')).toBeInTheDocument();

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThan(0);

    const monthSelect = comboboxes[0] as HTMLSelectElement;
    const optionValues = Array.from(monthSelect.options).map((o) => o.value);
    const nextValue = optionValues.find((value) => value !== monthSelect.value);

    fireEvent.change(monthSelect, { target: { value: nextValue } });
    expect(onMonthChange).toHaveBeenCalledWith(expect.any(Date));

    expect(screen.getAllByText(/January/i).length).toBeGreaterThan(0);
  });
});
