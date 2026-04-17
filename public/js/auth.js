// public/js/auth.js
// Authentication views — Login and Register forms

const Auth = (() => {

  // ─── Render Login Page ────────────────────────────────────
  const renderLogin = () => {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <div class="logo">
            <div class="logo-icon">🔒</div>
            <h1>CryptoVault</h1>
            <p>Secure File Sharing System</p>
          </div>

          <form id="login-form" autocomplete="off">
            <div class="form-group">
              <label for="login-uid">User ID</label>
              <input type="text" id="login-uid" class="form-input" placeholder="Enter your UID" required>
            </div>

            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="Enter your password" required>
            </div>

            <button type="submit" class="btn btn-primary btn-full" id="login-submit">
              🔓 Sign In
            </button>
          </form>

          <div class="auth-footer">
            Don't have an account? <a onclick="window.location.hash='register'">Register here</a>
          </div>
        </div>
      </div>
    `;
  };

  // ─── Render Register Page ─────────────────────────────────
  const renderRegister = () => {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <div class="logo">
            <div class="logo-icon">🔒</div>
            <h1>CryptoVault</h1>
            <p>Create your account</p>
          </div>

          <div class="toggle-group">
            <button class="toggle-btn active" id="toggle-owner" onclick="Auth.toggleRegisterType('owner')">
              👑 Owner
            </button>
            <button class="toggle-btn" id="toggle-user" onclick="Auth.toggleRegisterType('user')">
              👤 User
            </button>
          </div>

          <!-- Owner Registration Form -->
          <form id="register-owner-form" autocomplete="off">
            <div class="form-group">
              <label for="owner-uid">User ID</label>
              <input type="text" id="owner-uid" class="form-input" placeholder="Choose your UID" required minlength="3">
            </div>

            <div class="form-group">
              <label for="owner-password">Password</label>
              <input type="password" id="owner-password" class="form-input" placeholder="Minimum 6 characters" required minlength="6">
            </div>

            <button type="submit" class="btn btn-primary btn-full" id="owner-submit">
              👑 Register as Owner
            </button>
          </form>

          <!-- User Registration Form (hidden by default) -->
          <form id="register-user-form" class="hidden" autocomplete="off">
            <div class="form-group">
              <label for="user-uid">User ID</label>
              <input type="text" id="user-uid" class="form-input" placeholder="Choose your UID" required minlength="3">
            </div>

            <div class="form-group">
              <label for="user-password">Password</label>
              <input type="password" id="user-password" class="form-input" placeholder="Minimum 6 characters" required minlength="6">
            </div>

            <div class="form-group">
              <label for="user-confirm-password">Confirm Password</label>
              <input type="password" id="user-confirm-password" class="form-input" placeholder="Re-enter your password" required>
            </div>

            <button type="submit" class="btn btn-primary btn-full" id="user-submit">
              👤 Register as User
            </button>
          </form>

          <div class="auth-footer">
            Already have an account? <a onclick="window.location.hash='login'">Sign in</a>
          </div>
        </div>
      </div>
    `;
  };

  // ─── Toggle Register Type ────────────────────────────────
  const toggleRegisterType = (type) => {
    const ownerBtn = document.getElementById('toggle-owner');
    const userBtn = document.getElementById('toggle-user');
    const ownerForm = document.getElementById('register-owner-form');
    const userForm = document.getElementById('register-user-form');

    if (type === 'owner') {
      ownerBtn.classList.add('active');
      userBtn.classList.remove('active');
      ownerForm.classList.remove('hidden');
      userForm.classList.add('hidden');
    } else {
      userBtn.classList.add('active');
      ownerBtn.classList.remove('active');
      userForm.classList.remove('hidden');
      ownerForm.classList.add('hidden');
    }
  };

  // ─── Attach Login Event ──────────────────────────────────
  const attachLoginEvents = () => {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = document.getElementById('login-uid').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-submit');

      if (!uid || !password) {
        Components.showToast('Please fill in all fields.', 'warning');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const data = await API.post('/login', { uid, password });
        API.saveAuth(data);
        Components.showToast('Login successful!', 'success');
        window.location.hash = 'dashboard';
      } catch (err) {
        Components.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔓 Sign In';
      }
    });
  };

  // ─── Attach Register Events ──────────────────────────────
  const attachRegisterEvents = () => {
    // Owner registration
    const ownerForm = document.getElementById('register-owner-form');
    if (ownerForm) {
      ownerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('owner-uid').value.trim();
        const password = document.getElementById('owner-password').value;
        const btn = document.getElementById('owner-submit');

        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
          const data = await API.post('/register-owner', { uid, password });
          API.saveAuth(data);

          // Show system code in a modal
          Components.showModal(
            '🎉 Registration Successful!',
            `<p style="color: var(--text-secondary); margin-bottom: 1rem;">
              Your owner account has been created. Share this system code with your team members so they can register.
            </p>
            <div class="system-code-display">
              <div class="system-code-label">Your System Code</div>
              <div class="system-code-value">${data.user.systemCode}</div>
            </div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">
              ⚠️ Keep this code safe. Users need it to join your system.
            </p>`,
            `<button class="btn btn-primary" onclick="Components.closeModal(); window.location.hash='dashboard';">Go to Dashboard</button>`
          );

          Components.showToast('Owner account created!', 'success');
        } catch (err) {
          Components.showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '👑 Register as Owner';
        }
      });
    }

    // User registration
    const userForm = document.getElementById('register-user-form');
    if (userForm) {
      userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('user-uid').value.trim();
        const password = document.getElementById('user-password').value;
        const confirmPassword = document.getElementById('user-confirm-password').value;
        const btn = document.getElementById('user-submit');

        if (password !== confirmPassword) {
          Components.showToast('Passwords do not match.', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Registering...';

        try {
          await API.post('/register-user', { uid, password, confirmPassword });
          Components.showToast('Account created successfully! Please sign in.', 'success');
          setTimeout(() => {
            window.location.hash = 'login';
          }, 2000);
        } catch (err) {
          Components.showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '👤 Register as User';
        }
      });
    }
  };

  return { renderLogin, renderRegister, toggleRegisterType, attachLoginEvents, attachRegisterEvents };
})();
