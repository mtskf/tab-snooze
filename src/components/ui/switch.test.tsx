import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders with role switch', () => {
    render(<Switch />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
});
