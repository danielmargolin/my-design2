# Frame overlays — agent guide

Use this doc when creating, editing, timing, or styling scroll-sequence overlays for My Design.

## System overview

- Scroll drives a 300-frame image sequence (`frames-desktop/` / `frames-mobile/`).
- Overlays sit on top of the canvas inside `.sequence__overlays`.
- Timing lives in `OVERLAY_FRAMES` in `script.js` (1-based, inclusive). Keys match overlay element `id`s. `from` is the scroll target for jump-to-overlay buttons.
- JS applies `data-from` / `data-to` on the DOM, then toggles `.is-active` + `aria-hidden` as the playhead moves.

## Files to touch

| Concern | File |
| --- | --- |
| Content / markup | `index.html` → `.sequence__overlays` |
| Timing (`from` / `to`) | `script.js` → `OVERLAY_FRAMES` |
| Shared overlay chrome | `styles.css` → `/* —— Frame overlays —— */` |
| Per-overlay look | `styles.css` → `#overlay-…` or `.overlay--…` |
| Engine / sync | `script.js` → overlay registry + `syncOverlays` (rare) |

Prefer HTML + CSS for content/look. Change `OVERLAY_FRAMES` for timing. Leave the sync engine alone unless it needs a feature.

## How to add an overlay

1. Copy a block under `.sequence__overlays` in `index.html`.
2. Give it a unique `id` (`overlay-kitchen`, `overlay-exterior`, …).
3. Add the same id to `OVERLAY_FRAMES` in `script.js` with `{ from, to }` (integers 1–300, `from <= to`).
4. Keep `aria-hidden="true"` in markup; JS updates it at runtime.
5. Put copy/markup inside the overlay; use `.overlay__content` helpers or custom structure.
6. Style via `#overlay-…` in `styles.css` so designs stay isolated.

### Template

```html
<div
  class="overlay"
  id="overlay-name"
  aria-hidden="true"
>
  <div class="overlay__content">
    <p class="overlay__eyebrow">תווית</p>
    <h2 class="overlay__title">כותרת</h2>
    <p class="overlay__text">משפט קצר.</p>
  </div>
</div>
```

```js
const OVERLAY_FRAMES = {
  // …
  "overlay-name": { from: 80, to: 120 }
};
```

## Timing rules

- Frames are **1–300**, inclusive. Frame `40` = `ezgif-frame-040.jpg`.
- Edit ranges only in `OVERLAY_FRAMES` — not hard-coded in HTML.
- `OVERLAY_FRAMES[id].from` is the frame to scroll to for that overlay.
- Ranges may overlap only if intentional (stacked UI). Prefer non-overlapping ranges.
- Leave a small gap (≈5–15 frames) between overlays when both fade, so transitions don’t fight.
- Fade duration is ~320ms in CSS — very short ranges (< ~10 frames) can feel abrupt; widen if needed.
- Preview timing by scrolling the sequence; adjust `from` / `to` in `OVERLAY_FRAMES`.
- Mobile and desktop share the same frame count and overlay timing.

### Quick timing checklist

When the user asks to “show X around the kitchen / entrance / …”:

1. Ask which frame range if unclear, or propose a range and confirm.
2. Peek at nearby frames under `frames-desktop/` (or mobile) to align with the visual.
3. Update `from` / `to` on the matching entry in `OVERLAY_FRAMES`.
4. Ensure no accidental overlap with neighbors unless requested.

## Content rules

- Site language is **Hebrew**, `dir="rtl"`. Write overlay copy in Hebrew unless asked otherwise.
- Keep each overlay to one job: one title, one short line (optional eyebrow).
- Do not dump stats, long paragraphs, or nav into overlays.
- Replace example overlays (`overlay-example-a`, `overlay-example-b`) with real content when shipping; remove unused examples.
- Interactive controls inside an overlay are fine (`.is-active` enables `pointer-events`).

## Style rules

- Match existing tokens: `--warm-white`, `--muted`, `--accent`, dark atmosphere (`#050505`).
- Prefer typography already on the site (Heebo + Georgia for display).
- Scope custom styles to the overlay id:

```css
#overlay-kitchen .overlay__title {
  /* …
}
```

- Do not restyle `.sequence__canvas`, header, or floating CTA from overlay CSS.
- Avoid cards, purple gradients, glow stacks, and dense pill clusters (project design prefs).
- Overlays should read as light type on the frame, not a dashboard panel — unless the user asks for a solid panel.
- Support mobile: test padding; avoid covering the floating CTA zone when possible (bottom ~12–18vh).
- Respect `prefers-reduced-motion` (overlay opacity transition is already disabled globally).

## Agent workflow

When the user asks to maintain overlays:

1. **Clarify** — content (Hebrew copy), timing (frame range or visual cue), style (position, type size, accent).
2. **Inventory** — list current overlays: `id`, `from`, `to` (from `OVERLAY_FRAMES`), one-line purpose.
3. **Edit** — change only the relevant overlay(s); keep others intact.
4. **Isolate styles** — new look goes under `#overlay-…`, not global `.overlay` unless shared.
5. **Verify** — ranges valid (1–300, from ≤ to), unique ids, entry in `OVERLAY_FRAMES`, no broken markup, Hebrew RTL intact.

### Common requests → actions

| User says | Do this |
| --- | --- |
| “Change the text on …” | Edit markup inside that overlay only |
| “Show it later / earlier” | Nudge `from` / `to` in `OVERLAY_FRAMES` |
| “Make it bigger / bottom / left” | Add `#overlay-…` CSS; use flex alignment on `.overlay` or content modifiers |
| “Add a new beat at frames …” | New `.overlay` block + `OVERLAY_FRAMES` entry + scoped CSS |
| “Remove the examples” | Delete example nodes, their `OVERLAY_FRAMES` entries, and unused CSS |

## Do not

- Duplicate timing in HTML `data-from` / `data-to` — `OVERLAY_FRAMES` is the source of truth.
- Use 0-based indices in `OVERLAY_FRAMES`.
- Break the canvas loader or pin/scrub ScrollTrigger setup for overlay work.
- Commit secrets or large binary frame re-exports as part of copy edits.
