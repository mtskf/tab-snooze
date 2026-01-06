import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SnoozeActionSettings from './SnoozeActionSettings';
import { DEFAULT_SHORTCUTS } from '@/utils/constants';

declare const global: typeof globalThis & {
  confirm: ReturnType<typeof vi.fn>;
};

// Mock ShortcutEditor since it's a complex child component
vi.mock('./ShortcutEditor', () => ({
  default: ({ shortcuts, onUpdate }: { shortcuts: Record<string, string[]>; onUpdate: (shortcuts: Record<string, string[]>) => void }) => (
    <div data-testid="shortcut-editor">
      ShortcutEditor Mock
      <button onClick={() => onUpdate({ ...shortcuts, 'test': ['modified'] })}>
        Modify Shortcut
      </button>
    </div>
  )
}));

describe('SnoozeActionSettings', () => {
  it('renders header and reset button', () => {
    const settings = { shortcuts: {} };
    const updateSetting = vi.fn();
    render(<SnoozeActionSettings settings={settings} updateSetting={updateSetting} />);

    expect(screen.getByText('Snooze Actions')).toBeInTheDocument();
    expect(screen.getByText('Reset default')).toBeInTheDocument();
  });

  it('renders ShortcutEditor child', () => {
    const settings = { shortcuts: {} };
    const updateSetting = vi.fn();
    render(<SnoozeActionSettings settings={settings} updateSetting={updateSetting} />);

    expect(screen.getByTestId('shortcut-editor')).toBeInTheDocument();
  });

  it('calls updateSetting with defaults when reset is confirmed', () => {
    const settings = { shortcuts: { 'test': ['custom'] } };
    const updateSetting = vi.fn();
    global.confirm = vi.fn(() => true);

    render(<SnoozeActionSettings settings={settings} updateSetting={updateSetting} />);

    fireEvent.click(screen.getByText('Reset default'));

    expect(global.confirm).toHaveBeenCalled();
    expect(updateSetting).toHaveBeenCalledWith('shortcuts', DEFAULT_SHORTCUTS);
  });

  it('does not call updateSetting when reset is cancelled', () => {
    const settings = { shortcuts: {} };
    const updateSetting = vi.fn();
    global.confirm = vi.fn(() => false);

    render(<SnoozeActionSettings settings={settings} updateSetting={updateSetting} />);

    fireEvent.click(screen.getByText('Reset default'));

    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('correctly passes updates from ShortcutEditor', () => {
      const settings = { shortcuts: {} };
      const updateSetting = vi.fn();
      render(<SnoozeActionSettings settings={settings} updateSetting={updateSetting} />);

      // Trigger the mock button inside ShortcutEditor
      fireEvent.click(screen.getByText('Modify Shortcut'));

      expect(updateSetting).toHaveBeenCalledWith('shortcuts', expect.objectContaining({ 'test': ['modified'] }));
  });
});
