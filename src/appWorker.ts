/** Update the app shell without reloading an active conversation or touching study storage. */
let installed = false;
export function registerAppWorker(): void {
  if (installed || !('serviceWorker' in navigator)) return;
  installed = true;
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
      let lastCheck = Date.now();
      void registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastCheck > 60000) {
          lastCheck = Date.now();
          void registration.update().catch(() => {});
        }
      });
      // Never reload on controllerchange: the learner may be speaking or editing an article.
    } catch { /* Network or private-browsing restrictions must not prevent opening the app. */ }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => {void register();}, {once: true});
}
