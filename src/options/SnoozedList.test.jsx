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

  it('renders grouped window tabs and handles restore/clear actions', () => {
    const onRestoreGroup = vi.fn();
    const onClearGroup = vi.fn();
    const onClearTab = vi.fn();
    const groupedTabs = {
      '1704100000000': [
        {
          url: 'https://example.com',
          title: 'Grouped Tab A',
          favicon: '',
          creationTime: 123,
          popTime: 1704100000000,
          groupId: 'g1',
        },
        {
          url: 'https://example.com/b',
          title: 'Grouped Tab B',
          favicon: '',
          creationTime: 124,
          popTime: 1704100000000,
          groupId: 'g1',
        },
      ],
      tabCount: 2,
    };

    render(
      <SnoozedList
        snoozedTabs={groupedTabs}
        onRestoreGroup={onRestoreGroup}
        onClearGroup={onClearGroup}
        onClearTab={onClearTab}
      />
    );

    const groupHeader = screen.getByText('Window Group');
    fireEvent.click(groupHeader);
    expect(onRestoreGroup).toHaveBeenCalledWith('g1');

    const buttons = screen.getAllByRole('button');
    const clearGroupButton = buttons.find((btn) =>
      btn.className.includes('h-8 w-8')
    );
    expect(clearGroupButton).toBeTruthy();
    fireEvent.click(clearGroupButton);
    expect(onClearGroup).toHaveBeenCalledWith('g1');

    fireEvent.click(screen.getByText('Grouped Tab A'));
    expect(onClearTab).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Grouped Tab A' })
    );
  });

  it('shows Unknown when tab URL is invalid', () => {
    const invalidTabs = {
      '1704100000000': [
        {
          url: 'not a url',
          title: 'Broken Tab',
          favicon: '',
          creationTime: 123,
          popTime: 1704100000000,
        },
      ],
      tabCount: 1,
    };

    render(<SnoozedList snoozedTabs={invalidTabs} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
