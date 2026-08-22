const LIGHTBOX_HTML = `
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Enlarged view" hidden>
  <div class="lightbox-bar">
    <p class="lightbox-caption" id="lightbox-caption"></p>
    <div class="lightbox-tools">
      <button type="button" class="lightbox-btn" data-zoom="out" aria-label="Zoom out">−</button>
      <span class="lightbox-level" id="lightbox-level">100%</span>
      <button type="button" class="lightbox-btn" data-zoom="in" aria-label="Zoom in">+</button>
      <button type="button" class="lightbox-btn lightbox-close" aria-label="Close">×</button>
    </div>
  </div>
  <div class="lightbox-stage" id="lightbox-stage">
    <img id="lightbox-img" alt="">
  </div>
  <p class="lightbox-hint" id="lightbox-hint">Scroll to zoom, drag to move</p>
</div>`;

const STEPS = [1, 1.5, 2, 3, 4];
const ZOOMABLE = '.plan-image img, .gallery .shot img, .project-hero-image img';

let scale = 1;
let panX = 0;
let panY = 0;
let opener = null;
let dragging = null;

function el(id) {
  return document.getElementById(id);
}

function apply() {
  const img = el('lightbox-img');
  img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  el('lightbox-level').textContent = `${Math.round(scale * 100)}%`;
  el('lightbox-stage').classList.toggle('is-zoomed', scale > 1);
}

function setScale(next, originX, originY) {
  const clamped = Math.min(Math.max(next, 1), 4);
  if (clamped === scale) return;

  if (clamped === 1) {
    panX = 0;
    panY = 0;
  } else if (originX !== undefined) {
    const ratio = clamped / scale;
    panX = originX - (originX - panX) * ratio;
    panY = originY - (originY - panY) * ratio;
  }
  scale = clamped;
  apply();
}

function step(direction) {
  const current = STEPS.findIndex(s => s >= scale - 0.01);
  const next = STEPS[Math.min(Math.max(current + direction, 0), STEPS.length - 1)];
  setScale(next);
}

function largestSource(source) {
  const candidates = (source.getAttribute('srcset') ?? '')
    .split(',')
    .map(part => part.trim().split(/\s+/))
    .filter(([url, width]) => url && /^\d+w$/.test(width ?? ''))
    .map(([url, width]) => ({ url, width: parseInt(width, 10) }))
    .sort((a, b) => b.width - a.width);

  return candidates[0]?.url ?? source.src;
}

function open(source) {
  opener = source;
  const img = el('lightbox-img');

  img.src = largestSource(source);
  img.alt = source.alt || '';
  el('lightbox-caption').textContent = source.dataset.caption || source.alt || '';

  scale = 1;
  panX = 0;
  panY = 0;
  apply();

  el('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
  el('lightbox').querySelector('.lightbox-close').focus();
}

function close() {
  el('lightbox').hidden = true;
  document.body.style.overflow = '';
  el('lightbox-img').src = '';
  if (opener) opener.focus();
  opener = null;
}

function onKey(e) {
  if (el('lightbox').hidden) return;
  if (e.key === 'Escape') close();
  if (e.key === '+' || e.key === '=') step(1);
  if (e.key === '-') step(-1);
  if (e.key === 'Tab') {
    const items = [...el('lightbox').querySelectorAll('button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function initLightbox() {
  if (!document.querySelector(ZOOMABLE)) return;
  document.body.insertAdjacentHTML('beforeend', LIGHTBOX_HTML);

  for (const img of document.querySelectorAll(ZOOMABLE)) {
    img.classList.add('is-zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `${img.alt || 'Image'} — enlarge`);

    const caption = img.closest('figure')?.querySelector('figcaption')?.textContent
      ?? img.closest('.plan')?.querySelector('.plan-title')?.textContent;
    if (caption) img.dataset.caption = caption.trim();

    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(img);
      }
    });
  }

  const box = el('lightbox');
  const stage = el('lightbox-stage');

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelectorAll('[data-zoom]').forEach(btn => {
    btn.addEventListener('click', () => step(btn.dataset.zoom === 'in' ? 1 : -1));
  });

  stage.addEventListener('click', e => {
    if (e.target === stage) close();
  });

  stage.addEventListener('dblclick', e => {
    const rect = stage.getBoundingClientRect();
    setScale(scale > 1 ? 1 : 2, e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
  });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const next = scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
    setScale(next, e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
  }, { passive: false });

  stage.addEventListener('pointerdown', e => {
    if (scale === 1) return;
    dragging = { x: e.clientX - panX, y: e.clientY - panY };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    panX = e.clientX - dragging.x;
    panY = e.clientY - dragging.y;
    apply();
  });
  for (const done of ['pointerup', 'pointercancel']) {
    stage.addEventListener(done, () => { dragging = null; });
  }

  document.addEventListener('keydown', onKey);
}
