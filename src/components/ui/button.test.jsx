import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';
import { describe, it, expect, vi } from 'vitest';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: "Click me" })).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button', { name: "Click me" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
