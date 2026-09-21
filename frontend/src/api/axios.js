import axios from 'axios';

// In production, connect directly to Render backend to avoid Vercel's strict 10s proxy gateway timeouts
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocal
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.startsWith('/')
      ? import.meta.env.VITE_API_URL
      : 'https://piano-invest-app.onrender.com/api');

const API = axios.create({
  baseURL: API_BASE,
  timeout: 45000, // 45s timeout to allow Render free-tier cold starts
});

// Pre-warm Render backend on initial app load
if (typeof window !== 'undefined' && !isLocal) {
  fetch('https://piano-invest-app.onrender.com/health', { mode: 'cors' }).catch(() => {});
}

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Friendly error handler for network/timeout errors during cold starts
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response && error.code === 'ECONNABORTED') {
      error.message = 'Server took too long to respond. The cloud server is waking up, please retry in 10 seconds.';
    } else if (!error.response && error.message === 'Network Error') {
      error.message = 'Unable to reach the server. The cloud server is starting up, please wait a moment and try again.';
    }
    return Promise.reject(error);
  }
);

export default API;
