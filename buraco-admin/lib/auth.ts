'use client';

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
