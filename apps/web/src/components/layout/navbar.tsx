'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/routing';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/news', key: 'news' },
  { href: '/guides', key: 'guides' },
  { href: '/businesses', key: 'businesses' },
  { href: '/events', key: 'events' },
  { href: '/forum', key: 'forum' },
  { href: '/voices', key: 'voices' },
] as const;

export function Navbar() {
  const t = useTranslations('nav');
  const ct = useTranslations('common');
  const { script, toggleScript, convert } = useChineseScript();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Desktop Nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-baam-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                B
              </div>
              <span className="text-xl font-bold text-gray-900">Baam</span>
              <span className="text-xs text-gray-400 hidden sm:inline">
                {convert('纽约')}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'text-baam-500 bg-orange-50'
                        : 'text-gray-600 hover:text-baam-500 hover:bg-orange-50'
                    )}
                  >
                    {convert(t(item.key))}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <Link
              href="/search"
              className="p-2 text-gray-500 hover:text-baam-500 hover:bg-orange-50 rounded-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>

            {/* Chinese Script Toggle (Simplified/Traditional) */}
            <button
              onClick={toggleScript}
              className="px-2 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              title={script === 'simplified' ? '切换繁體' : '切换简体'}
            >
              {script === 'simplified' ? '繁' : '简'}
            </button>

            {/* Region Selector */}
            <button className="hidden sm:flex items-center gap-1 text-sm text-gray-600 hover:text-baam-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{convert('法拉盛')}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Auth Button */}
            <button className="bg-baam-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-baam-600 transition-colors">
              {convert(t('loginOrRegister'))}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden p-2 text-gray-500"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 pb-4">
          <div className="px-4 pt-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'block px-3 py-2 text-base font-medium rounded-md',
                    isActive
                      ? 'text-baam-500 bg-orange-50'
                      : 'text-gray-600 hover:bg-orange-50'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {convert(t(item.key))}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
