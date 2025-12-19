import { render, screen, fireEvent } from '@testing-library/react';
import SnoozedList from './SnoozedList';
import { describe, it, expect, vi } from 'vitest';

describe('SnoozedList', () => {
  const mockSnoozedTabs = {
    '1704100000000': [ // Some timestamp
      {
        url: 'https://example.com',
        title: 'Example Tab',
        favicon: '',
        creationTime: 123,
        popTime: 1704100000000
      }
    ],
    tabCount: 1
  };

  it('renders snoozed items correctly', () => {
    render(
      <SnoozedList
        snoozedTabs={mockSnoozedTabs}
      />
    );
    expect(screen.getByText('Example Tab')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('calls onClearTab when delete button is clicked', () => {
    const handleClearTab = vi.fn();
    render(
      <SnoozedList
        snoozedTabs={mockSnoozedTabs}
        onClearTab={handleClearTab}
      />
    );

    // Find delete button - usually found by icon or aria-label if present.
    // In SnoozedList.jsx, Button has Lucide Trash2 icon but no aria-label explicit in recent view?
    // Let's look closely at SnoozedList.jsx again or use getAllByRole('button')
    // The button has className="h-8 w-8 ..."

    // Better: add aria-label to component or use container query?
    // For now, let's try getting by button role. There's only one item, so one delete button (plus window delete buttons if groups)
    const buttons = screen.getAllByRole('button');
    // Expect at least one delete button.
    const deleteBtn = buttons[0];

    fireEvent.click(deleteBtn);

    expect(handleClearTab).toHaveBeenCalledTimes(1);
    expect(handleClearTab).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Example Tab'
    }));
  });

  it('renders "No snoozed tabs" when empty', () => {
    render(<SnoozedList snoozedTabs={{}} />);
    expect(screen.getByText('No snoozed tabs.')).toBeInTheDocument();
  });
});
