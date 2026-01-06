import { render, screen, fireEvent } from '@testing-library/react';
import ShortcutEditor from './ShortcutEditor';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
  }
}));

// Mock constants if needed, but they are likely just objects.
// If SNOOZE_ACTIONS relies on chrome API, we might need to mock it,
// but based on typical patterns it's a static list.
// However, let's verify if SNOOZE_ACTIONS is imported from specific file.
// It is imported from '@/utils/constants'. Assuming it is pure JS/JSON.

describe('ShortcutEditor', () => {
  const mockShortcuts: Record<string, string[]> = {
    'later-today': ['L'],
    'tomorrow': ['T']
  };

  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders correctly', () => {
    render(
      <ShortcutEditor
        shortcuts={mockShortcuts}
        onUpdate={mockOnUpdate}
      />
    );

    // Check if inputs have correct values
    const inputs = screen.getAllByRole('textbox');
    // We expect input for 'later-today' to have 'L'
    // Value check might need specific finding logic if multiple inputs.
    // ShortcutEditor maps SNOOZE_ACTIONS. We need to know the order or label.
    // Let's assume labels are rendered.

    expect(screen.getByText('Later today')).toBeInTheDocument();

    // Find input associated with "Later today" row?
    // The Input does not have ID or LabelFor.
    // We can rely on display value.
    expect(screen.getByDisplayValue('L')).toBeInTheDocument();
    expect(screen.getByDisplayValue('T')).toBeInTheDocument();
  });

  it('updates shortcut on valid input', () => {
    render(<ShortcutEditor shortcuts={mockShortcuts} onUpdate={mockOnUpdate} />);

    // Try to change 'later-today' (L) to 'X'
    const inputL = screen.getByDisplayValue('L');
    fireEvent.change(inputL, { target: { value: 'X' } });

    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
        'later-today': ['X']
    }));
  });

  it('forces uppercase input', () => {
    render(<ShortcutEditor shortcuts={mockShortcuts} onUpdate={mockOnUpdate} />);

    const inputL = screen.getByDisplayValue('L');
    fireEvent.change(inputL, { target: { value: 'x' } });

    // Should be converted to 'X'
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
        'later-today': ['X']
    }));
  });

  it('validates duplicate shortcuts and shows warning', () => {
    render(<ShortcutEditor shortcuts={mockShortcuts} onUpdate={mockOnUpdate} />);

    // Try to change 'later-today' to 'T' (which duplicates 'tomorrow')
    const inputL = screen.getByDisplayValue('L');
    fireEvent.change(inputL, { target: { value: 'T' } });

    expect(toast.warning).toHaveBeenCalled();
    // Should NOT update
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('rejects non-ASCII characters', () => {
    render(<ShortcutEditor shortcuts={mockShortcuts} onUpdate={mockOnUpdate} />);

    const inputL = screen.getByDisplayValue('L');
    fireEvent.change(inputL, { target: { value: '©' } }); // Copyright symbol

    // Should result in empty string or ignored? Logic says: char = ""
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
        'later-today': []
    }));
  });
});
