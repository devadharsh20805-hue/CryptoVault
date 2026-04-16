// public/js/app.js
// SPA Router — hash-based navigation and initialization

const App = (() => {

  // ─── Route Handler ────────────────────────────────────────
  const route = () => {
    const hash = window.location.hash.replace('#', '') || 'login';
    const appEl = document.getElementById('app');

    // Redirect to login if not authenticated (except login/register)
    if (!['login', 'register'].includes(hash) && !API.isLoggedIn()) {
      window.location.hash = 'login';
      return;
    }

    // Redirect to dashboard if already logged in
    if (['login', 'register'].includes(hash) && API.isLoggedIn()) {
      window.location.hash = 'dashboard';
      return;
    }

    // Render appropriate page
    switch (hash) {
      case 'login':
        appEl.innerHTML = Auth.renderLogin();
        Auth.attachLoginEvents();
        break;

      case 'register':
        appEl.innerHTML = Auth.renderRegister();
        Auth.attachRegisterEvents();
        break;

      case 'dashboard':
        appEl.innerHTML = Dashboard.render();
        // Initialize dashboard after DOM is ready
        requestAnimationFrame(() => Dashboard.init());
        break;

      default:
        window.location.hash = API.isLoggedIn() ? 'dashboard' : 'login';
        break;
    }
  };

  // ─── Initialize App ──────────────────────────────────────
  const init = () => {
    window.addEventListener('hashchange', route);
    route(); // Initial route
  };

  return { init };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
