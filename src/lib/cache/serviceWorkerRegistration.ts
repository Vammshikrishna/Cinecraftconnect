/**
 * SERVICE WORKER REGISTRATION
 * Registers the SW on first load and triggers cache hydration.
 * Separated from main.tsx so it doesn't block the render tree.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Register after the page is interactive — don't block first render
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',  // Always check for SW update on load
      });

      // Silent update check every 60 minutes
      setInterval(() => reg.update(), 60 * 60 * 1000);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW ready — notify app to show "refresh available" if desired
            window.dispatchEvent(new CustomEvent('sw:update-available'));
          }
        });
      });
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}
