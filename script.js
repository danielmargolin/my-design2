const FRAME_COUNT = 300;
const MOBILE_BREAKPOINT = 767;

const sequence = document.querySelector(".sequence");
const stage = document.querySelector(".sequence__stage");
const canvas = document.querySelector(".sequence__canvas");
const loader = document.querySelector(".sequence__loader");
const status = document.querySelector(".sequence__status");
const context = canvas.getContext("2d");
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
const floatingCta = document.querySelector(".floating-cta");

const isMobile = window.matchMedia(
  `(max-width: ${MOBILE_BREAKPOINT}px)`
).matches;
const frameFolder = isMobile ? "frames-mobile" : "frames-desktop";
const frames = new Array(FRAME_COUNT);
const playhead = { frame: 0 };

let loadedCount = 0;
let lastDrawnFrame = -1;
let lastOverlayFrame = -1;
let sequenceTrigger = null;
let frameScrollTween = null;
let layoutWidth = window.innerWidth;
let viewportResizeTimer = 0;

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
  // Some Android WebViews only move via element scrollTop.
  if (Math.abs(getScrollY() - y) > 1) {
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
  }
}

/**
 * Run scroll writes with CSS scroll-behavior forced off. Native/CSS smooth
 * scroll is unreliable on Android Chrome with pinned ScrollTriggers.
 */
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

function resetSequenceToStart() {
  playhead.frame = 0;
  lastDrawnFrame = -1;
  withInstantScroll(() => setScrollY(0));
}

// Browsers normally restore the previous scroll position on refresh, which
// would initialize ScrollTrigger on a later frame.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
resetSequenceToStart();

/**
 * Overlay frame ranges — single source of truth (1-based, inclusive).
 * `from` is the scroll target for jump-to-overlay buttons.
 * Markup: add .overlay with matching id under .sequence__overlays.
 */
const OVERLAY_FRAMES = {
  "overlay-lets-go": { from: 1, to: 40 },
  "overlay-card": { from: 150, to: 210 },
  "overlay-gallery": { from: 280, to: FRAME_COUNT }
};

/**
 * Overlay registry — ranges from OVERLAY_FRAMES, applied to matching DOM nodes.
 */
const overlays = Object.entries(OVERLAY_FRAMES).flatMap(([id, range]) => {
  const element = document.getElementById(id);
  const { from, to } = range;

  if (!element) {
    console.warn("[overlays] missing element for", id);
    return [];
  }

  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    console.warn("[overlays] invalid range for", id, range);
    return [];
  }

  element.dataset.from = String(from);
  element.dataset.to = String(to);

  return [{ id, element, from, to }];
});


/**
 * Gallery images use data-src so they are not fetched while the overlay is
 * hidden (native loading="lazy" still treats fixed overlays as in-viewport).
 * Load each image when it enters the gallery grid scrollport.
 */
const galleryGrid = document.querySelector("#overlay-gallery .gallery-grid");
let galleryLazyObserver = null;

function hydrateGalleryImage(img) {
  const src = img.getAttribute("data-src");
  if (!src) {
    return;
  }

  img.src = src;
  img.removeAttribute("data-src");
}

function ensureGalleryLazyObserver() {
  if (galleryLazyObserver || !galleryGrid) {
    return galleryLazyObserver;
  }

  galleryLazyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const img = entry.target;
        hydrateGalleryImage(img);
        galleryLazyObserver.unobserve(img);
      }
    },
    {
      root: galleryGrid,
      rootMargin: "120px 0px",
      threshold: 0.01
    }
  );

  return galleryLazyObserver;
}

function syncGalleryLazyLoad(isActive) {
  if (!galleryGrid) {
    return;
  }

  const observer = ensureGalleryLazyObserver();
  if (!observer) {
    return;
  }

  const pending = galleryGrid.querySelectorAll("img[data-src]");

  if (!isActive) {
    pending.forEach((img) => observer.unobserve(img));
    return;
  }

  pending.forEach((img) => observer.observe(img));
}

function syncOverlays(frameIndex) {
  // playhead is 0-based; OVERLAY_FRAMES from/to are 1-based frame file numbers
  const frameNumber = frameIndex + 1;

  if (frameNumber === lastOverlayFrame) {
    return;
  }

  lastOverlayFrame = frameNumber;

  for (const { element, from, to } of overlays) {
    const isActive = frameNumber >= from && frameNumber <= to;
    const wasActive = element.classList.contains("is-active");

    if (isActive === wasActive) {
      continue;
    }

    element.classList.toggle("is-active", isActive);
    element.setAttribute("aria-hidden", String(!isActive));

    if (element.id === "overlay-gallery") {
      syncGalleryLazyLoad(isActive);
    }
  }
}

function setMenuOpen(isOpen) {
  header.classList.toggle("is-menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "סגור תפריט ניווט" : "פתח תפריט ניווט"
  );
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("click", (event) => {
  if (!header.contains(event.target)) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

/**
 * Scroll position for a 1-based frame. Re-read start/end each call so
 * mobile chrome / refresh cannot leave us with a stale target.
 */
function getScrollYForFrame(frameNumber) {
  if (!sequenceTrigger) {
    return getScrollY();
  }

  const frameIndex = Math.max(0, Math.min(FRAME_COUNT - 1, frameNumber - 1));
  const progress = frameIndex / (FRAME_COUNT - 1);
  const { start, end } = sequenceTrigger;

  return start + (end - start) * progress;
}

/**
 * Scroll the sequence so playhead lands on a 1-based frame number.
 * Uses a GSAP-driven scroll (not native smooth scroll) — Android Chrome
 * often fails or lands on the wrong frame with pin + scrub + URL-bar resize.
 */
function scrollToFrame(frameNumber) {
  if (!sequenceTrigger) {
    return;
  }

  if (frameScrollTween) {
    frameScrollTween.kill();
    frameScrollTween = null;
  }

  // Keep start/end current before measuring the jump target.
  ScrollTrigger.refresh();

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const startY = getScrollY();
  const targetY = () => getScrollYForFrame(frameNumber);

  if (reducedMotion) {
    withInstantScroll(() => setScrollY(targetY()));
    return;
  }

  const initialTarget = targetY();
  const distance = Math.abs(initialTarget - startY);
  const duration = Math.min(1.6, Math.max(0.55, distance / 2200));
  const state = { t: 0 };
  const html = document.documentElement;
  const previousBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";

  frameScrollTween = gsap.to(state, {
    t: 1,
    duration,
    ease: "power2.inOut",
    overwrite: true,
    onUpdate: () => {
      // Recompute target while tweening — pin range can shift on mobile.
      setScrollY(startY + (targetY() - startY) * state.t);
    },
    onComplete: () => {
      setScrollY(targetY());
      html.style.scrollBehavior = previousBehavior;
      frameScrollTween = null;
    },
    onInterrupt: () => {
      html.style.scrollBehavior = previousBehavior;
    }
  });
}

/**
 * Jump to an overlay's first frame (`OVERLAY_FRAMES[id].from`).
 */
function scrollToOverlay(id) {
  const range = OVERLAY_FRAMES[id];

  if (!range) {
    console.warn("[overlays] scroll target missing for", id);
    return;
  }

  if (id === "overlay-gallery") {
    const grid = document.querySelector("#overlay-gallery .gallery-grid");
    if (grid) {
      grid.scrollTop = 0;
    }
  }

  scrollToFrame(range.from);
}

/**
 * Jump past the intro CTA to the first content overlay (contact card).
 * Shared by the floating CTA and the nav "צרו קשר" link.
 */
function scrollToFirstContentOverlay() {
  const firstOverlayId = Object.keys(OVERLAY_FRAMES).find(
    (id) => id !== "overlay-lets-go"
  );

  if (firstOverlayId) {
    scrollToOverlay(firstOverlayId);
  }
}

floatingCta.addEventListener("click", scrollToFirstContentOverlay);

document.querySelectorAll("[data-scroll-overlay]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setMenuOpen(false);
    const id = link.getAttribute("data-scroll-overlay");
    if (id) {
      scrollToOverlay(id);
    }
  });
});

function frameUrl(index) {
  const number = String(index + 1).padStart(3, "0");
  return `${frameFolder}/ezgif-frame-${number}.jpg`;
}

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = stage.clientWidth;
  const height = stage.clientHeight;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  lastDrawnFrame = -1;
  renderFrame();
}

function renderFrame() {
  const frameIndex = Math.round(playhead.frame);

  syncOverlays(frameIndex);

  const image = frames[frameIndex];

  if (!image?.complete || !image.naturalWidth || frameIndex === lastDrawnFrame) {
    return;
  }

  const canvasWidth = stage.clientWidth;
  const canvasHeight = stage.clientHeight;
  const scale = Math.max(
    canvasWidth / image.naturalWidth,
    canvasHeight / image.naturalHeight
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (canvasWidth - width) / 2;
  const y = (canvasHeight - height) / 2;

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(image, x, y, width, height);
  lastDrawnFrame = frameIndex;
}

function updateLoadingStatus() {
  loadedCount += 1;
  const progress = Math.round((loadedCount / FRAME_COUNT) * 100);
  status.textContent = `${progress}%`;
  loader.style.setProperty("--load-progress", `${progress}%`);
}

function loadFrame(index) {
  return new Promise((resolve) => {
    const image = new Image();
    frames[index] = image;

    image.onload = () => {
      updateLoadingStatus();
      if (index === 0) {
        resizeCanvas();
      }
      resolve();
    };

    image.onerror = () => {
      updateLoadingStatus();
      resolve();
    };

    image.src = frameUrl(index);
  });
}

function startSequence() {
  if (!window.gsap || !window.ScrollTrigger) {
    status.textContent = "לא ניתן להפעיל את האנימציה.";
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  // Avoid URL-bar show/hide on Android Chrome invalidating pin start/end
  // mid-jump (that lands the CTA on the wrong frame).
  ScrollTrigger.config({ ignoreMobileResize: true });
  resetSequenceToStart();
  resizeCanvas();
  sequence.classList.add("is-ready");

  const tween = gsap.to(playhead, {
    frame: FRAME_COUNT - 1,
    ease: "none",
    snap: "frame",
    onUpdate: renderFrame,
    scrollTrigger: {
      trigger: sequence,
      start: "top top",
      // Mobile uses CSS sticky + a tall sequence; pin fights Android chrome.
      end: isMobile
        ? "bottom bottom"
        : () => `+=${window.innerHeight * 5}`,
      pin: isMobile ? false : stage,
      scrub: 0.5,
      invalidateOnRefresh: true,
      anticipatePin: isMobile ? 0 : 1
    }
  });

  sequenceTrigger = tween.scrollTrigger;
}

function handleResize() {
  const widthChanged = Math.abs(window.innerWidth - layoutWidth) > 1;

  if (isMobile && !widthChanged) {
    // Toolbar show/hide only changes height — debounce canvas realloc so the
    // URL-bar animation can finish without thrashing.
    window.clearTimeout(viewportResizeTimer);
    viewportResizeTimer = window.setTimeout(() => {
      resizeCanvas();
    }, 160);
    return;
  }

  layoutWidth = window.innerWidth;
  resizeCanvas();
}

Promise.all(Array.from({ length: FRAME_COUNT }, (_, index) => loadFrame(index)))
  .then(startSequence);

window.addEventListener("resize", handleResize, { passive: true });
window.visualViewport?.addEventListener("resize", handleResize, {
  passive: true
});

window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).addEventListener(
  "change",
  () => window.location.reload()
);

// Horizontal gesture remapping (mobile-horizontal-scroll.js) interrupts jumps.
window.addEventListener("sequence:scroll-interrupt", () => {
  if (frameScrollTween) {
    frameScrollTween.kill();
    frameScrollTween = null;
  }
});
