import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router doesn't auto-scroll to `#hash` anchors on navigation, and on a
 * cold load the browser's native hash-scroll fires before the dynamic page
 * has mounted (so the target element doesn't exist yet). This effect runs
 * on every location change: it first tries an immediate query, then falls
 * back to a MutationObserver that watches the document until the target id
 * appears (capped at 5s so we don't observe forever).
 *
 * Mount once, near the top of the BrowserRouter tree.
 */
export function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    const scrollNow = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Fast path: already in the DOM (same-page hash click, or after a
    // re-render).
    const existing = document.getElementById(id);
    if (existing) {
      // Defer one frame so any layout shifts from the route transition
      // settle first, otherwise scrollIntoView can land off-target.
      requestAnimationFrame(() => scrollNow(existing));
      return;
    }

    // Slow path: target hasn't mounted yet (cold load, lazy section).
    // Observe the document for additions and scroll the moment we see it.
    const observer = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (el) {
        observer.disconnect();
        clearTimeout(safetyTimer);
        scrollNow(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Don't keep observing forever — if the target genuinely doesn't exist,
    // give up after 5s so we don't leak a long-lived observer.
    const safetyTimer = window.setTimeout(() => {
      observer.disconnect();
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(safetyTimer);
    };
  }, [pathname, hash, key]);

  return null;
}
