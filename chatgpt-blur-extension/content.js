// content.js
(() => {
  // --- CONFIG: tweak these if needed ---
  // CSS blur amount and whether to use 'hide' instead of blur:
  const BLUR_AMOUNT = '8px';   // change to e.g. '12px' for stronger blur
  const USE_HIDE = false;      // set true to hide instead of blur (visibility: hidden)
  const TRANSITION = '200ms';
  // Selector candidates (robust heuristics). Add/remove selectors if ChatGPT UI changes:
  const CANDIDATE_SELECTORS = [
    'div[role="list"]',                  // commonly the message list
    'main',                              // fallback main area
    '.chat',                             // generic fallback
    'div[class*="conversation"]',
    'div[class*="Message"]',
    'div[class*="chat"]',
    'section'                            // broad fallback, will be filtered
  ];
  // Minimum element size to consider (avoid picking tiny elements)
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 50;
  // --- end CONFIG ---

  const styleId = 'cgpt-blur-style';
  const markerId = 'cgpt-blur-marker';

  // Add a style element for blur/hide classes
  function ensureStyle() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .cgpt-history-blur {
        transition: filter ${TRANSITION} ease, opacity ${TRANSITION} ease, visibility ${TRANSITION} ease;
        ${USE_HIDE ? 'opacity: 0.01; visibility: hidden;' : `filter: blur(${BLUR_AMOUNT});`}
        pointer-events: none; /* make blurred area non-interactive while blurred */
      }
      .cgpt-history-blur-hidden {
        opacity: 0.01;
        visibility: hidden;
        transition: opacity ${TRANSITION} ease, visibility ${TRANSITION} ease;
        pointer-events: none;
      }
      .cgpt-blur-focused {
        filter: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
      /* marker to avoid modifying same element twice */
      [data-cgpt-blur] { }
    `;
    document.head.appendChild(style);
  }

  // heuristically find best candidate container(s)
  function findHistoryContainers() {
    const found = new Set();
    for (const sel of CANDIDATE_SELECTORS) {
      const nodes = Array.from(document.querySelectorAll(sel || '*'));
      for (const n of nodes) {
        // skip if already using our marker
        if (n.hasAttribute('data-cgpt-blur')) continue;
        const rect = n.getBoundingClientRect();
        if (rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT) {
          // Heuristic: only take elements that are visible
          const style = window.getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          // Avoid top nav bars and tiny UI elements
          found.add(n);
        }
      }
    }
    // Convert to array and sort by area (largest first) — prioritize larger containers
    return Array.from(found).sort((a,b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.width*rb.height) - (ra.width*ra.height);
    });
  }

  // Apply data attribute and class to mark as our history container(s)
  function markContainers(containers) {
    containers.forEach((el) => {
      if (!el.hasAttribute('data-cgpt-blur')) {
        el.setAttribute('data-cgpt-blur', 'true');
        el.classList.add('cgpt-history-blur');
      }
    });
  }

  // Remove marking (used if UI changes and we re-scan)
  function unmarkAll() {
    const all = document.querySelectorAll('[data-cgpt-blur]');
    all.forEach((el) => {
      el.removeAttribute('data-cgpt-blur');
      el.classList.remove('cgpt-history-blur', 'cgpt-blur-focused', 'cgpt-history-blur-hidden');
    });
  }

  // Show (unblur) the container the pointer is over; blur others
  function handlePointerMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const ourContainers = Array.from(document.querySelectorAll('[data-cgpt-blur]'));
    // Find the nearest ancestor (or itself) which is marked
    let active = null;
    for (let node = el; node; node = node.parentElement) {
      if (node.hasAttribute && node.hasAttribute('data-cgpt-blur')) {
        active = node;
        break;
      }
    }
    // If pointer is inside any marked child (e.g., message inside the container),
    // active will be the container. If not, active stays null.
    ourContainers.forEach((c) => {
      if (active === c) {
        // unblur this container
        c.classList.remove('cgpt-history-blur');
        c.classList.add('cgpt-blur-focused');
      } else {
        // blur other containers
        if (!c.classList.contains('cgpt-history-blur')) {
          c.classList.add('cgpt-history-blur');
        }
        c.classList.remove('cgpt-blur-focused');
      }
    });

    // Additional safeguard: if pointer is over an input area (prompt box), we should also unblur
    // find nearest input/textarea
    if (el.closest && el.closest('textarea, input, [role="textbox"]')) {
      // unblur all (so prompt area stays usable)
      ourContainers.forEach((c) => {
        c.classList.remove('cgpt-history-blur');
        c.classList.add('cgpt-blur-focused');
      });
    }
  }

  // If mouse leaves window (pointerout to null), blur all
  function handlePointerOut(e) {
    if (!e.relatedTarget) {
      const ourContainers = Array.from(document.querySelectorAll('[data-cgpt-blur]'));
      ourContainers.forEach((c) => {
        if (!c.classList.contains('cgpt-history-blur')) c.classList.add('cgpt-history-blur');
        c.classList.remove('cgpt-blur-focused');
      });
    }
  }

  // Primary initialization flow: try to find containers; if none, observe DOM changes and retry
  function init() {
    ensureStyle();

    function attempt() {
      // unmark previous
      unmarkAll();
      const candidates = findHistoryContainers();
      // sensible cutoff: take up to 2 largest containers
      const chosen = candidates.slice(0, 2);
      if (chosen.length) {
        markContainers(chosen);
        // set initial state: blur all
        chosen.forEach((c) => {
          c.classList.add('cgpt-history-blur');
          c.classList.remove('cgpt-blur-focused');
        });
        // attach pointer listeners to document
        document.removeEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointermove', handlePointerMove, {passive: true});
        document.removeEventListener('pointerout', handlePointerOut);
        document.addEventListener('pointerout', handlePointerOut, {passive: true});
        return true;
      }
      return false;
    }

    if (!attempt()) {
      // If not found yet, observe mutations (ChatGPT loads content dynamically)
      const mo = new MutationObserver((mutations) => {
        if (attempt()) {
          mo.disconnect();
        }
      });
      mo.observe(document.documentElement || document.body, {childList: true, subtree: true});
      // Also set a timeout to run attempt again after a little while, in case mutation observer misses something
      setTimeout(() => attempt(), 1500);
    }
  }

  // Re-scan on navigation (single-page app) and when window focus/resize occurs
  function setupRescanTriggers() {
    const rescan = () => {
      try { init(); } catch(e) { console.error('cgpt-blur init error', e); }
    };
    window.addEventListener('popstate', rescan);
    window.addEventListener('hashchange', rescan);
    window.addEventListener('focus', rescan);
    window.addEventListener('resize', rescan);
  }

  // Start
  init();
  setupRescanTriggers();

  // Expose a quick debug function on window so user can manually re-scan from DevTools:
  window.__cgptBlurRescan = function() {
    unmarkAll();
    init();
    console.log('cgpt-blur: rescanned DOM');
  };

})();
