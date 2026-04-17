import Cookies from 'js-cookie';

const KEY     = 'admin_token';
const EXPIRES = 1 / 3; // 8 hours

export const getToken         = (): string | null => Cookies.get(KEY) ?? null;
export const isAuthenticated  = (): boolean       => !!getToken();

export function setToken(token: string) {
  Cookies.set(KEY, token, { expires: EXPIRES, path: '/', sameSite: 'lax' });
}

export function clearToken() {
  Cookies.remove(KEY, { path: '/' });
}
