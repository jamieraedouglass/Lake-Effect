function initPage() {
  const nav = document.getElementById('main-nav');
  const toggle = nav.querySelector('.nav-toggle');

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  window.matchMedia('(min-width: 861px)').addEventListener('change', e => {
    if (e.matches) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  if (typeof initAsk === 'function') initAsk();
  if (typeof initLightbox === 'function') initLightbox();
}
