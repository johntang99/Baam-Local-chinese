'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/routing';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/shared/auth-modal';
import type { User } from '@supabase/supabase-js';

const navItems = [
  { href: '/news', key: 'news' },
  { href: '/guides', key: 'guides' },
  { href: '/businesses', key: 'businesses' },
  { href: '/events', key: 'events' },
  { href: '/forum', key: 'forum' },
  { href: '/discover', key: 'discover' },
  { href: '/ask', key: 'ask' },
  { href: '/services', key: 'services' },
] as const;

export function Navbar() {
  const t = useTranslations('nav');
  const { script, toggleScript, convert } = useChineseScript();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserMenuOpen(false);
    window.location.reload();
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  return (
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Nav */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
                <span className="text-xl font-bold text-gray-900">Baam</span>
                <span className="text-xs text-gray-400 hidden sm:inline">{convert('纽约')}</span>
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.key} href={item.href}
                    className={cn('px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      pathname.startsWith(item.href) ? 'text-primary bg-orange-50' : 'text-gray-600 hover:text-primary hover:bg-orange-50'
                    )}
                  >
                    {convert(t(item.key))}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <Link href="/search" className="p-2 text-gray-500 hover:text-primary hover:bg-orange-50 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </Link>

              <button onClick={toggleScript} className="px-2 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded hover:bg-gray-100" title={script === 'simplified' ? '切换繁體' : '切换简体'}>
                {script === 'simplified' ? '繁' : '简'}
              </button>

              <button className="hidden sm:flex items-center gap-1 text-sm text-gray-600 hover:text-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>{convert('法拉盛')}</span>
              </button>

              {/* Auth */}
              {user ? (
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 hidden sm:inline">{displayName}</span>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                        <a href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">管理后台</a>
                        <a href="/zh/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{convert('设置')}</a>
                        <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">{convert('退出')}</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
                  {convert(t('loginOrRegister'))}
                </button>
              )}

              {/* Mobile menu toggle */}
              <button className="lg:hidden p-2 text-gray-500" onClick={() => setMobileOpen(!mobileOpen)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 pb-4">
            <div className="px-4 pt-2 space-y-1">
              {navItems.map((item) => (
                <Link key={item.key} href={item.href}
                  className={cn('block px-3 py-2 text-base font-medium rounded-md',
                    pathname.startsWith(item.href) ? 'text-primary bg-orange-50' : 'text-gray-600 hover:bg-orange-50')}
                  onClick={() => setMobileOpen(false)}
                >
                  {convert(t(item.key))}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
