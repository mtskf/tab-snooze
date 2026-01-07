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
          type: 'tab' as const,
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
            type: 'group' as const,
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
    fireEvent.click(clearGroupButton!);
    expect(onClearGroup).toHaveBeenCalledWith('g1', expect.arrayContaining([
      expect.objectContaining({ title: 'Grouped Tab A' }),
      expect.objectContaining({ title: 'Grouped Tab B' }),
    ]));

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
            type: 'tab' as const,
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

  it('shows fallback icon when favicon is missing', () => {
    const dayGroupsWithoutFavicon = [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'tab' as const,
            data: {
              id: 'tab-1',
              url: 'https://example.com',
              title: 'Tab Without Favicon',
              favicon: null,
              creationTime: 123,
              popTime: mockPopTime,
            },
          },
        ],
      },
    ];

    const { container } = render(<SnoozedList dayGroups={dayGroupsWithoutFavicon} />);
    // Should render Globe icon as fallback (lucide-react icons use svg)
    const globeIcon = container.querySelector('svg.lucide-globe');
    expect(globeIcon).toBeInTheDocument();
    // Should NOT render an img element
    const img = container.querySelector('img');
    expect(img).not.toBeInTheDocument();
  });

  it('shows favicon when available', () => {
    const dayGroupsWithFavicon = [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'tab' as const,
            data: {
              id: 'tab-1',
              url: 'https://example.com',
              title: 'Tab With Favicon',
              favicon: 'https://example.com/favicon.ico',
              creationTime: 123,
              popTime: mockPopTime,
            },
          },
        ],
      },
    ];

    const { container } = render(<SnoozedList dayGroups={dayGroupsWithFavicon} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/favicon.ico');
  });

  it('shows fallback icon when favicon fails to load', () => {
    const dayGroupsWithBrokenFavicon = [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'tab' as const,
            data: {
              id: 'tab-1',
              url: 'https://example.com',
              title: 'Tab With Broken Favicon',
              favicon: 'https://example.com/broken.ico',
              creationTime: 123,
              popTime: mockPopTime,
            },
          },
        ],
      },
    ];

    const { container } = render(<SnoozedList dayGroups={dayGroupsWithBrokenFavicon} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();

    // Trigger error event
    fireEvent.error(img!);

    // After error, should show fallback icon instead of img
    const globeIcon = container.querySelector('svg.lucide-globe');
    expect(globeIcon).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('resets error state when favicon src changes', () => {
    const createDayGroups = (favicon: string) => [
      {
        key: mockDate.toDateString(),
        date: new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate()),
        displayItems: [
          {
            type: 'tab' as const,
            data: {
              id: 'tab-1',
              url: 'https://example.com',
              title: 'Tab With Favicon',
              favicon,
              creationTime: 123,
              popTime: mockPopTime,
            },
          },
        ],
      },
    ];

    const { container, rerender } = render(
      <SnoozedList dayGroups={createDayGroups('https://example.com/broken.ico')} />
    );

    // Initial img renders
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();

    // Trigger error
    fireEvent.error(img!);

    // Should show fallback
    expect(container.querySelector('svg.lucide-globe')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();

    // Rerender with new favicon src
    rerender(<SnoozedList dayGroups={createDayGroups('https://example.com/new-favicon.ico')} />);

    // Error state should be reset, img should render again
    const newImg = container.querySelector('img');
    expect(newImg).toBeInTheDocument();
    expect(newImg).toHaveAttribute('src', 'https://example.com/new-favicon.ico');
    expect(container.querySelector('svg.lucide-globe')).not.toBeInTheDocument();
  });
});
