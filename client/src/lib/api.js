import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Still send Bearer token if one exists (JWT backwards-compat during transition)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('zl_token');
      localStorage.removeItem('zl_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
