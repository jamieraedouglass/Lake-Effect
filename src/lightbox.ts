const LIGHTBOX_HTML = `
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Enlarged view" hidden>
  <div class="lightbox-bar">
    <p class="lightbox-caption" id="lightbox-caption"></p>
    <div class="lightbox-tools">
      <button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous image">&lsaquo;</button>
      <span class="lightbox-count" id="lightbox-count"></span>
      <button type="button" class="lightbox-btn lightbox-next" aria-label="Next image">&rsaquo;</button>
      <button type="button" class="lightbox-btn" data-zoom="out" aria-label="Zoom out">−</button>
      <span class="lightbox-level" id="lightbox-level">100%</span>
      <button type="button" class="lightbox-btn" data-zoom="in" aria-label="Zoom in">+</button>
      <button type="button" class="lightbox-btn lightbox-close" aria-label="Close">×</button>
    </div>
  </div>
  <div class="lightbox-stage" id="lightbox-stage">
    <img id="lightbox-img" alt="">
  </div>
  <p class="lightbox-hint" id="lightbox-hint">Swipe or use the arrow keys. Scroll to zoom, drag to move.</p>
</div>`;

const STEPS = [1, 1.5, 2, 3, 4] as const;
const ZOOMABLE = '.plan-image img, .gallery .shot img, .project-hero-image img';
const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface Drag {
  x: number;
  y: number;
}

let scale = 1;
let panX = 0;
let panY = 0;
let lastOpened: HTMLImageElement | null = null;
let dragging: Drag | null = null;
// The images the visitor can move between: the others in the same section, so
// a swipe inside Interior does not wander off into Exterior.
let group: HTMLImageElement[] = [];
let current = 0;
let swipe: { x: number; y: number } | null = null;

function boxEl<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`lightbox: #${id} is missing`);
  return found as T;
}

function apply(): void {
  const img = boxEl<HTMLImageElement>('lightbox-img');
  img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  boxEl('lightbox-level').textContent = `${Math.round(scale * 100)}%`;
  boxEl('lightbox-stage').classList.toggle('is-zoomed', scale > 1);
}

function setScale(next: number, originX?: number, originY?: number): void {
  const clamped = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
  if (clamped === scale) return;

  if (clamped === MIN_SCALE) {
    panX = 0;
    panY = 0;
  } else if (originX !== undefined && originY !== undefined) {
    const ratio = clamped / scale;
    panX = originX - (originX - panX) * ratio;
    panY = originY - (originY - panY) * ratio;
  }
  scale = clamped;
  apply();
}

function step(direction: 1 | -1): void {
  const current = STEPS.findIndex(value => value >= scale - 0.01);
  const index = Math.min(Math.max(current + direction, 0), STEPS.length - 1);
  const next = STEPS[index];
  if (next !== undefined) setScale(next);
}

function largestSource(source: HTMLImageElement): string {
  const candidates = (source.getAttribute('srcset') ?? '')
    .split(',')
    .map(part => part.trim().split(/\s+/))
    .flatMap(([url, width]) =>
      url && width && /^\d+w$/.test(width) ? [{ url, width: parseInt(width, 10) }] : []
    )
    .sort((a, b) => b.width - a.width);

  return candidates[0]?.url ?? source.src;
}

/** The other zoomable images in the same section as this one. */
function groupFor(source: HTMLImageElement): HTMLImageElement[] {
  const scope = source.closest('section, .project-hero-image') ?? document;
  const found = [...scope.querySelectorAll<HTMLImageElement>(ZOOMABLE)];
  return found.length ? found : [source];
}

function show(position: number): void {
  const source = group[position];
  if (!source) return;
  current = position;
  lastOpened = source;

  const img = boxEl<HTMLImageElement>('lightbox-img');
  img.src = largestSource(source);
  img.alt = source.alt || '';
  boxEl('lightbox-caption').textContent = source.dataset['caption'] ?? source.alt ?? '';
  boxEl('lightbox-count').textContent = group.length > 1 ? `${current + 1} / ${group.length}` : '';

  const alone = group.length < 2;
  for (const selector of ['.lightbox-prev', '.lightbox-next']) {
    boxEl('lightbox').querySelector<HTMLButtonElement>(selector)?.toggleAttribute('hidden', alone);
  }

  // A new picture starts unzoomed, or the previous zoom would frame it wrongly.
  scale = 1;
  panX = 0;
  panY = 0;
  apply();
}

/** Move by one, wrapping, so the set never dead-ends. */
function go(by: number): void {
  if (group.length < 2) return;
  show((current + by + group.length) % group.length);
}

function openLightbox(source: HTMLImageElement): void {
  group = groupFor(source);
  show(Math.max(0, group.indexOf(source)));

  boxEl('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
  boxEl<HTMLButtonElement>('lightbox').querySelector<HTMLButtonElement>('.lightbox-close')?.focus();
}

function closeLightbox(): void {
  boxEl('lightbox').hidden = true;
  document.body.style.overflow = '';
  boxEl<HTMLImageElement>('lightbox-img').src = '';
  lastOpened?.focus();
  lastOpened = null;
}

function onLightboxKey(event: KeyboardEvent): void {
  const box = boxEl('lightbox');
  if (box.hidden) return;

  if (event.key === 'Escape') closeLightbox();
  if (event.key === '+' || event.key === '=') step(1);
  if (event.key === '-') step(-1);
  if (event.key === 'ArrowRight') go(1);
  if (event.key === 'ArrowLeft') go(-1);

  if (event.key === 'Tab') {
    const items = [...box.querySelectorAll<HTMLButtonElement>('button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function initLightbox(): void {
  if (!document.querySelector(ZOOMABLE)) return;
  document.body.insertAdjacentHTML('beforeend', LIGHTBOX_HTML);

  for (const img of document.querySelectorAll<HTMLImageElement>(ZOOMABLE)) {
    img.classList.add('is-zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `${img.alt || 'Image'} (enlarge)`);

    const caption =
      img.closest('figure')?.querySelector('figcaption')?.textContent ??
      img.closest('.plan')?.querySelector('.plan-title')?.textContent;
    if (caption) img.dataset['caption'] = caption.trim();

    img.addEventListener('click', () => openLightbox(img));
    img.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(img);
      }
    });
  }

  const box = boxEl('lightbox');
  const stage = boxEl('lightbox-stage');

  box.querySelector<HTMLButtonElement>('.lightbox-close')?.addEventListener('click', closeLightbox);
  box.querySelector<HTMLButtonElement>('.lightbox-prev')?.addEventListener('click', () => go(-1));
  box.querySelector<HTMLButtonElement>('.lightbox-next')?.addEventListener('click', () => go(1));
  for (const button of box.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
    button.addEventListener('click', () => step(button.dataset['zoom'] === 'in' ? 1 : -1));
  }

  stage.addEventListener('click', event => {
    if (event.target === stage) closeLightbox();
  });

  stage.addEventListener('dblclick', event => {
    const rect = stage.getBoundingClientRect();
    setScale(
      scale > 1 ? 1 : 2,
      event.clientX - rect.left - rect.width / 2,
      event.clientY - rect.top - rect.height / 2
    );
  });

  stage.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const next = scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12);
      setScale(
        next,
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2
      );
    },
    { passive: false }
  );

  stage.addEventListener('pointerdown', event => {
    if (scale === 1) {
      // Unzoomed, a drag means "show me the next one". Zoomed in it means pan,
      // so the two never compete for the same gesture.
      swipe = { x: event.clientX, y: event.clientY };
      return;
    }
    dragging = { x: event.clientX - panX, y: event.clientY - panY };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (!dragging) return;
    panX = event.clientX - dragging.x;
    panY = event.clientY - dragging.y;
    apply();
  });

  for (const done of ['pointerup', 'pointercancel'] as const) {
    stage.addEventListener(done, event => {
      dragging = null;
      if (!swipe) return;
      const movedX = event.clientX - swipe.x;
      const movedY = event.clientY - swipe.y;
      swipe = null;
      // Far enough sideways, and more sideways than vertical, so scrolling a
      // tall picture on a phone is not read as a swipe.
      if (Math.abs(movedX) > 45 && Math.abs(movedX) > Math.abs(movedY)) {
        go(movedX < 0 ? 1 : -1);
      }
    });
  }

  document.addEventListener('keydown', onLightboxKey);
}
