const FRAME_COUNT = 300;
const MOBILE_BREAKPOINT = 767;

const sequence = document.querySelector(".sequence");
const stage = document.querySelector(".sequence__stage");
const canvas = document.querySelector(".sequence__canvas");
const status = document.querySelector(".sequence__status");
const context = canvas.getContext("2d");

const isMobile = window.matchMedia(
  `(max-width: ${MOBILE_BREAKPOINT}px)`
).matches;
const frameFolder = isMobile ? "frames-mobile" : "frames-desktop";
const frames = new Array(FRAME_COUNT);
const playhead = { frame: 0 };

let loadedCount = 0;
let lastDrawnFrame = -1;

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
  status.textContent = `Loading frames… ${progress}%`;
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
    status.textContent = "The animation could not start.";
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
