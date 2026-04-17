// public/js/components.js
// Reusable UI components — Toast, Modal, FileCard, StatCard, etc.

const Components = (() => {

  // ─── Toast Notifications ──────────────────────────────────
  const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    // Auto-remove after 4s
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // ─── Loading Overlay ──────────────────────────────────────
  const showLoading = (text = 'Processing...') => {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('.loader-text').textContent = text;
    overlay.classList.remove('hidden');
  };

  const hideLoading = () => {
    document.getElementById('loading-overlay').classList.add('hidden');
  };

  // ─── Modal ────────────────────────────────────────────────
  const showModal = (title, contentHTML, footerHTML = '') => {
    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">${contentHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('#modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    return overlay;
  };

  const closeModal = () => {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
  };

  // ─── Stat Card ────────────────────────────────────────────
  const statCard = (icon, value, label, colorClass = 'blue') => `
    <div class="stat-card">
      <div class="stat-card-icon ${colorClass}">${icon}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>
  `;

  // ─── File Type Icon ───────────────────────────────────────
  const fileIcon = (type) => {
    const icons = {
      pdf: '📄',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      docx: '📝',
      doc: '📝',
      pptx: '📊',
      ppt: '📊',
    };
    return icons[type?.toLowerCase()] || '📁';
  };

  // ─── Format File Size ────────────────────────────────────
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // ─── Format Date ─────────────────────────────────────────
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ─── File Card ────────────────────────────────────────────
  const fileCard = (file, canEdit = false, isOwner = false) => {
    const securityBadge = `<span class="badge badge-${file.securityLevel}">${file.securityLevel}</span>`;
    const typeBadge = `<span class="badge badge-${file.fileType}">${file.fileType.toUpperCase()}</span>`;

    let actions = `<button class="btn btn-sm btn-primary" onclick="Dashboard.downloadFile('${file.id}', '${file.originalName}')">⬇ Download</button>`;

    if (isOwner) {
      actions += `
        <button class="btn btn-sm btn-secondary" onclick="Dashboard.showChangeSecurityModal('${file.id}', '${file.securityLevel}')">🔐 Level</button>
      `;
    }

    if (canEdit || isOwner) {
      actions += `
        <button class="btn btn-sm btn-secondary" onclick="Dashboard.modifyFile('${file.id}')">✏️ Modify</button>
        <button class="btn btn-sm btn-danger" onclick="Dashboard.deleteFile('${file.id}', '${file.originalName}')">🗑 Delete</button>
      `;
    }

    return `
      <div class="file-card">
        <div class="file-card-header">
          <div class="file-card-icon">${fileIcon(file.fileType)}</div>
          <div>${securityBadge}</div>
        </div>
        <div class="file-card-name">${file.originalName}</div>
        <div class="file-card-meta">
          ${typeBadge}
          <span>📦 ${formatSize(file.fileSize)}</span>
          <span>👤 ${file.uploadedBy}</span>
          <span>📅 ${formatDate(file.uploadedAt)}</span>
        </div>
        <div class="file-card-actions">${actions}</div>
      </div>
    `;
  };

  // ─── Storage Bar ──────────────────────────────────────────
  const storageBar = (label, size, maxSize) => {
    const percent = maxSize > 0 ? Math.min((size / maxSize) * 100, 100) : 0;
    return `
      <div class="storage-bar-container">
        <div class="storage-bar-header">
          <span>${label}</span>
          <span>${formatSize(size)}</span>
        </div>
        <div class="storage-bar">
          <div class="storage-bar-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  };

  // ─── Empty State ──────────────────────────────────────────
  const emptyState = (icon, title, description) => `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
  `;

  return {
    showToast, showLoading, hideLoading,
    showModal, closeModal,
    statCard, fileIcon, formatSize, formatDate,
    fileCard, storageBar, emptyState,
  };
})();
