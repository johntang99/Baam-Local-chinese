'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/routing';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/shared/auth-modal';
import type { User } from '@supabase/supabase-js';

// Fallback nav items when DB settings not available
const defaultNavItems = [
  { href: '/helper-2', key: 'helper2' },
  { href: '/discover', key: 'discover' },
  { href: '/news', key: 'news' },
  { href: '/guides', key: 'guides' },
  { href: '/businesses', key: 'businesses' },
  { href: '/events', key: 'events' },
  { href: '/forum', key: 'forum' },
  { href: '/services', key: 'services' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface NavbarProps {
  dbNavItems?: Record<string, any>[];
}

export function Navbar({ dbNavItems }: NavbarProps) {
  const t = useTranslations('nav');
  const { script, toggleScript, convert } = useChineseScript();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Use DB nav items if provided, otherwise fall back to hardcoded defaults
  const navItems = dbNavItems
    ? dbNavItems.map((item) => ({ href: item.href as string, label_zh: item.label_zh as string, label_en: item.label_en as string }))
    : defaultNavItems.map((item) => ({ href: item.href, label_zh: t(item.key), label_en: item.key }));

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
      <nav className="bg-bg-card/95 backdrop-blur border-b border-border-light sticky top-0 z-50">
        <PageContainer>
          <div className="flex items-center justify-between h-14">
            {/* Logo + Nav */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary r-lg flex items-center justify-center text-text-inverse fw-bold text-sm">B</div>
                <span className="text-lg fw-bold text-text-primary">Baam</span>
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-text-muted ml-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  {convert('法拉盛')}
                </span>
              </Link>
              <div className="hidden lg:flex items-center gap-0.5">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'relative px-3 py-1.5 text-sm fw-medium r-base transition-colors',
                        isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {convert(item.label_zh)}
                      {isActive && (
                        <span className="absolute left-3 right-3 -bottom-[13px] h-0.5 bg-primary r-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="p-2 text-text-secondary hover:text-primary hover:bg-primary-50 r-full transition-colors"
                aria-label="搜索"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </Link>

              <button
                onClick={toggleScript}
                className="text-xs fw-medium text-text-secondary hover:text-primary border border-border-light hover:border-primary/30 r-full w-8 h-8 flex items-center justify-center transition-colors"
                title={script === 'simplified' ? '切换繁體' : '切换简体'}
              >
                {script === 'simplified' ? '繁' : '简'}
              </button>

              {/* Auth */}
              {user ? (
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-2 py-1 r-full hover:bg-bg-page transition-colors">
                    <div className="w-7 h-7 r-full bg-primary flex items-center justify-center text-text-inverse text-xs fw-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-text-primary hidden sm:inline">{displayName}</span>
                    <svg className="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border r-lg elev-lg z-50 py-1">
                        <div className="px-4 py-2 border-b border-border-light">
                          <p className="text-sm fw-medium text-text-primary">{displayName}</p>
                          <p className="text-xs text-text-muted truncate">{user.email}</p>
                        </div>
                        <a href="/admin" className="block px-4 py-2 text-sm text-text-primary hover:bg-bg-page">管理后台</a>
                        <a href="/zh/settings" className="block px-4 py-2 text-sm text-text-primary hover:bg-bg-page">{convert('设置')}</a>
                        <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-accent-red hover:bg-bg-page">{convert('退出')}</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button onClick={() => setAuthOpen(true)} className={cn(buttonVariants({ size: 'sm' }), 'h-9 px-4')}>
                  {convert(t('loginOrRegister'))}
                </button>
              )}

              {/* Mobile menu toggle */}
              <button className="lg:hidden p-2 text-text-secondary hover:text-text-primary" onClick={() => setMobileOpen(!mobileOpen)} aria-label="菜单">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
                </svg>
              </button>
            </div>
          </div>
        </PageContainer>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-bg-card border-t border-border-light pb-4">
            <div className="px-4 pt-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block px-3 py-2 text-base fw-medium r-base',
                    pathname.startsWith(item.href) ? 'text-primary bg-primary-50' : 'text-text-secondary hover:bg-bg-page hover:text-text-primary'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {convert(item.label_zh)}
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
