'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const NAV = [
  { href: '/',          label: 'Dashboard',    icon: '▦' },
  { href: '/users',     label: 'Users',        icon: '👤' },
  { href: '/games',     label: 'Games',        icon: '🎮' },
  { href: '/shop',      label: 'Shop',         icon: '🛒' },
  { href: '/promos',    label: 'Promo Codes',  icon: '🏷' },
  { href: '/broadcast', label: 'Broadcast',    icon: '📢' },
  { href: '/config',    label: 'Config',       icon: '⚙' },
  { href: '/audit',     label: 'Audit Logs',   icon: '📋' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <aside className="w-60 shrink-0 min-h-screen bg-gray-950 flex flex-col border-r border-gray-800">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🃏</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Buraco Admin</p>
            <p className="text-gray-500 text-xs">Management Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span className="w-5 text-center">↩</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
