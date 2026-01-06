import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeSettings from './TimeSettings';

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => {
    if (onValueChange) onValueChange(value);
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
}));

describe('TimeSettings', () => {
  it('renders start and end day selectors', () => {
    const settings = {};
    const updateSetting = vi.fn();
    render(<TimeSettings settings={settings} updateSetting={updateSetting} />);

    expect(screen.getByText('Start Day (Morning)')).toBeInTheDocument();
    expect(screen.getByText('End Day (Evening)')).toBeInTheDocument();
  });

  it('displays current settings values', () => {
    const settings = {
        'start-day': '9:00 AM',
        'end-day': '6:00 PM'
    };
    const updateSetting = vi.fn();
    // We look for the trigger buttons reacting to value
    render(<TimeSettings settings={settings} updateSetting={updateSetting} />);

    // Radix Select trigger usually contains the value text
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('6:00 PM')).toBeInTheDocument();
  });

  it('falls back to defaults if settings are empty', () => {
    const settings = {}; // Defaults: 8:00 AM, 5:00 PM
    const updateSetting = vi.fn();
    render(<TimeSettings settings={settings} updateSetting={updateSetting} />);

    expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('5:00 PM')).toBeInTheDocument();
  });

  it('calls updateSetting for both start and end selections', () => {
    const settings = { 'start-day': '9:00 AM', 'end-day': '6:00 PM' };
    const updateSetting = vi.fn();
    render(<TimeSettings settings={settings} updateSetting={updateSetting} />);

    expect(updateSetting).toHaveBeenCalledWith('start-day', '9:00 AM');
    expect(updateSetting).toHaveBeenCalledWith('end-day', '6:00 PM');
  });
});
