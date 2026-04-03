import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalCard } from './GoalCard';

afterEach(() => {
  cleanup();
});

describe('GoalCard', () => {
  it('shows 100% when completed flag is true even if completedValue was stale', () => {
    render(
      <GoalCard
        title="Kafka learning"
        category="Learning"
        targetValue={5}
        completedValue={1}
        completed={true}
        unit="TOPICS"
        date="2026-03-31T00:00:00.000Z"
        status="IN_PROGRESS"
        isEditable={true}
      />,
    );

    expect(screen.getByText('5 / 5')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('caps +1 progress at target and does not exceed target', () => {
    const onUpdateProgress = vi.fn();
    render(
      <GoalCard
        title="Solve DSA"
        category="DSA"
        targetValue={3}
        completedValue={2}
        unit="PROBLEMS"
        date="2026-03-31T00:00:00.000Z"
        status="IN_PROGRESS"
        isEditable={true}
        onUpdateProgress={onUpdateProgress}
      />,
    );

    fireEvent.click(screen.getByText('+1 Progress'));
    expect(onUpdateProgress).toHaveBeenCalledWith(3);
  });

  it('hides editing controls for non-editable partner goals', () => {
    render(
      <GoalCard
        title="Partner goal"
        category="Learning"
        targetValue={2}
        completedValue={0}
        unit="ITEMS"
        date="2026-03-31T00:00:00.000Z"
        status="NOT_STARTED"
        isEditable={false}
      />,
    );

    expect(screen.getByText('View only (partner goal)')).toBeInTheDocument();
    expect(screen.queryByText('+1 Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Done')).not.toBeInTheDocument();
  });
});
