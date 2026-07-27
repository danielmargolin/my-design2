const FRAME_COUNT = 300;
const MOBILE_BREAKPOINT = 767;

const sequence = document.querySelector(".sequence");
const stage = document.querySelector(".sequence__stage");
const canvas = document.querySelector(".sequence__canvas");
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

/**
 * Overlay frame ranges — single source of truth (1-based, inclusive).
 * `from` is the scroll target for jump-to-overlay buttons.
 * Markup: add .overlay with matching id under .sequence__overlays.
 */
const OVERLAY_FRAMES = {
  "overlay-lets-go": { from: 1, to: 40 },
  "overlay-card": { from: 150, to: 210 }
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

floatingCta.addEventListener("click", () => {
  window.scrollBy({
    top: window.innerHeight * 0.85,
    behavior: "smooth"
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
  status.textContent = `טוען פריימים… ${progress}%`;
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
  resizeCanvas();
  sequence.classList.add("is-ready");

  gsap.to(playhead, {
    frame: FRAME_COUNT - 1,
    ease: "none",
    snap: "frame",
    onUpdate: renderFrame,
    scrollTrigger: {
      trigger: sequence,
      start: "top top",
      end: () => `+=${window.innerHeight * 5}`,
      pin: stage,
      scrub: 0.5,
      invalidateOnRefresh: true
    }
  });
}

Promise.all(Array.from({ length: FRAME_COUNT }, (_, index) => loadFrame(index)))
  .then(startSequence);

window.addEventListener("resize", resizeCanvas);

window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).addEventListener(
  "change",
  () => window.location.reload()
);
