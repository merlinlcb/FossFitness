// Where the horizontal pager (one page per screen width) should be sitting, and whether it
// needs to be scrolled back there. Pure so the launch-time jump to the start page is testable.

export function pagerTarget(index, width) {
  return Math.max(0, index) * Math.max(0, width);
}

// A scroll request past the content that has actually been laid out is clamped by the
// ScrollView, so the pager can stay on page 0 while the bar already shows another page.
export function canReachPage(index, width, contentWidth) {
  return width > 0 && contentWidth >= (Math.max(0, index) + 1) * width;
}

// True when the pager is not on the page the tab bar shows and the content is wide enough to
// get there. A pager in the middle of a swipe is left alone; only one resting on a page edge
// is pulled back, so re-aligning never fights the user's finger.
export function pagerNeedsAlign(index, width, contentWidth, offset) {
  if (!canReachPage(index, width, contentWidth)) return false;
  const at = offset || 0;
  const resting = Math.round(at / width) * width;
  if (Math.abs(at - resting) > 2) return false;
  return Math.abs(at - pagerTarget(index, width)) >= width / 2;
}
