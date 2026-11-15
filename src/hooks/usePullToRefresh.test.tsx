import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePullToRefresh } from './usePullToRefresh';

function PullHarness({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const state = usePullToRefresh(onRefresh);
  return (
    <div>
      <div data-testid="distance">{Math.round(state.pullDistance)}</div>
      <div data-testid="ready">{String(state.isReadyToRelease)}</div>
      <div data-testid="refreshing">{String(state.isRefreshing)}</div>
      <div data-testid="scrollbox" style={{ height: 100, overflowY: 'auto' }}>
        Content
      </div>
    </div>
  );
}

describe('usePullToRefresh', () => {
  it('triggers onRefresh after pulling down past the threshold from top', async () => {
    const onRefresh = vi.fn(async () => {});
    render(<PullHarness onRefresh={onRefresh} />);

    fireEvent.touchStart(window, { touches: [{ clientX: 50, clientY: 10 }] });
    fireEvent.touchMove(window, { touches: [{ clientX: 50, clientY: 180 }] });

    expect(Number(screen.getByTestId('distance').textContent)).toBeGreaterThanOrEqual(56);
    expect(screen.getByTestId('ready').textContent).toBe('true');

    fireEvent.touchEnd(window);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores pull inside a container that is scrolled down', () => {
    const onRefresh = vi.fn(async () => {});
    render(<PullHarness onRefresh={onRefresh} />);

    const box = screen.getByTestId('scrollbox');
    Object.defineProperty(box, 'scrollTop', { value: 40, configurable: true });

    fireEvent.touchStart(box, { touches: [{ clientX: 50, clientY: 10 }] });
    fireEvent.touchMove(box, { touches: [{ clientX: 50, clientY: 180 }] });
    fireEvent.touchEnd(box);

    expect(screen.getByTestId('distance').textContent).toBe('0');
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
