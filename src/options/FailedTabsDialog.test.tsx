import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FailedTabsDialog from './FailedTabsDialog';

describe('FailedTabsDialog', () => {
  const mockFailedTabs = [
    { id: 'tab-1', url: 'https://example.com/page1', title: 'Failed Page 1' },
    { id: 'tab-2', url: 'https://test.com/page2', title: 'Failed Page 2' },
  ];

  it('renders dialog with failed tabs when open', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.getByText('Failed to Restore Tabs')).toBeInTheDocument();
    expect(screen.getByText('Failed Page 1')).toBeInTheDocument();
    expect(screen.getByText('Failed Page 2')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('test.com')).toBeInTheDocument();
  });

  it('shows correct message for single failed tab', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={[mockFailedTabs[0]]}
      />
    );

    expect(screen.getByText(/1 tab failed to restore/)).toBeInTheDocument();
  });

  it('shows correct message for multiple failed tabs', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.getByText(/2 tabs failed to restore/)).toBeInTheDocument();
  });

  it('shows empty state when no failed tabs', () => {
    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={[]}
      />
    );

    // Text appears in both DialogDescription and the empty state div
    const emptyStateTexts = screen.getAllByText('No failed tabs to display.');
    expect(emptyStateTexts.length).toBeGreaterThan(0);
  });

  it('does not render content when closed', () => {
    render(
      <FailedTabsDialog
        open={false}
        onOpenChange={() => {}}
        failedTabs={mockFailedTabs}
      />
    );

    expect(screen.queryByText('Failed to Restore Tabs')).not.toBeInTheDocument();
  });

  it('displays "Untitled" for tabs without title', () => {
    const tabsWithoutTitle = [
      { id: 'tab-1', url: 'https://example.com/page1' },
    ];

    render(
      <FailedTabsDialog
        open={true}
        onOpenChange={() => {}}
        failedTabs={tabsWithoutTitle}
      />
    );

    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });
});
