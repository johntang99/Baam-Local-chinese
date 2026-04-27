'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/helper-2', label: '小帮手' },
  { href: '/discover', label: '逛逛晒晒' },
  { href: '/news', label: '新闻' },
  { href: '/guides', label: '生活资讯' },
  { href: '/businesses', label: '商家' },
  { href: '/events', label: '活动' },
  { href: '/discounts', label: '优惠' },
  { href: '/classifieds', label: '分类信息' },
  { href: '/services', label: '实用工具' },
];

function isActive(pathname: string, href: string): boolean {
  const path = pathname.replace(/^\/(zh|en)/, '') || '/';
  if (href === '/') return path === '/';
  return path.startsWith(href);
}

export function EditorialNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        const name = data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '';
        setDisplayName(name);
        // Fetch username from profiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('profiles').select('username, display_name').eq('id', data.user.id).single().then(({ data: profile }: { data: { username?: string; display_name?: string } | null }) => {
          if (profile) {
            setUsername(profile.username || '');
            if (profile.display_name) setDisplayName(profile.display_name);
          }
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const name = session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '';
        setDisplayName(name);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
    router.push('/');
    router.refresh();
  };

  const avatarInitial = displayName?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(251, 246, 236, 0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'var(--ed-line)',
      }}
    >
      <nav
        className="flex items-center justify-between gap-4"
        style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '12px 16px' }}
      >
        {/* Hamburger (mobile only) */}
        <button
          className="lg:hidden flex items-center justify-center"
          style={{ width: 36, height: 36, color: 'var(--ed-ink-soft)' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="flex items-center justify-center"
            style={{
              width: 32, height: 32,
              background: 'var(--ed-ink)', color: 'var(--ed-paper)',
              borderRadius: 9,
              fontFamily: 'var(--ed-font-serif-italic)',
              fontStyle: 'italic',
              fontSize: 16, fontWeight: 500,
            }}
          >
            B
          </div>
          <div className="hidden sm:block" style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Baam
            <span style={{ fontFamily: 'var(--ed-font-serif-italic)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ed-ink-muted)', fontSize: 14, marginLeft: 4 }}>
              纽约
            </span>
          </div>
        </Link>

        {/* Nav Links (desktop) */}
        <div className="hidden lg:flex items-center gap-6 flex-1 justify-center" style={{ fontSize: 14, color: 'var(--ed-ink-soft)' }}>
          {navLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative py-1 transition-colors hover:text-ed-accent whitespace-nowrap"
                style={active ? { color: 'var(--ed-ink)', fontWeight: 500 } : undefined}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute left-0 right-0"
                    style={{ bottom: -4, height: 2, background: 'var(--ed-accent)', borderRadius: 2 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <Link
            href="/search"
            className="flex items-center justify-center transition-colors"
            style={{ width: 36, height: 36, borderRadius: '50%', color: 'var(--ed-ink-soft)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>

          {user ? (
            <>
              {/* + 发布 button */}
              <Link
                href="/discover/new-post"
                className="hidden sm:flex items-center gap-1 transition-transform hover:-translate-y-px"
                style={{
                  padding: '7px 16px',
                  background: 'var(--ed-accent)',
                  color: '#fff',
                  borderRadius: 'var(--ed-radius-pill)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                + 发布
              </Link>

              {/* Notification bell */}
              <Link
                href="/notifications"
                className="flex items-center justify-center transition-colors relative"
                style={{ width: 36, height: 36, borderRadius: '50%', color: 'var(--ed-ink-soft)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </Link>

              {/* Avatar + Dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center justify-center transition-transform hover:-translate-y-px"
                  style={{
                    width: 34, height: 34,
                    borderRadius: '50%',
                    background: 'var(--ed-accent)',
                    color: '#fff',
                    fontFamily: 'var(--ed-font-serif)',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {avatarInitial}
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2"
                    style={{
                      width: 220,
                      background: 'var(--ed-surface-elev, #fff)',
                      border: '1px solid var(--ed-line)',
                      borderRadius: 'var(--ed-radius)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      zIndex: 100,
                    }}
                  >
                    {/* User info */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ed-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--ed-accent)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, flexShrink: 0,
                      }}>
                        {avatarInitial}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                        {username && <div style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>@{username}</div>}
                      </div>
                    </div>

                    {/* Menu items */}
                    <div style={{ padding: '6px 0' }}>
                      {[
                        { href: username ? `/profile/${username}` : '/me', icon: '👤', label: '个人主页' },
                        { href: '/me', icon: '📊', label: '个人中心' },
                        { href: '/notifications', icon: '🔔', label: '消息通知' },
                        { href: '/me?tab=posts', icon: '📝', label: '我的帖子' },
                        { href: '/me?tab=bookmarks', icon: '⭐', label: '我的收藏' },
                        { href: '/me?tab=settings', icon: '⚙️', label: '账号设置' },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 transition-colors"
                          style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ed-ink-soft)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--ed-surface)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <span style={{ width: 20, textAlign: 'center' }}>{item.icon}</span>
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {/* Logout */}
                    <div style={{ padding: '6px 0', borderTop: '1px solid var(--ed-line)' }}>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full transition-colors"
                        style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ed-accent)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--ed-surface)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ width: 20, textAlign: 'center' }}>🚪</span>
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Logged out: Login button */
            <Link
              href="/auth/login"
              className="transition-transform hover:-translate-y-px"
              style={{
                padding: '8px 18px',
                background: 'var(--ed-ink)',
                color: 'var(--ed-paper)',
                borderRadius: 'var(--ed-radius-pill)',
                fontSize: 13,
              }}
            >
              登录
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div
          className="lg:hidden border-t"
          style={{
            borderColor: 'var(--ed-line)',
            background: 'var(--ed-paper)',
            padding: '8px 16px 16px',
          }}
        >
          <div className="flex flex-col">
            {navLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-3 border-b transition-colors"
                  style={{
                    borderColor: 'var(--ed-line)',
                    fontSize: 15,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--ed-ink)' : 'var(--ed-ink-soft)',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            {/* Mobile: user actions */}
            {user ? (
              <>
                <Link href="/discover/new-post" onClick={() => setMenuOpen(false)} className="py-3 border-b" style={{ borderColor: 'var(--ed-line)', fontSize: 15, color: 'var(--ed-accent)', fontWeight: 500 }}>
                  + 发布笔记
                </Link>
                <Link href="/me" onClick={() => setMenuOpen(false)} className="py-3 border-b" style={{ borderColor: 'var(--ed-line)', fontSize: 15, color: 'var(--ed-ink-soft)' }}>
                  个人中心
                </Link>
                <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="py-3 text-left" style={{ fontSize: 15, color: 'var(--ed-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  退出登录
                </button>
              </>
            ) : (
              <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="py-3" style={{ fontSize: 15, color: 'var(--ed-accent)', fontWeight: 500 }}>
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
