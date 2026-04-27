'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 'var(--ed-radius-md)', border: '1px solid var(--ed-line-strong)',
  fontSize: 14, background: '#fff', color: 'var(--ed-ink)', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)',
};

const btnStyle: React.CSSProperties = {
  height: 46, borderRadius: 'var(--ed-radius-md)', border: 'none',
  background: 'var(--ed-ink)', color: 'var(--ed-paper)',
  fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, width: '100%',
};

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: '弱', color: 'var(--ed-accent)' };
  if (score <= 3) return { level: 2, label: '中等', color: '#D4A017' };
  return { level: 3, label: '强', color: '#2D8A4E' };
}

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const resetForm = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push('/');
    router.refresh();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();
    if (!displayName.trim()) { setError('请输入昵称'); return; }
    if (!email.trim()) { setError('请输入邮箱或手机号'); return; }
    // Basic email format check (if it looks like an email)
    if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('邮箱格式不正确'); return; }
    // If no @ sign, treat as phone — basic check
    if (!email.includes('@') && !/^\+?\d{10,15}$/.test(email.replace(/[\s-]/g, ''))) { setError('请输入有效的邮箱或手机号'); return; }
    if (password.length < 6) { setError('密码至少需要6位'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    if (!agreedTerms) { setError('请先同意服务条款和隐私政策'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName || email.split('@')[0], display_name: displayName || email.split('@')[0] } },
    });
    if (error) {
      setError(error.message === 'User already registered' ? '该邮箱已注册，请直接登录' : error.message);
      setLoading(false);
      return;
    }
    // If session exists, email confirmation is disabled — auto-login
    if (data.session) {
      router.push('/');
      router.refresh();
      return;
    }
    // Email confirmation required
    setSuccess('注册成功！请检查邮箱确认链接（可能在垃圾邮件中）。');
    // Keep loading=true to prevent re-clicking
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess('重置链接已发送到邮箱，请检查收件箱。');
    setLoading(false);
  };

  const handleGoogleAuth = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
  };

  const pwStrength = getPasswordStrength(password);

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  );

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '48px 20px 80px' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--ed-ink)', color: 'var(--ed-paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--ed-font-serif-italic)', fontStyle: 'italic', fontSize: 18, fontWeight: 500,
          }}>B</div>
          <span style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 20, fontWeight: 600 }}>Baam</span>
        </Link>
        <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {tab === 'login' ? '欢迎回来' : tab === 'register' ? '创建账号' : '重置密码'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)' }}>
          {tab === 'login' ? '登录你的 Baam 账号' : tab === 'register' ? '加入纽约华人社区' : '输入注册邮箱，我们会发送重置链接'}
        </p>
      </div>

      {/* Tabs */}
      {tab !== 'forgot' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--ed-surface)', borderRadius: 'var(--ed-radius-md)', padding: 4 }}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); resetForm(); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 'var(--ed-radius-md)',
                fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? 'var(--ed-ink)' : 'var(--ed-ink-muted)',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--ed-radius-md)', background: 'rgba(199,62,29,0.08)', color: 'var(--ed-accent)', fontSize: 13, border: '1px solid rgba(199,62,29,0.12)' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--ed-radius-md)', background: 'rgba(45,138,78,0.08)', color: '#2D8A4E', fontSize: 13, border: '1px solid rgba(45,138,78,0.15)' }}>
          {success}
        </div>
      )}

      {/* ─── Login Form ─── */}
      {tab === 'login' && (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>邮箱</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>密码</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" style={{ ...inputStyle, paddingRight: 42 }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ed-ink-muted)', display: 'flex' }} aria-label={showPassword ? '隐藏密码' : '显示密码'}>
                <EyeIcon show={showPassword} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
            <button type="button" onClick={() => { setTab('forgot'); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ed-accent)', padding: 0 }}>忘记密码？</button>
          </div>
          <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? '登录中...' : '登录'}
          </button>

          {/* Divider + Google */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0', fontSize: 12, color: 'var(--ed-ink-muted)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--ed-line)' }} />或<span style={{ flex: 1, height: 1, background: 'var(--ed-line)' }} />
          </div>
          <button type="button" onClick={handleGoogleAuth} style={{ height: 44, borderRadius: 'var(--ed-radius-md)', border: '1px solid var(--ed-line-strong)', background: '#fff', color: 'var(--ed-ink)', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            使用 Google 账号登录
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ed-ink-muted)', marginTop: 4 }}>
            还没有账号？<button type="button" onClick={() => { setTab('register'); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ed-accent)', fontWeight: 500, fontSize: 13, padding: 0 }}>立即注册</button>
          </p>
        </form>
      )}

      {/* ─── Register Form ─── */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>昵称 <span style={{ color: 'var(--ed-accent)' }}>*</span></label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="你希望别人怎么称呼你" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>邮箱或手机号 <span style={{ color: 'var(--ed-accent)' }}>*</span></label>
            <input type="text" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com 或 手机号码" style={inputStyle} />
            <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>用于登录和接收通知</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>密码 <span style={{ color: 'var(--ed-accent)' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少6位" style={{ ...inputStyle, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ed-ink-muted)', display: 'flex' }}>
                  <EyeIcon show={showPassword} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>密码至少6位，建议包含字母和数字</p>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>确认密码 <span style={{ color: 'var(--ed-accent)' }}>*</span></label>
              <input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入" style={inputStyle} />
            </div>
          </div>
          {/* Password strength */}
          {password && (
            <div style={{ marginTop: -8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3].map(i => (
                  <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength.level ? pwStrength.color : 'var(--ed-line)' }} />
                ))}
              </div>
              <p style={{ fontSize: 11, color: pwStrength.color, marginTop: 4 }}>密码强度：{pwStrength.label}</p>
            </div>
          )}
          {/* Terms */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: -4, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--ed-accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--ed-ink-soft)', lineHeight: 1.5 }}>
              我已阅读并同意 <Link href="/terms" style={{ color: 'var(--ed-accent)' }}>服务条款</Link> 和 <Link href="/privacy" style={{ color: 'var(--ed-accent)' }}>隐私政策</Link>
            </span>
          </label>
          <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? '注册中...' : '注册'}
          </button>

          {/* Divider + Google */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0', fontSize: 12, color: 'var(--ed-ink-muted)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--ed-line)' }} />或<span style={{ flex: 1, height: 1, background: 'var(--ed-line)' }} />
          </div>
          <button type="button" onClick={handleGoogleAuth} style={{ height: 44, borderRadius: 'var(--ed-radius-md)', border: '1px solid var(--ed-line-strong)', background: '#fff', color: 'var(--ed-ink)', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            使用 Google 账号注册
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ed-ink-muted)', marginTop: 4 }}>
            已有账号？<button type="button" onClick={() => { setTab('login'); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ed-accent)', fontWeight: 500, fontSize: 13, padding: 0 }}>去登录</button>
          </p>
        </form>
      )}

      {/* ─── Forgot Password Form ─── */}
      {tab === 'forgot' && (
        <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>注册邮箱</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? '发送中...' : '发送重置链接'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" onClick={() => { setTab('login'); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ed-accent)', padding: 0 }}>← 返回登录</button>
          </p>
        </form>
      )}
    </div>
  );
}
