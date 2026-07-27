/**
 * On mobile, map horizontal gestures to vertical page scroll:
 * scroll left → scroll down, scroll right → scroll up.
 */
(function () {
  const MOBILE_BREAKPOINT = 767;

  if (!window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) {
    return;
  }

  let touchLastX = 0;
  let touchLastY = 0;
  let touchActive = false;
  let touchHorizontal = false;

  function getScrollY() {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function setScrollY(y) {
    window.scrollTo(0, y);
    if (Math.abs(getScrollY() - y) > 1) {
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    }
  }

  function withInstantScroll(run) {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    try {
      run();
    } finally {
      html.style.scrollBehavior = previous;
    }
  }

  function isNestedScrollTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        ".gallery-grid, [data-allow-horizontal-scroll], input, textarea, select"
      )
    );
  }

  function applyHorizontalAsVertical(deltaX) {
    if (!deltaX) {
      return;
    }

    window.dispatchEvent(new Event("sequence:scroll-interrupt"));

    // deltaX < 0 (left) increases Y; deltaX > 0 (right) decreases Y.
    withInstantScroll(() => setScrollY(getScrollY() - deltaX));
  }

  window.addEventListener(
    "wheel",
    (event) => {
      if (isNestedScrollTarget(event.target)) {
        return;
      }

      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }

      event.preventDefault();
      applyHorizontalAsVertical(event.deltaX);
    },
    { passive: false }
  );

  window.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1 || isNestedScrollTarget(event.target)) {
        touchActive = false;
        return;
      }

      touchActive = true;
      touchHorizontal = false;
      touchLastX = event.touches[0].clientX;
      touchLastY = event.touches[0].clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!touchActive || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - touchLastX;
      const deltaY = touch.clientY - touchLastY;

      if (!touchHorizontal) {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
          return;
        }

        // Only claim the gesture once it reads as clearly horizontal.
        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          touchActive = false;
          return;
        }

        touchHorizontal = true;
      }

      event.preventDefault();
      applyHorizontalAsVertical(deltaX);
      touchLastX = touch.clientX;
      touchLastY = touch.clientY;
    },
    { passive: false }
  );

  window.addEventListener(
    "touchend",
    () => {
      touchActive = false;
      touchHorizontal = false;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchcancel",
    () => {
      touchActive = false;
      touchHorizontal = false;
    },
    { passive: true }
  );
})();
