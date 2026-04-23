import axios from 'axios';
import Cookies from 'js-cookie';

const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const api = axios.create({
  baseURL: base.endsWith('/v1') ? base : `${base}/v1`,
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
