/**
 * API communication layer
 */

const API_BASE = window.location.port === '3001' 
    ? `${window.location.protocol}//${window.location.host}/api`
    : 'http://localhost:3001/api';

// Token Management
const Auth = {
  getToken: () => localStorage.getItem('token'),
  setToken: (t) => localStorage.setItem('token', t),
  removeToken: () => localStorage.removeItem('token'),
  getUser: () => {
      try {
          return JSON.parse(localStorage.getItem('user'));
      } catch { return null; }
  },
  setUser: (u) => localStorage.setItem('user', JSON.stringify(u)),
  removeUser: () => localStorage.removeItem('user'),
  isLoggedIn: () => !!localStorage.getItem('token'),
  isAdmin: () => {
      const u = Auth.getUser();
      return u && u.role === 'admin';
  },
  logout: () => {
      Auth.removeToken();
      Auth.removeUser();
      window.location.href = '/login.html';
  },
};

//Core Fetch Wrapper 
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = Auth.getToken();

  const config = {
      headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
      },
      ...options,
  };

  if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
  }

  try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
          // Auto-logout on 401 (expired/invalid token)
          if (response.status === 401 && token) {
              showToast('Session expired. Please login again.', 'warning');
              setTimeout(() => Auth.logout(), 1500);
          }
          throw Object.assign(new Error(data.message || 'Request failed'), { status: response.status, data });
      }

      return data;
  } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('Cannot connect to server. Make sure the backend is running.');
      }
      throw error;
  }
}

//API Endpoints 
const API = {
  // Auth
  auth: {
      register: (data) => apiFetch('/auth/register', { method: 'POST', body: data }),
      login: (data) => apiFetch('/auth/login', { method: 'POST', body: data }),
      me: () => apiFetch('/auth/me'),
      logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  },

  // Donors
  donors: {
      search: (params) => apiFetch(`/donors/search?${new URLSearchParams(params)}`),
      stats: (city) => apiFetch(`/donors/stats${city ? `?city=${city}` : ''}`),
      get: (id) => apiFetch(`/donors/${id}`),
      update: (id, data) => apiFetch(`/donors/${id}`, { method: 'PUT', body: data }),
      setAvailability: (id, isAvailable) => apiFetch(`/donors/${id}/availability`, { method: 'PUT', body: { isAvailable } }),
      history: (id) => apiFetch(`/donors/${id}/history`),
  },

  // Blood Requests
  requests: {
      create: (data) => apiFetch('/requests', { method: 'POST', body: data }),
      getOpen: (params = {}) => apiFetch(`/requests/open?${new URLSearchParams(params)}`),
      getAll: (params = {}) => apiFetch(`/requests?${new URLSearchParams(params)}`),
      get: (id) => apiFetch(`/requests/${id}`),
      update: (id, data) => apiFetch(`/requests/${id}`, { method: 'PUT', body: data }),
      respond: (id) => apiFetch(`/requests/${id}/respond`, { method: 'POST' }),
  },

  // Admin
  admin: {
      dashboard: () => apiFetch('/admin/dashboard'),
      users: (params = {}) => apiFetch(`/admin/users?${new URLSearchParams(params)}`),
      updateUser: (id, data) => apiFetch(`/admin/users/${id}`, { method: 'PUT', body: data }),
      deactivateUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
      sendAlert: (data) => apiFetch('/admin/alerts', { method: 'POST', body: data }),
      donations: (params = {}) => apiFetch(`/admin/donations?${new URLSearchParams(params)}`),
  },

  // Hospitals
  hospitals: {
      getAll: (params = {}) => apiFetch(`/hospitals?${new URLSearchParams(params)}`),
      get: (id) => apiFetch(`/hospitals/${id}`),
      getStock: (id) => apiFetch(`/hospitals/${id}/stock`),
      updateStock: (id, data) => apiFetch(`/hospitals/${id}/stock`, { method: 'PUT', body: data }),
  },
};

//Toast Notifications 
function showToast(message, type = 'info', title = null, duration = 4000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const defaultTitles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

  let container = document.getElementById('toast-container');
  if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.innerHTML = `
  <span class="toast-icon">${icons[type]}</span>
  <div class="toast-body">
    <div class="toast-title">${title || defaultTitles[type]}</div>
    <div class="toast-message">${message}</div>
  </div>
`;

  toast.addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.classList.add('fade-out');
  setTimeout(() => toast.remove(), 400);
}

//UI Utilities 

/**
 * Format date to readable string
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Format relative time (e.g. "2 hours ago")
 */
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  const intervals = [
      [31536000, 'year'], [2592000, 'month'], [86400, 'day'],
      [3600, 'hour'], [60, 'minute'], [1, 'second'],
  ];
  for (const [secs, unit] of intervals) {
      const n = Math.floor(seconds / secs);
      if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * Set loading state on a button
 */
function setButtonLoading(btn, loading) {
  if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.classList.add('btn-loading');
      btn.querySelector('.btn-text') && (btn.querySelector('.btn-text').textContent = '');
  } else {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

/**
 * Render blood group badge HTML
 */
function bloodBadgeHtml(group, size = '') {
  return `<span class="blood-badge ${size}">${group}</span>`;
}

/**
 * Get urgency badge HTML
 */
function urgencyBadgeHtml(urgency) {
  return `<span class="badge badge-${urgency}">${urgency.toUpperCase()}</span>`;
}

/**
 * Get status badge HTML
 */
function statusBadgeHtml(status) {
  const map = {
      pending: 'badge-pending',
      'in-progress': 'badge-urgent',
      fulfilled: 'badge-fulfilled',
      cancelled: 'badge-unavailable',
  };
  return `<span class="badge ${map[status] || ''}">${capitalize(status)}</span>`;
}

/**
 * Redirect if not logged in
 */
function requireAuth(redirectTo = '/login.html') {
  if (!Auth.isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
  }
  return true;
}

/**
 * Redirect if not admin
 */
function requireAdmin() {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
      window.location.href = '/login.html';
      return false;
  }
  return true;
}

/**
 * Update navbar based on auth state
 */
function updateNavbar() {
  const user = Auth.getUser();
  const authLinks = document.getElementById('auth-links');
  const userMenu = document.getElementById('user-menu');
  const adminLink = document.getElementById('admin-link');

  if (!authLinks) return;

  if (user) {
      authLinks.style.display = 'none';
      if (userMenu) {
          userMenu.style.display = 'flex';
          const nameEl = userMenu.querySelector('.user-name');
          if (nameEl) nameEl.textContent = user.name;
      }
      if (adminLink && user.role === 'admin') {
          adminLink.style.display = 'inline-flex';
      }
  } else {
      authLinks.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
  }
}

// Initialize navbar on every page load
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
      window.addEventListener('scroll', () => {
          navbar.classList.toggle('scrolled', window.scrollY > 10);
      });
  }

  // Hamburger menu
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.navbar-links');
  if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
          hamburger.classList.toggle('active');
          navLinks.classList.toggle('open');
      });
  }
});
