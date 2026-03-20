'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Site-scoped pages (filtered by region+locale)
const siteNavItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/articles', label: '内容管理', icon: '📝' },
  { href: '/admin/businesses', label: '商家管理', icon: '🏪' },
  { href: '/admin/forum', label: '论坛管理', icon: '💬' },
  { href: '/admin/voices', label: '达人管理', icon: '🎙️' },
  { href: '/admin/events', label: '活动管理', icon: '📅' },
  { href: '/admin/leads', label: '线索管理', icon: '📥' },
];

// System-scoped pages (super-admin only)
const systemNavItems = [
  { href: '/admin/sites', label: '站点管理', icon: '🌐' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/ai-jobs', label: 'AI任务', icon: '🤖' },
  { href: '/admin/sponsors', label: '广告管理', icon: '💰' },
  { href: '/admin/settings', label: '系统设置', icon: '⚙️' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Preserve region/locale params on navigation
  const buildHref = (href: string) => {
    const region = searchParams.get('region');
    const locale = searchParams.get('locale');
    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (locale) params.set('locale', locale);
    const qs = params.toString();
    return qs ? `${href}?${qs}` : href;
  };

  const sidebar = (
    <div className="w-60 bg-gray-800 text-gray-300 h-screen overflow-y-auto flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-700">
        <Link href={buildHref('/admin')} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="text-lg font-bold text-white">Baam</span>
          <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded ml-1">Admin</span>
        </Link>
      </div>

      {/* Site Content Section */}
      <nav className="flex-1 py-3">
        <div className="px-5 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">站点内容</p>
        </div>
        {siteNavItems.map((item) => (
          <Link
            key={item.href}
            href={buildHref(item.href)}
            className={cn(
              'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
              isActive(item.href, item.exact)
                ? 'bg-gray-700/50 text-primary border-r-2 border-primary'
                : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
            )}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        {/* System Section */}
        <div className="px-5 py-2 mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">系统管理</p>
        </div>
        {systemNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
              isActive(item.href)
                ? 'bg-gray-700/50 text-primary border-r-2 border-primary'
                : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
            )}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Admin User */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-white font-bold">A</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">Admin</p>
            <p className="text-xs text-gray-500">超级管理员</p>
          </div>
          <Link href="/zh" className="text-xs text-gray-500 hover:text-gray-300">退出</Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block fixed top-0 left-0 z-50">{sidebar}</aside>

      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center">
        {mobileOpen ? '✕' : '☰'}
      </button>
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed top-0 left-0 z-50">{sidebar}</aside>
        </>
      )}
    </>
  );
}
