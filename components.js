const NAV_HTML = `
<nav id="main-nav">
  <a class="nav-logo" href="./">
    <img src="logo.svg" alt="Lake Effect Architects" class="nav-logo-img">
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links" id="nav-links">
    <li><a href="residential.html" data-page="residential">Residential</a></li>
    <li><a href="commercial.html" data-page="commercial">Commercial</a></li>
    <li><a href="furniture.html" data-page="furniture">Furniture</a></li>
    <li><a href="philosophy.html" data-page="philosophy">Philosophy</a></li>
    <li><a href="about.html" data-page="about">About</a></li>
  </ul>
  <a class="nav-cta" href="contact.html">Inquire</a>
</nav>`;

const FOOTER_HTML = `
<footer>
  <div class="footer-top">
    <div>
      <div class="footer-brand-name">Lake Effect<br>Architects</div>
      <p class="footer-tagline">Architecture and furniture design for homes, clubs and commercial buildings on Chicago's North Shore. Lake Bluff, Illinois.</p>
    </div>
    <div>
      <div class="footer-col-title">Work</div>
      <ul class="footer-links">
        <li><a href="residential.html">Residential</a></li>
        <li><a href="commercial.html">Commercial</a></li>
        <li><a href="furniture.html">Furniture Design</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Studio</div>
      <ul class="footer-links">
        <li><a href="about.html">About Us</a></li>
        <li><a href="philosophy.html">Design Philosophy</a></li>
        <li><a href="about.html#process">Process</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Contact</div>
      <ul class="footer-links">
        <li><a href="tel:8472344688">847.234.4688</a></li>
        <li><a href="mailto:rob@leffect.com">rob@leffect.com</a></li>
        <li><a href="contact.html">Start a project</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copy">© 2025 Lake Effect Architects, Inc. &nbsp;·&nbsp; Lake Bluff, Illinois</p>
    <div class="footer-legal">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
    </div>
  </div>
</footer>`;

function initPage(activePage) {
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = 'logo.svg';
  document.head.appendChild(favicon);

  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);

  if (activePage) {
    document.querySelectorAll('.nav-links a').forEach(a => {
      if (a.dataset.page === activePage) a.classList.add('active');
    });
  }

  const nav = document.getElementById('main-nav');
  const toggle = nav.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  if (typeof initAsk === 'function') initAsk();

  window.matchMedia('(min-width: 861px)').addEventListener('change', e => {
    if (e.matches) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}
