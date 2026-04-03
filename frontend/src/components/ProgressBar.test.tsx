import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('clamps values over 100%', () => {
    render(<ProgressBar value={120} />);

    const bar = screen.getByTestId('progress-fill');
    expect(bar.style.width).toBe('100%');
  });
});
