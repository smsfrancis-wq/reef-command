/* Reef Command v2.3.1 — distinctive, accessible, icon-only mobile navigation.
   This enhancer leaves app.js, sync.js and Photo Journal data untouched. */
'use strict';
(() => {
  if (typeof NAV === 'undefined' || typeof render !== 'function') {
    console.warn('Reef Command navigation not yet available.');
    return;
  }

  const svg = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const ICONS = {
    dashboard: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    chemistry: svg('<path d="M3 3v18h18"/><path d="m6.5 15.5 4-4 3 2.5L19.5 7"/><path d="M16.5 7h3v3"/>'),
    maintenance: svg('<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.4-6.4l-3.2 3.2-3-3z"/>'),
    equipment: svg('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
    livestock: svg('<path d="M6 12c3-5.5 7.5-7.5 14-4-1 1.2-1.5 2.5-1.5 4s.5 2.8 1.5 4c-6.5 3.5-11 1.5-14-4z"/><path d="M6 12 2.5 8.5v7z"/><circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none"/>'),
    photos: svg('<path d="M4 7h3l1.5-2h7L17 7h3a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7z"/><circle cx="12" cy="13" r="4"/>'),
    settings: svg('<path d="M9.7 3h4.6l.7 2.1c.5.2 1 .5 1.4.8l2.2-.4 2.3 4-1.5 1.6a7.5 7.5 0 0 1 0 1.8l1.5 1.6-2.3 4-2.2-.4c-.4.3-.9.6-1.4.8L14.3 21H9.7L9 18.9a7.5 7.5 0 0 1-1.4-.8l-2.2.4-2.3-4 1.5-1.6a7.5 7.5 0 0 1 0-1.8L3.1 9.5l2.3-4 2.2.4c.4-.3.9-.6 1.4-.8z"/><circle cx="12" cy="12" r="2.8"/>')
  };

  for (const row of NAV) {
    const icon = ICONS[row[0]];
    if (icon) row[2] = icon;
  }

  // The underlying renderer preserves the text label in the button for screen
  // readers. CSS hides only the visible label on narrow screens.
  const originalRender = render;
  render = function (...args) {
    const result = originalRender.apply(this, args);
    for (const navId of ['desktopNav', 'mobileNav']) {
      const nav = document.getElementById(navId);
      if (!nav) continue;
      for (const button of nav.querySelectorAll('button[data-nav]')) {
        const entry = NAV.find(row => row[0] === button.dataset.nav);
        if (entry) {
          button.setAttribute('aria-label', entry[1]);
          button.setAttribute('title', entry[1]);
        }
      }
    }
    return result;
  };

  render();
})();
