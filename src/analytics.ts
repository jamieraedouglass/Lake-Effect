// Vercel Web Analytics initialization
// This will inject the Vercel Analytics script into the page

function initVercelAnalytics(): void {
  // Create and inject the analytics script
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { inject } from '/js/vercel-analytics.js';
    inject({ mode: 'auto' });
  `;
  document.head.appendChild(script);
}

// Initialize analytics when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVercelAnalytics);
} else {
  initVercelAnalytics();
}
