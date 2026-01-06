import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppearanceSettings from './AppearanceSettings';

describe('AppearanceSettings', () => {
  it('renders all appearance options', () => {
    const settings = { appearance: 'default' as const };
    const updateSetting = vi.fn();

    render(<AppearanceSettings settings={settings} updateSetting={updateSetting} />);

    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Vivid')).toBeInTheDocument();
    expect(screen.getByText('Warm Heatmap')).toBeInTheDocument();
  });

  it('highlights the current selection (default)', () => {
    const settings = { appearance: 'default' as const };
    const updateSetting = vi.fn();
    render(<AppearanceSettings settings={settings} updateSetting={updateSetting} />);

    const defaultBtn = screen.getByText('Default').closest('button');
    const vividBtn = screen.getByText('Vivid').closest('button');

    expect(defaultBtn).toHaveClass('border-primary'); // Active
    expect(vividBtn).not.toHaveClass('border-primary');
  });

  it('highlights the current selection (vivid)', () => {
    const settings = { appearance: 'vivid' as const };
    const updateSetting = vi.fn();
    render(<AppearanceSettings settings={settings} updateSetting={updateSetting} />);

    const vividBtn = screen.getByText('Vivid').closest('button');
    expect(vividBtn).toHaveClass('border-primary');
  });

  it('calls updateSetting when an option is clicked', () => {
    const settings = { appearance: 'default' as const };
    const updateSetting = vi.fn();
    render(<AppearanceSettings settings={settings} updateSetting={updateSetting} />);

    fireEvent.click(screen.getByText('Vivid').closest('button')!);
    expect(updateSetting).toHaveBeenCalledWith('appearance', 'vivid');

    fireEvent.click(screen.getByText('Warm Heatmap').closest('button')!);
    expect(updateSetting).toHaveBeenCalledWith('appearance', 'heatmap');
  });
});
