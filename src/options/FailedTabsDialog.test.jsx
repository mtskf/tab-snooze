import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FailedTabsDialog from './FailedTabsDialog';

describe('FailedTabsDialog', () => {
  const mockFailedTabs = [
    { id: 'tab-1', url: 'https://example.com/page1', title: 'Example Page 1', favicon: null },
    { id: 'tab-2', url: 'https://test.com/page2', title: 'Test Page 2', favicon: 'https://test.com/favicon.ico' },
  ];

  test('renders nothing when not open', () => {
    render(
      <FailedTabsDialog
        open={false}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.queryByText('Failed to Restore Tabs')).not.toBeInTheDocument();
  });

  test('renders dialog with failed tabs when open', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.getByText('Failed to Restore Tabs')).toBeInTheDocument();
    expect(screen.getByText('Example Page 1')).toBeInTheDocument();
    expect(screen.getByText('Test Page 2')).toBeInTheDocument();
  });

  test('displays tab count in description', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.getByText(/2 tabs? failed/i)).toBeInTheDocument();
  });

  test('shows URL for each failed tab', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('test.com')).toBeInTheDocument();
  });

  test('calls onOpenChange when close button is clicked', () => {
    const onOpenChange = vi.fn();

    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={onOpenChange}
        failedTabs={mockFailedTabs}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('renders empty state when no failed tabs', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={[]}
      />
    );

    // Multiple elements contain "no failed tabs" - just verify at least one exists
    expect(screen.getAllByText(/no failed tabs/i).length).toBeGreaterThan(0);
  });
});
