'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/articles', label: '内容管理', icon: '📝' },
  { href: '/admin/businesses', label: '商家管理', icon: '🏪' },
  { href: '/admin/forum', label: '论坛管理', icon: '💬' },
  { href: '/admin/voices', label: '达人管理', icon: '🎙️' },
  { href: '/admin/events', label: '活动管理', icon: '📅' },
  { href: '/admin/leads', label: '线索管理', icon: '📥' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/ai-jobs', label: 'AI任务', icon: '🤖' },
  { href: '/admin/sponsors', label: '广告管理', icon: '💰' },
  { href: '/admin/settings', label: '系统设置', icon: '⚙️' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const sidebar = (
    <div className="w-[var(--sidebar-width)] bg-bg-sidebar text-gray-300 h-screen overflow-y-auto flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-700">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
            B
          </div>
          <span className="text-lg font-bold text-white">Baam</span>
          <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded ml-1">
            Admin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
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
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">Admin</p>
            <p className="text-xs text-gray-500">管理员</p>
          </div>
          <Link href="/zh" className="text-xs text-gray-500 hover:text-gray-300">
            退出
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 z-50">
        {sidebar}
      </aside>

      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-bg-sidebar text-white rounded-lg flex items-center justify-center"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed top-0 left-0 z-50">
            {sidebar}
          </aside>
        </>
      )}
    </>
  );
}
