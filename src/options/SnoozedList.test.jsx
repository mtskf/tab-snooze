import { render, screen, fireEvent } from '@testing-library/react';
import SnoozedList from './SnoozedList';
import { describe, it, expect, vi } from 'vitest';

describe('SnoozedList', () => {
  const mockPopTime = 1704100000000;
  const mockDate = new Date(mockPopTime);

  // dayGroups format (output of selectSnoozedItemsByDay)
  const mockDayGroups = [
    {
      key: mockDate.toDateString(),
      date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
      displayItems: [
        {
          type: 'tab',
          data: {
            id: 'tab-1',
            url: 'https://example.com',
            title: 'Example Tab',
            favicon: '',
            creationTime: 123,
            popTime: mockPopTime,
          },
        },
      ],
    },
  ];

  it('renders snoozed items correctly', () => {
    render(<SnoozedList dayGroups={mockDayGroups} />);
    expect(screen.getByText('Example Tab')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('calls onClearTab when delete button is clicked', () => {
    const handleClearTab = vi.fn();
    render(<SnoozedList dayGroups={mockDayGroups} onClearTab={handleClearTab} />);

    const buttons = screen.getAllByRole('button');
    const deleteBtn = buttons[0];

    fireEvent.click(deleteBtn);

    expect(handleClearTab).toHaveBeenCalledTimes(1);
    expect(handleClearTab).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Example Tab',
      })
    );
  });

  it('renders "No snoozed tabs" when empty', () => {
    render(<SnoozedList dayGroups={[]} />);
    expect(screen.getByText('No snoozed tabs.')).toBeInTheDocument();
  });

  it('renders "No snoozed tabs" when dayGroups is undefined', () => {
    render(<SnoozedList dayGroups={undefined} />);
    expect(screen.getByText('No snoozed tabs.')).toBeInTheDocument();
  });

  it('renders grouped window tabs and handles restore/clear actions', () => {
    const onRestoreGroup = vi.fn();
    const onClearGroup = vi.fn();
    const onClearTab = vi.fn();

    const groupedDayGroups = [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'group',
            groupId: 'g1',
            popTime: mockPopTime,
            groupItems: [
              {
                id: 'tab-1',
                url: 'https://example.com',
                title: 'Grouped Tab A',
                favicon: '',
                creationTime: 123,
                popTime: mockPopTime,
                groupId: 'g1',
              },
              {
                id: 'tab-2',
                url: 'https://example.com/b',
                title: 'Grouped Tab B',
                favicon: '',
                creationTime: 124,
                popTime: mockPopTime,
                groupId: 'g1',
              },
            ],
          },
        ],
      },
    ];

    render(
      <SnoozedList
        dayGroups={groupedDayGroups}
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
    const invalidDayGroups = [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'tab',
            data: {
              id: 'tab-1',
              url: 'not a url',
              title: 'Broken Tab',
              favicon: '',
              creationTime: 123,
              popTime: mockPopTime,
            },
          },
        ],
      },
    ];

    render(<SnoozedList dayGroups={invalidDayGroups} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
