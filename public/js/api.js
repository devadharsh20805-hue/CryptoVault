// public/js/api.js
// API client — fetch wrapper with JWT and error handling

const API = (() => {
  const BASE = '/api';

  // ─── Get stored JWT token ─────────────────────────────────
  const getToken = () => localStorage.getItem('cv_token');

  // ─── Common headers ───────────────────────────────────────
  const headers = (isJson = true) => {
    const h = {};
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (isJson) h['Content-Type'] = 'application/json';
    return h;
  };

  // ─── Handle API response ──────────────────────────────────
  const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.error || `Request failed (${res.status})`;
      throw new Error(errorMsg);
    }
    return data;
  };

  // ─── HTTP Methods ─────────────────────────────────────────
  const get = async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers: headers() });
    return handleResponse(res);
  };

  const post = async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  const put = async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  const patch = async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  const del = async (path) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return handleResponse(res);
  };

  // ─── File Upload (multipart) ──────────────────────────────
  const upload = async (path, formData) => {
    const h = {};
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    // Do NOT set Content-Type — browser sets it with boundary

    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: h,
      body: formData,
    });
    return handleResponse(res);
  };

  // ─── File Re-upload (PUT multipart) ───────────────────────
  const uploadPut = async (path, formData) => {
    const h = {};
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: h,
      body: formData,
    });
    return handleResponse(res);
  };

  // ─── Download File (returns blob) ─────────────────────────
  const download = async (path) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: headers(false),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed');
    }
    return res;
  };

  // ─── Auth Helpers ─────────────────────────────────────────
  const saveAuth = (data) => {
    localStorage.setItem('cv_token', data.token);
    localStorage.setItem('cv_user', JSON.stringify(data.user));
  };

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem('cv_user'));
    } catch {
      return null;
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
  };

  const isLoggedIn = () => !!getToken();

  return { get, post, put, patch, del, upload, uploadPut, download, saveAuth, getUser, clearAuth, isLoggedIn };
})();
