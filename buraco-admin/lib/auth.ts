'use client';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token);
  // Also set cookie so middleware can read it
  document.cookie = `admin_token=${token}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
}

export function clearToken() {
  localStorage.removeItem('admin_token');
  // Clear cookie too
  document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
