import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionBanner } from './ui';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('ConnectionBanner', () => {
  it('shows nothing while online', () => {
    setOnline(true);
    const { container } = render(<ConnectionBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says plainly that nothing can be saved while offline, then confirms the reconnection', () => {
    vi.useFakeTimers();
    setOnline(false);
    render(<ConnectionBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'You are offline. Changes cannot be saved',
    );

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Back online.');

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
