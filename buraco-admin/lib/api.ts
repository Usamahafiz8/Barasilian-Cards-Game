import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onLogin = typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/login');
    if (err.response?.status === 401 && !onLogin) {
      Cookies.remove('admin_token', { path: '/' });
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
