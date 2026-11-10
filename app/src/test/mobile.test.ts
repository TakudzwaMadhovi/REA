import { describe, expect, it } from 'vitest';
import { swipeAction } from '../components/SwipeRow';
import { isIOS, shouldShowInstallGuide } from '../lib/platform';

// ui.tsx pulls in the DOM only when rendering; the rule itself is pure
const { shouldDragClose } = await import('../components/ui');

describe('swipe rows', () => {
  it('needs 40% of the row width either way', () => {
    expect(swipeAction(150, 375)).toBe('done');
    expect(swipeAction(149, 375)).toBeNull();
    expect(swipeAction(-150, 375)).toBe('later');
    expect(swipeAction(0, 0)).toBeNull();
  });
});

describe('bottom sheet drag', () => {
  it('closes after a quarter of its height or a fast flick', () => {
    expect(shouldDragClose(160, 0.1, 800)).toBe(true);
    expect(shouldDragClose(100, 0.1, 800)).toBe(false);
    expect(shouldDragClose(50, 1, 800)).toBe(true);
    expect(shouldDragClose(20, 2, 800)).toBe(false);
  });
});

describe('iPhone install guide', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  it('detects iPhone, and iPad posing as a Mac', () => {
    expect(isIOS(iphone, 5)).toBe(true);
    expect(isIOS(ipad, 5)).toBe(true);
    expect(isIOS(ipad, 0)).toBe(false);
  });
  it('shows only in iOS Safari before install and until dismissed', () => {
    expect(shouldShowInstallGuide(true, false, false)).toBe(true);
    expect(shouldShowInstallGuide(true, true, false)).toBe(false);
    expect(shouldShowInstallGuide(true, false, true)).toBe(false);
    expect(shouldShowInstallGuide(false, false, false)).toBe(false);
  });
});
