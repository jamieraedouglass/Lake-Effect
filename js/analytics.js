"use strict";
function initVercelAnalytics() {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
    import { inject } from '/js/vercel-analytics.js';
    inject({ mode: 'auto' });
  `;
    document.head.appendChild(script);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVercelAnalytics);
}
else {
    initVercelAnalytics();
}
