// public/js/dashboard.js
// Dashboard views — Owner panel, Editor panel, Reader panel

const Dashboard = (() => {
  let currentTab = 'files';
  let cachedFiles = [];
  let cachedUsers = [];

  // ─── Render Dashboard ─────────────────────────────────────
  const render = () => {
    const user = API.getUser();
    if (!user) {
      window.location.hash = 'login';
      return '';
    }

    const navItems = getNavItems(user.role);

    return `
      <!-- Mobile Menu Button -->
      <button class="mobile-menu-btn" id="mobile-menu-toggle" onclick="Dashboard.toggleSidebar()">☰</button>

      <!-- Sidebar Overlay (mobile) -->
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="Dashboard.toggleSidebar()"></div>

      <div class="dashboard">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo">
            <div class="sidebar-logo-icon">🔒</div>
            <span>CryptoVault</span>
          </div>

          <nav class="sidebar-nav">
            ${navItems.map(item => `
              <button class="nav-item ${item.id === currentTab ? 'active' : ''}"
                      onclick="Dashboard.switchTab('${item.id}')"
                      id="nav-${item.id}">
                <span class="nav-icon">${item.icon}</span>
                ${item.label}
                ${item.badge ? `<span class="nav-badge" id="badge-${item.id}">${item.badge}</span>` : ''}
              </button>
            `).join('')}
          </nav>

          <div class="sidebar-footer">
            <div class="user-info">
              <div class="user-avatar">${user.uid.charAt(0).toUpperCase()}</div>
              <div class="user-details">
                <div class="user-name">${user.uid}</div>
                <div class="user-role">${user.role}</div>
              </div>
            </div>
            ${user.role === 'owner' ? `
              <div class="system-code-display" style="padding: 0.5rem; margin: 0;">
                <div class="system-code-label" style="font-size: 0.7rem;">System Code</div>
                <div class="system-code-value" style="font-size: 1rem;">${user.systemCode}</div>
              </div>
            ` : ''}
            <button class="btn btn-secondary btn-full mt-2" onclick="Dashboard.logout()" style="margin-top: 0.75rem;">
              🚪 Sign Out
            </button>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content" id="main-content">
          <div id="tab-content"></div>
        </main>
      </div>
    `;
  };

  // ─── Nav Items per Role ───────────────────────────────────
  const getNavItems = (role) => {
    const items = [
      { id: 'files', icon: '📁', label: 'Files', roles: ['owner', 'user'] },
      { id: 'users', icon: '👥', label: 'Users', roles: ['owner'], badge: '' },
      { id: 'storage', icon: '📊', label: 'Storage', roles: ['owner'] },
      { id: 'logs', icon: '📋', label: 'Activity Logs', roles: ['owner'] },
    ];
    return items.filter(i => i.roles.includes(role));
  };

  // ─── Switch Tab ───────────────────────────────────────────
  const switchTab = (tabId) => {
    currentTab = tabId;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${tabId}`);
    if (navEl) navEl.classList.add('active');

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    loadTabContent(tabId);
  };

  // ─── Toggle Sidebar (mobile) ──────────────────────────────
  const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  };

  // ─── Load Tab Content ─────────────────────────────────────
  const loadTabContent = async (tabId) => {
    const container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML = `<div class="empty-state"><div class="loader-ring"></div><p class="mt-1">Loading...</p></div>`;

    try {
      switch (tabId) {
        case 'files':
          await loadFiles(container);
          break;
        case 'users':
          await loadUsers(container);
          break;
        case 'storage':
          await loadStorage(container);
          break;
        case 'logs':
          await loadLogs(container);
          break;
      }
    } catch (err) {
      container.innerHTML = Components.emptyState('❌', 'Error', err.message);
      Components.showToast(err.message, 'error');
    }
  };

  // ─── Init (called after DOM render) ───────────────────────
  const init = () => {
    loadTabContent(currentTab);
    loadPendingCount();
  };

  // ─── Load Pending Count (for badge) ───────────────────────
  const loadPendingCount = async () => {
    const user = API.getUser();
    if (user?.role !== 'owner') return;

    try {
      const data = await API.get('/admin/pending');
      const count = data.users?.length || 0;
      const badge = document.getElementById('badge-users');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
      }
    } catch {
      // Silent fail
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  FILES TAB & USER DASHBOARD
  // ═══════════════════════════════════════════════════════════
  const loadFiles = async (container) => {
    const user = API.getUser();
    const data = await API.get('/files');
    cachedFiles = data.files || [];

    const isOwner = user.role === 'owner';
    const canUpload = isOwner || (user.memberships || []).some(m => m.status === 'active' && m.role === 'editor');

    let html = `
      <div class="page-header">
        <h2>${isOwner ? '📁 System Files' : '📁 Accessed Files'}</h2>
        <div class="page-header-actions" style="display: flex; gap: 0.5rem;">
          ${!isOwner ? `<button class="btn btn-primary" onclick="Dashboard.showJoinModal()">🔗 Join System</button>` : ''}
          ${canUpload ? `<button class="btn btn-primary" onclick="Dashboard.showUploadModal()">⬆ Upload File</button>` : ''}
        </div>
      </div>
    `;

    // Show pending memberships for users
    if (!isOwner && user.memberships && user.memberships.length > 0) {
      const pendingMemberships = user.memberships.filter(m => m.status === 'pending');
      if (pendingMemberships.length > 0) {
        html += `<div style="background: var(--surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">⏳</span>
          <div>
            <h4 style="margin: 0; color: var(--text-primary);">Waiting for Approval</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">You have ${pendingMemberships.length} system join request${pendingMemberships.length > 1 ? 's' : ''} pending owner approval.</p>
          </div>
        </div>`;
      }
    }

    if (cachedFiles.length === 0) {
      html += Components.emptyState('📂', 'No Files Yet', canUpload ? 'Upload your first encrypted file.' : 'No files are shared with you yet. Try joining a system.');
    } else {
      html += `<div class="files-grid">`;
      cachedFiles.forEach(file => {
        html += Components.fileCard(file, file.canEdit, isOwner);
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  };

  // ─── Join System Modal ─────────────────────────────────────
  const showJoinModal = () => {
    Components.showModal(
      '🔗 Join System',
      `<form id="join-form">
        <div class="form-group">
          <label for="join-system-code">Owner's System Code</label>
          <input type="text" id="join-system-code" class="form-input" placeholder="Enter System Code" required>
        </div>
      </form>`,
      `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="Dashboard.submitJoin()">Request Access</button>`
    );
  };

  const submitJoin = async () => {
    const systemCode = document.getElementById('join-system-code').value.trim();
    if (!systemCode) {
      Components.showToast('Please enter a system code.', 'warning');
      return;
    }

    Components.closeModal();
    Components.showLoading('Requesting access...');

    try {
      const data = await API.post('/join-owner', { systemCode });
      const user = API.getUser();
      user.memberships = data.memberships;
      API.saveAuth({ token: localStorage.getItem('cv_token'), user });
      Components.showToast('Request submitted! Waiting for approval.', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  const showUploadModal = () => {
    const user = API.getUser();
    const isOwner = user.role === 'owner';
    const editorMemberships = (user.memberships || []).filter(m => m.status === 'active' && m.role === 'editor');

    let systemSelectHTML = '';
    if (!isOwner && editorMemberships.length > 0) {
      systemSelectHTML = `
        <div class="form-group">
           <label for="upload-owner">Upload To System (Owner ID)</label>
           <select id="upload-owner" class="form-select">
             ${editorMemberships.map(m => `<option value="${m.ownerId}">${m.ownerId}</option>`).join('')}
           </select>
        </div>
      `;
    }

    Components.showModal(
      '⬆ Upload File',
      `<form id="upload-form">
        ${systemSelectHTML}
        <div class="form-group">
          <label for="upload-file">Select File</label>
          <input type="file" id="upload-file" class="form-input" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.pptx,.ppt" required>
          <small style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem; display: block;">
            Supported: PDF, JPG, PNG, DOCX, PPT (Max 50MB)
          </small>
        </div>
        ${isOwner ? `
        <div class="form-group">
          <label for="upload-security">Security Level</label>
          <select id="upload-security" class="form-select">
            <option value="low">🟢 Low</option>
            <option value="medium" selected>🟡 Medium</option>
            <option value="high">🔴 High</option>
          </select>
        </div>` : `
        <div class="form-group">
          <label>Security Level</label>
          <div style="padding: 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted);">
            <em>Automatically assigned based on your access level</em>
          </div>
        </div>`}
      </form>`,
      `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="Dashboard.submitUpload()">🔐 Encrypt & Upload</button>`
    );
  };

  // ─── Submit Upload ────────────────────────────────────────
  const submitUpload = async () => {
    const fileInput = document.getElementById('upload-file');
    const securitySelect = document.getElementById('upload-security');
    const securityLevel = securitySelect ? securitySelect.value : 'medium';

    const ownerSelect = document.getElementById('upload-owner');

    if (!fileInput?.files[0]) {
      Components.showToast('Please select a file.', 'warning');
      return;
    }

    Components.closeModal();
    Components.showLoading('Encrypting and uploading...');

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('securityLevel', securityLevel);
      if (ownerSelect) {
        formData.append('ownerId', ownerSelect.value);
      }

      await API.upload('/upload', formData);
      Components.showToast('File uploaded and encrypted!', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  // ─── Download File ────────────────────────────────────────
  const downloadFile = async (fileId, fileName) => {
    Components.showLoading('Decrypting...');
    try {
      const response = await API.download(`/file/${fileId}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Components.showToast('File downloaded!', 'success');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  // ─── Delete File ──────────────────────────────────────────
  const deleteFile = (fileId, fileName) => {
    Components.showModal(
      '🗑 Confirm Delete',
      `<p style="color: var(--text-secondary);">Are you sure you want to delete <strong>"${fileName}"</strong>? This action cannot be undone.</p>`,
      `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
       <button class="btn btn-danger" onclick="Dashboard.confirmDelete('${fileId}')">Delete</button>`
    );
  };

  const confirmDelete = async (fileId) => {
    Components.closeModal();
    Components.showLoading('Deleting...');
    try {
      await API.del(`/file/${fileId}`);
      Components.showToast('File deleted.', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  // ─── Modify File ──────────────────────────────────────────
  const modifyFile = (fileId) => {
    Components.showModal(
      '✏️ Modify File',
      `<p style="color: var(--text-secondary); margin-bottom: 1rem;">Upload a new version to replace the existing file.</p>
       <div class="form-group">
         <label for="modify-file">Select New File</label>
         <input type="file" id="modify-file" class="form-input" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.pptx,.ppt" required>
       </div>`,
      `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="Dashboard.submitModify('${fileId}')">🔐 Encrypt & Replace</button>`
    );
  };

  const submitModify = async (fileId) => {
    const fileInput = document.getElementById('modify-file');
    if (!fileInput?.files[0]) {
      Components.showToast('Please select a file.', 'warning');
      return;
    }

    Components.closeModal();
    Components.showLoading('Encrypting and replacing...');

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      await API.uploadPut(`/file/${fileId}`, formData);
      Components.showToast('File modified!', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  // ─── Change Security Level (Owner Only) ───────────────────
  const showChangeSecurityModal = (fileId, currentLevel) => {
    Components.showModal(
      '🔐 Change Confidentiality',
      `<p style="color: var(--text-secondary); margin-bottom: 1rem;">Update the security level of this file. Cannot be exceeded by users lacking corresponding clearance.</p>
       <div class="form-group">
         <label for="change-security">New Confidentiality Level</label>
         <select id="change-security" class="form-select">
           <option value="low" ${currentLevel === 'low' ? 'selected' : ''}>🟢 Low</option>
           <option value="medium" ${currentLevel === 'medium' ? 'selected' : ''}>🟡 Medium</option>
           <option value="high" ${currentLevel === 'high' ? 'selected' : ''}>🔴 High</option>
         </select>
       </div>`,
      `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="Dashboard.submitChangeSecurity('${fileId}')">Save Selection</button>`
    );
  };

  const submitChangeSecurity = async (fileId) => {
    const securityLevel = document.getElementById('change-security').value;
    Components.closeModal();
    Components.showLoading('Updating...');
    try {
      await API.patch(`/file/${fileId}/security`, { securityLevel });
      Components.showToast('Confidentiality level updated!', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    } finally {
      Components.hideLoading();
    }
  };

  // ─── Manage Permissions ───────────────────────────────────
  const managePermissions = async (fileId) => {
    try {
      // Fetch users and file info
      const usersData = await API.get('/admin/users');
      const users = usersData.users.filter(u => u.status === 'active');

      const file = cachedFiles.find(f => f.id === fileId);
      if (!file) return;

      const readIds = (file.permissions?.read || []).map(id => id.toString());
      const editIds = (file.permissions?.edit || []).map(id => id.toString());

      let usersHTML = '';
      if (users.length === 0) {
        usersHTML = '<p style="color: var(--text-muted);">No users in your system yet.</p>';
      } else {
        usersHTML = `
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">📖 Read Access</label>
            <div class="permissions-list" id="perm-read-list">
              ${users.map(u => `
                <div class="permission-item">
                  <input type="checkbox" id="read-${u._id}" value="${u._id}" ${readIds.includes(u._id) ? 'checked' : ''}>
                  <label for="read-${u._id}">${u.uid} <span class="badge badge-${u.role}">${u.role}</span></label>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">✏️ Edit Access</label>
            <div class="permissions-list" id="perm-edit-list">
              ${users.map(u => `
                <div class="permission-item">
                  <input type="checkbox" id="edit-${u._id}" value="${u._id}" ${editIds.includes(u._id) ? 'checked' : ''}>
                  <label for="edit-${u._id}">${u.uid} <span class="badge badge-${u.role}">${u.role}</span></label>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      Components.showModal(
        `🔐 Permissions: ${file.originalName}`,
        usersHTML,
        `<button class="btn btn-secondary" onclick="Components.closeModal()">Cancel</button>
         <button class="btn btn-primary" onclick="Dashboard.savePermissions('${fileId}')">Save Permissions</button>`
      );
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  const savePermissions = async (fileId) => {
    const readChecks = document.querySelectorAll('#perm-read-list input:checked');
    const editChecks = document.querySelectorAll('#perm-edit-list input:checked');

    const read = Array.from(readChecks).map(c => c.value);
    const edit = Array.from(editChecks).map(c => c.value);

    Components.closeModal();

    try {
      await API.put(`/file/${fileId}/permissions`, { read, edit });
      Components.showToast('Permissions updated!', 'success');
      loadTabContent('files');
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  USERS TAB
  // ═══════════════════════════════════════════════════════════
  const loadUsers = async (container) => {
    const data = await API.get('/admin/users');
    cachedUsers = data.users || [];

    const pending = cachedUsers.filter(u => u.status === 'pending');
    const active = cachedUsers.filter(u => u.status === 'active');
    const rejected = cachedUsers.filter(u => u.status === 'rejected');

    let html = `
      <div class="page-header">
        <h2>👥 User Management</h2>
      </div>

      <div class="stats-grid">
        ${Components.statCard('👥', active.length, 'Active Users', 'blue')}
        ${Components.statCard('⏳', pending.length, 'Pending Approvals', 'cyan')}
        ${Components.statCard('❌', rejected.length, 'Rejected', 'purple')}
      </div>
    `;

    // Pending Users
    if (pending.length > 0) {
      html += `
        <div class="table-container mb-2">
          <div class="table-header">
            <h3>⏳ Pending Approvals</h3>
          </div>
          <table>
            <thead>
              <tr><th>User ID</th><th>Registered</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${pending.map(u => `
                <tr>
                  <td><strong>${u.uid}</strong></td>
                  <td>${Components.formatDate(u.createdAt)}</td>
                  <td>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <select id="permission-${u._id}" class="form-select" style="width: 120px; padding: 0.4rem 0.6rem; font-size: 0.8rem;">
                        <option value="low">🟢 Low</option>
                        <option value="medium" selected>🟡 Medium</option>
                        <option value="high">🔴 High</option>
                      </select>
                      <select id="role-${u._id}" class="form-select" style="width: 100px; padding: 0.4rem 0.6rem; font-size: 0.8rem; margin-right: 0.5rem;">
                        <option value="reader" selected>📖 Reader</option>
                        <option value="editor">✏️ Editor</option>
                      </select>
                      <button class="btn btn-sm btn-success" onclick="Dashboard.approveUser('${u._id}')">✓ Approve</button>
                      <button class="btn btn-sm btn-danger" onclick="Dashboard.rejectUser('${u._id}')">✕ Reject</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Active Users
    if (active.length > 0) {
      html += `
        <div class="table-container">
          <div class="table-header">
            <h3>✅ Active Users</h3>
          </div>
          <table>
            <thead>
              <tr><th>User ID</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${active.map(u => `
                <tr>
                  <td><strong>${u.uid}</strong></td>
                  <td><span class="badge badge-${u.permissionLevel}">${u.permissionLevel}</span> <span class="badge badge-pending">${u.role || 'reader'}</span></td>
                  <td>${Components.formatDate(u.joinedAt)}</td>
                  <td>
                    <select class="form-select" style="width: 120px; padding: 0.4rem 0.6rem; font-size: 0.8rem;"
                            onchange="Dashboard.changePermission('${u._id}', this.value)">
                      <option value="low" ${u.permissionLevel === 'low' ? 'selected' : ''}>🟢 Low</option>
                      <option value="medium" ${u.permissionLevel === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                      <option value="high" ${u.permissionLevel === 'high' ? 'selected' : ''}>🔴 High</option>
                    </select>
                    <select class="form-select" style="width: 100px; padding: 0.4rem 0.6rem; font-size: 0.8rem; margin-top: 0.25rem;"
                            onchange="Dashboard.changePermission('${u._id}', null, this.value)">
                      <option value="reader" ${u.role === 'reader' ? 'selected' : ''}>📖 Reader</option>
                      <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>✏️ Editor</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (pending.length === 0) {
      html += Components.emptyState('👥', 'No Users Yet', 'Share your system code to invite users.');
    }

    container.innerHTML = html;
  };

  const approveUser = async (userId) => {
    const permSelect = document.getElementById(`permission-${userId}`);
    const roleSelect = document.getElementById(`role-${userId}`);
    const permissionLevel = permSelect ? permSelect.value : 'low';
    const role = roleSelect ? roleSelect.value : 'reader';

    try {
      await API.post('/approve-user', { userId, permissionLevel, role });
      Components.showToast(`User approved with ${permissionLevel} permission!`, 'success');
      loadTabContent('users');
      loadPendingCount();
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  // ─── Reject User ─────────────────────────────────────────
  const rejectUser = async (userId) => {
    try {
      await API.post('/reject-user', { userId });
      Components.showToast('User rejected.', 'success');
      loadTabContent('users');
      loadPendingCount();
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  // ─── Change Permission ────────────────────────────────────
  const changePermission = async (userId, permissionLevel, role) => {
    try {
      const payload = {};
      if (permissionLevel) payload.permissionLevel = permissionLevel;
      if (role) payload.role = role;
      
      // We need to fetch current dropdown values if they are changing only one of them.
      // Wait, let's just make it simpler: the UI fires onchange for each independently,
      // and we just pass the one that changed, the backend is resilient.
      await API.put(`/admin/users/${userId}/permission`, payload);
      Components.showToast('Access privileges updated.', 'success');
      loadTabContent('users');
    } catch (err) {
      Components.showToast(err.message, 'error');
      loadTabContent('users');
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  STORAGE TAB
  // ═══════════════════════════════════════════════════════════
  const loadStorage = async (container) => {
    const data = await API.get('/admin/storage');

    let html = `
      <div class="page-header">
        <h2>📊 Storage Overview</h2>
      </div>

      <div class="stats-grid">
        ${Components.statCard('💾', Components.formatSize(data.totalStorage), 'Total Storage Used', 'blue')}
        ${Components.statCard('📁', data.totalFiles, 'Total Files', 'cyan')}
        ${Components.statCard('👥', data.perUserStorage?.length || 0, 'Active Uploaders', 'purple')}
      </div>
    `;

    if (data.perUserStorage && data.perUserStorage.length > 0) {
      const maxUserStorage = Math.max(...data.perUserStorage.map(u => u.totalSize));

      html += `
        <div class="table-container">
          <div class="table-header">
            <h3>📊 Per-User Storage</h3>
          </div>
          <div style="padding: 1.25rem;">
            ${data.perUserStorage.map(u =>
              Components.storageBar(
                `${u.uid} (${u.fileCount} files)`,
                u.totalSize,
                maxUserStorage
              )
            ).join('')}
          </div>
        </div>
      `;
    } else {
      html += Components.emptyState('📊', 'No Storage Data', 'Upload files to see storage stats.');
    }

    container.innerHTML = html;
  };

  // ═══════════════════════════════════════════════════════════
  //  LOGS TAB
  // ═══════════════════════════════════════════════════════════
  const loadLogs = async (container) => {
    const data = await API.get('/logs');
    const logs = data.logs || [];

    let html = `
      <div class="page-header">
        <h2>📋 Activity Logs</h2>
      </div>
    `;

    if (logs.length === 0) {
      html += Components.emptyState('📋', 'No Activity Yet', 'File operations will be logged here.');
    } else {
      const actionIcons = {
        upload: '⬆️',
        download: '⬇️',
        delete: '🗑️',
        edit: '✏️',
      };

      html += `
        <div class="table-container">
          <div class="table-header">
            <h3>📋 Recent Activity</h3>
            <span style="color: var(--text-muted); font-size: 0.85rem;">${logs.length} entries</span>
          </div>
          <table>
            <thead>
              <tr><th>Action</th><th>User</th><th>File</th><th>Time</th></tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>${actionIcons[log.action] || '📌'} <span class="badge badge-${log.action === 'upload' ? 'active' : log.action === 'delete' ? 'rejected' : 'pending'}">${log.action}</span></td>
                  <td><strong>${log.userName}</strong></td>
                  <td>${log.fileName || '—'}</td>
                  <td>${Components.formatDate(log.timestamp)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = html;
  };

  // ─── Logout ───────────────────────────────────────────────
  const logout = () => {
    API.clearAuth();
    currentTab = 'files';
    Components.showToast('Signed out.', 'info');
    window.location.hash = 'login';
  };

  return {
    render, init, switchTab, toggleSidebar,
    showUploadModal, submitUpload,
    downloadFile, deleteFile, confirmDelete,
    modifyFile, submitModify, showChangeSecurityModal, submitChangeSecurity,
    approveUser, rejectUser, changePermission, showJoinModal, submitJoin,
    logout,
  };
})();
