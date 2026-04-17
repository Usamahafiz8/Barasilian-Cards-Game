'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/games', label: 'Games', icon: '🎮' },
  { href: '/shop', label: 'Shop', icon: '🛒' },
  { href: '/promos', label: 'Promo Codes', icon: '🏷️' },
  { href: '/broadcast', label: 'Broadcast', icon: '📢' },
  { href: '/config', label: 'System Config', icon: '⚙️' },
  { href: '/audit', label: 'Audit Logs', icon: '📋' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">🃏 Buraco Admin</h1>
        <p className="text-gray-400 text-sm mt-1">Management Panel</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
              (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button onClick={logout} className="w-full text-left text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
