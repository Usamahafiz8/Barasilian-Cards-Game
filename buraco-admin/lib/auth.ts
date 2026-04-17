import Cookies from 'js-cookie';

const KEY = 'admin_token';
const EXPIRES = 1 / 3; // 8 hours

export function getToken(): string | null {
  return Cookies.get(KEY) ?? null;
}

export function setToken(token: string) {
  Cookies.set(KEY, token, { expires: EXPIRES, path: '/', sameSite: 'lax' });
}

export function clearToken() {
  Cookies.remove(KEY, { path: '/' });
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
