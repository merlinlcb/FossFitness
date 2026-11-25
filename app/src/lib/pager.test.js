import { pagerTarget, canReachPage, pagerNeedsAlign } from './pager';

const W = 360;
const SIX = 6 * W;

describe('pager target', () => {
  test('one page is one screen wide', () => {
    expect(pagerTarget(0, W)).toBe(0);
    expect(pagerTarget(1, W)).toBe(W);
    expect(pagerTarget(5, W)).toBe(5 * W);
    expect(pagerTarget(-1, W)).toBe(0);
  });

  test('the last page starts at the far edge of the content', () => {
    expect(pagerTarget(5, W)).toBe(SIX - W);
  });
});

describe('content wide enough to reach a page', () => {
  test('a page is reachable only once its own width has been laid out', () => {
    expect(canReachPage(1, W, W)).toBe(false); // only page 0 measured so far
    expect(canReachPage(1, W, 2 * W)).toBe(true);
    expect(canReachPage(5, W, SIX)).toBe(true);
    expect(canReachPage(5, W, SIX - 1)).toBe(false);
    expect(canReachPage(0, W, 0)).toBe(false);
    expect(canReachPage(0, 0, SIX)).toBe(false);
  });
});

describe('the pager is not where the tab bar says', () => {
  // The bug this fixes: start page Nutrition (index 1). The scroll went out before the pager's
  // content was measured, so it was clamped to 0 and the screen stayed on Today.
  test('the launch jump is retried once the content is measured', () => {
    expect(pagerNeedsAlign(1, W, SIX, 0)).toBe(true);
    expect(pagerNeedsAlign(3, W, SIX, 0)).toBe(true);
    expect(pagerNeedsAlign(5, W, SIX, 0)).toBe(true);
  });

  test('nothing is done while the content is not wide enough yet', () => {
    expect(pagerNeedsAlign(4, W, 3 * W, 0)).toBe(false); // page 4 is not laid out
    expect(pagerNeedsAlign(1, W, 0, 0)).toBe(false);
    expect(pagerNeedsAlign(1, 0, SIX, 0)).toBe(false);
  });

  test('a pager already on its page is left alone', () => {
    expect(pagerNeedsAlign(1, W, SIX, W)).toBe(false);
    expect(pagerNeedsAlign(1, W, SIX, W + 1)).toBe(false);
    expect(pagerNeedsAlign(0, W, SIX, 0)).toBe(false);
    expect(pagerNeedsAlign(5, W, SIX, 5 * W)).toBe(false);
  });

  test('a pager in the middle of a swipe is never pulled back', () => {
    expect(pagerNeedsAlign(0, W, SIX, 0.6 * W)).toBe(false); // finger moving right, index still 0
    expect(pagerNeedsAlign(0, W, SIX, 1.9 * W)).toBe(false);
    expect(pagerNeedsAlign(2, W, SIX, 1.5 * W)).toBe(false);
  });

  test('a pager resting a whole page off is pulled back to its page', () => {
    expect(pagerNeedsAlign(2, W, SIX, W)).toBe(true);
    expect(pagerNeedsAlign(4, W, SIX, 2 * W)).toBe(true);
  });
});
