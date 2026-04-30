// Shared components for Lake Effect Architects

const NAV_HTML = `
<nav id="main-nav">
  <a class="nav-logo" href="index.html">
    <img src="logo.svg" alt="Lake Effect Architects" class="nav-logo-img">
  </a>
  <ul class="nav-links">
    <li><a href="residential.html" data-page="residential">Residential</a></li>
    <li><a href="commercial.html" data-page="commercial">Commercial</a></li>
    <li><a href="furniture.html" data-page="furniture">Furniture</a></li>
    <li><a href="about.html" data-page="about">About</a></li>
  </ul>
  <a class="nav-cta" href="contact.html">Inquire</a>
</nav>`;

const FOOTER_HTML = `
<footer>
  <div class="footer-top">
    <div>
      <div class="footer-brand-name">Lake Effect<br>Architects</div>
      <p class="footer-tagline">Complete architectural services for high-end residential, custom homes, and commercial architecture. Lake Bluff, Illinois.</p>
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
        <li><a href="about.html#mission">Mission</a></li>
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
    <p class="footer-copy">© 2025 Lake Effect Architects, Inc. &nbsp;·&nbsp; P.O. Box 155, Lake Bluff, IL</p>
    <div class="footer-legal">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
    </div>
  </div>
</footer>`;

// Project placeholder SVG
function projectSVG(size = 56) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="24" width="42" height="25" stroke="rgba(184,169,138,0.5)" stroke-width="0.75"/>
    <polyline points="3,26 28,10 53,26" stroke="rgba(184,169,138,0.5)" stroke-width="0.75" fill="none"/>
    <rect x="20" y="35" width="16" height="14" stroke="rgba(184,169,138,0.35)" stroke-width="0.5"/>
    <line x1="28" y1="24" x2="28" y2="35" stroke="rgba(184,169,138,0.25)" stroke-width="0.5"/>
  </svg>`;
}

function initPage(activePage) {
  // Inject favicon
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = 'logo.svg';
  document.head.appendChild(favicon);
  // Inject nav
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  // Inject footer
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  // Set active nav link
  if (activePage) {
    document.querySelectorAll('.nav-links a').forEach(a => {
      if (a.dataset.page === activePage) a.classList.add('active');
    });
  }
}
