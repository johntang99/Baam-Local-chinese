'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface DashboardProps {
  profile: AnyRow;
  posts: AnyRow[];
  threads: AnyRow[];
  classifieds: AnyRow[];
  comments: AnyRow[];
  following: AnyRow[];
  stats: { totalViews: number; totalLikes: number; followers: number; totalComments: number; postCount: number };
  userEmail: string;
}

const TABS = [
  { key: 'overview', label: '数据概览' },
  { key: 'posts', label: '我的帖子' },
  { key: 'comments', label: '我的评论' },
  { key: 'following', label: '我的关注' },
  { key: 'bookmarks', label: '我的收藏' },
  { key: 'history', label: '浏览历史' },
  { key: 'settings', label: '账号设置' },
] as const;
type TabKey = typeof TABS[number]['key'];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 1) return '刚刚';
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(ms / 86400000);
  return days < 7 ? `${days}天前` : new Date(dateStr).toLocaleDateString('zh-CN');
}

export function DashboardClient({ profile, posts, threads, classifieds, comments, following, stats, userEmail }: DashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [activeTab, setActiveTab] = useState<TabKey>(TABS.some(t => t.key === initialTab) ? initialTab : 'overview');

  // Settings state
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);

  // Browsing history (localStorage) — must load after mount to avoid hydration mismatch
  const [browsingHistory, setBrowsingHistory] = useState<{ title: string; url: string; source: string; time: string }[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem('baam-browsing-history') || '[]');
      setBrowsingHistory(h);
    } catch { /* empty */ }
    setHistoryLoaded(true);
  }, []);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    router.replace(`/me?tab=${key}`, { scroll: false });
  };

  const handleSaveProfile = async () => {
    setSettingsMsg('');
    const formData = new FormData();
    formData.set('displayName', displayName);
    formData.set('username', username);
    formData.set('bio', bio);
    formData.set('headline', profile.headline || '');
    const { updateProfile } = await import('../settings/actions');
    const result = await updateProfile(formData);
    setSettingsMsg(result.error ? result.error : '资料已保存');
  };

  const handleChangePassword = async () => {
    setPwMsg('');
    if (pwNew !== pwConfirm) { setPwMsg('两次输入的密码不一致'); return; }
    if (pwNew.length < 6) { setPwMsg('新密码至少6位'); return; }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) { setPwMsg(error.message); return; }
    setPwMsg('密码已更新');
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
  };

  const handleUnfollow = async (profileId: string) => {
    const formData = new FormData();
    formData.set('profile_id', profileId);
    const { toggleFollow } = await import('../actions');
    await toggleFollow(formData);
    router.refresh();
  };

  const avatarInitial = profile.display_name?.[0] || '?';
  const allPosts: (AnyRow & { _type: 'discover' | 'forum' | 'classified'; _date: string })[] = [
    ...posts.map(p => ({ ...p, _type: 'discover' as const, _date: p.published_at || p.created_at })),
    ...threads.map(t => ({ ...t, _type: 'forum' as const, _date: t.created_at })),
    ...classifieds.map(c => ({ ...c, _type: 'classified' as const, _date: c.created_at })),
  ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px',
    borderRadius: 'var(--ed-radius-md)', border: '1px solid var(--ed-line-strong)',
    fontSize: 14, background: '#fff', color: 'var(--ed-ink)', outline: 'none',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
      {/* Header */}
      <div style={{ padding: '28px 0 0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--ed-accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--ed-font-serif)', fontSize: 22, fontWeight: 700, flexShrink: 0,
        }}>{avatarInitial}</div>
        <div>
          <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 20, fontWeight: 700 }}>个人中心</h1>
          <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>{profile.display_name} · @{profile.username || 'user'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[52px] z-40" style={{ background: 'var(--ed-paper)', borderBottom: '1px solid var(--ed-line)', marginTop: 16, padding: '10px 0' }}>
        <div className="flex gap-2 overflow-x-auto justify-center" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className="flex-shrink-0 whitespace-nowrap transition-all"
              style={{
                padding: '7px 16px', borderRadius: 'var(--ed-radius-pill)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: activeTab === tab.key ? 'var(--ed-ink)' : 'transparent',
                color: activeTab === tab.key ? 'var(--ed-paper)' : 'var(--ed-ink-soft)',
                border: activeTab === tab.key ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)',
              }}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 24 }}>
        {/* ═══ Overview ═══ */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 24 }}>
              {[
                { num: stats.totalViews.toLocaleString(), label: '总浏览量' },
                { num: stats.followers.toLocaleString(), label: '粉丝' },
                { num: stats.totalLikes.toLocaleString(), label: '获赞' },
                { num: stats.totalComments.toLocaleString(), label: '评论' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 24, fontWeight: 700 }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>最近发布</h3>
            <div style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', overflow: 'hidden' }}>
              {allPosts.slice(0, 5).map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', fontWeight: 500, background: item._type === 'discover' ? 'rgba(199,62,29,0.06)' : item._type === 'forum' ? 'rgba(45,138,78,0.06)' : 'rgba(212,160,23,0.1)', color: item._type === 'discover' ? 'var(--ed-accent)' : item._type === 'forum' ? '#2D8A4E' : '#D4A017' }}>
                    {item._type === 'discover' ? '逛逛晒晒' : item._type === 'forum' ? '论坛' : '分类信息'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                    <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 2 }}>
                      {item.like_count !== undefined && `❤️ ${item.like_count} · `}
                      {item.comment_count !== undefined && `💬 ${item.comment_count} · `}
                      {item.reply_count !== undefined && `💬 ${item.reply_count} · `}
                      {timeAgo(item._date)}
                    </p>
                  </div>
                </div>
              ))}
              {allPosts.length === 0 && <p style={{ padding: 32, textAlign: 'center', fontSize: 14, color: 'var(--ed-ink-muted)' }}>还没有发布内容</p>}
            </div>
          </>
        )}

        {/* ═══ My Posts ═══ */}
        {activeTab === 'posts' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700 }}>我的帖子 ({allPosts.length})</h2>
              <Link href="/discover/new-post" style={{ padding: '6px 14px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-accent)', color: '#fff', fontSize: 12, fontWeight: 500 }}>+ 发布新帖</Link>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', overflow: 'hidden' }}>
              {allPosts.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', fontWeight: 500, flexShrink: 0, background: item._type === 'discover' ? 'rgba(199,62,29,0.06)' : item._type === 'forum' ? 'rgba(45,138,78,0.06)' : 'rgba(212,160,23,0.1)', color: item._type === 'discover' ? 'var(--ed-accent)' : item._type === 'forum' ? '#2D8A4E' : '#D4A017' }}>
                    {item._type === 'discover' ? '逛逛晒晒' : item._type === 'forum' ? '论坛' : '分类信息'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                    <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 2 }}>
                      {item.like_count !== undefined && `❤️ ${item.like_count} · `}💬 {item.comment_count || item.reply_count || 0} · 👀 {item.view_count || 0} · {timeAgo(item._date)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Link href={item._type === 'discover' ? `/discover/${item.slug}` : item._type === 'forum' ? `/forum/${item.board_slug || 'general'}/${item.slug}` : `/classifieds/${item.category}/${item.slug}`} style={{ padding: '4px 10px', borderRadius: 'var(--ed-radius-md)', fontSize: 11, border: '1px solid var(--ed-line)', background: '#fff', color: 'var(--ed-ink-soft)' }}>查看</Link>
                  </div>
                </div>
              ))}
              {allPosts.length === 0 && (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)', marginBottom: 12 }}>还没有发布内容</p>
                  <Link href="/discover/new-post" style={{ fontSize: 13, color: 'var(--ed-accent)', fontWeight: 500 }}>发布第一篇笔记 →</Link>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ My Comments ═══ */}
        {activeTab === 'comments' && (
          <>
            <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>我的评论 ({comments.length})</h2>
            <div style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', overflow: 'hidden' }}>
              {comments.map((c, i) => (
                <div key={c.id} style={{ padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none' }}>
                  <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginBottom: 6 }}>
                    回复了 <Link href={`/discover/${c.voice_posts?.slug}`} style={{ color: 'var(--ed-accent)' }}>{c.voice_posts?.title || '帖子'}</Link>
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--ed-ink-soft)', lineHeight: 1.6 }}>{c.content}</p>
                  <div style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 6, display: 'flex', gap: 12 }}>
                    <span>{timeAgo(c.created_at)}</span>
                    {c.like_count > 0 && <span>❤️ {c.like_count}</span>}
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p style={{ padding: 48, textAlign: 'center', fontSize: 14, color: 'var(--ed-ink-muted)' }}>还没有评论</p>}
            </div>
          </>
        )}

        {/* ═══ Following ═══ */}
        {activeTab === 'following' && (
          <>
            <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>我的关注 ({following.length})</h2>
            <div style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', overflow: 'hidden' }}>
              {following.map((f, i) => {
                const p = f.profiles;
                if (!p) return null;
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ed-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: 'var(--ed-ink-soft)', flexShrink: 0 }}>
                      {p.display_name?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Link href={`/profile/${p.username}`} style={{ fontSize: 14, fontWeight: 600 }}>{p.display_name}</Link>
                      <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>{p.headline || `${p.post_count || 0} 帖子`}</p>
                    </div>
                    <button onClick={() => handleUnfollow(p.id)} style={{ padding: '5px 14px', borderRadius: 'var(--ed-radius-pill)', fontSize: 12, fontWeight: 500, border: '1px solid var(--ed-line)', background: '#fff', cursor: 'pointer', color: 'var(--ed-ink-soft)' }}>
                      取消关注
                    </button>
                  </div>
                );
              })}
              {following.length === 0 && <p style={{ padding: 48, textAlign: 'center', fontSize: 14, color: 'var(--ed-ink-muted)' }}>还没有关注任何人</p>}
            </div>
          </>
        )}

        {/* ═══ Bookmarks ═══ */}
        {activeTab === 'bookmarks' && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 40, opacity: 0.4, marginBottom: 12 }}>⭐</p>
            <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)' }}>收藏功能即将上线</p>
            <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginTop: 4 }}>你可以收藏喜欢的帖子，方便以后查看</p>
          </div>
        )}

        {/* ═══ Browsing History ═══ */}
        {activeTab === 'history' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700 }}>浏览历史</h2>
              <button onClick={() => { localStorage.removeItem('baam-browsing-history'); setBrowsingHistory([]); }} style={{ padding: '5px 14px', borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line)', background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--ed-accent)' }}>清空历史</button>
            </div>
            {browsingHistory.length > 0 ? (
              <div style={{ background: '#fff', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', overflow: 'hidden' }}>
                {browsingHistory.slice(0, 20).map((h, i) => (
                  <a key={i} href={h.url} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none', color: 'inherit' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</h4>
                      <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 2 }}>{h.source} · {h.time}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontSize: 40, opacity: 0.4, marginBottom: 12 }}>📖</p>
                <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)' }}>{historyLoaded ? '暂无浏览历史' : '加载中...'}</p>
                {historyLoaded && <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginTop: 4 }}>浏览帖子、商家、新闻后会自动记录</p>}
              </div>
            )}
          </>
        )}

        {/* ═══ Settings ═══ */}
        {activeTab === 'settings' && (
          <>
            {/* Profile section */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--ed-line)' }}>个人资料</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ed-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ed-font-serif)', fontSize: 28, fontWeight: 700 }}>{avatarInitial}</div>
                <div>
                  <button style={{ padding: '6px 16px', borderRadius: 'var(--ed-radius-md)', fontSize: 13, border: '1px solid var(--ed-line-strong)', background: '#fff', cursor: 'pointer', color: 'var(--ed-ink-soft)' }}>上传头像</button>
                  <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>JPG, PNG, 最大 2MB</p>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>昵称</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>用户名</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>baam.com/@{username || 'username'}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>邮箱</label>
                <input type="email" value={userEmail} disabled style={{ ...inputStyle, opacity: 0.6 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>个人简介</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' as const }} placeholder="介绍一下你自己..." />
                <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>{bio.length} / 500</p>
              </div>
              {settingsMsg && <p style={{ fontSize: 13, color: settingsMsg.includes('已') ? '#2D8A4E' : 'var(--ed-accent)', marginBottom: 12 }}>{settingsMsg}</p>}
              <button onClick={handleSaveProfile} style={{ padding: '10px 32px', borderRadius: 'var(--ed-radius-md)', border: 'none', background: 'var(--ed-ink)', color: 'var(--ed-paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>保存资料</button>
            </div>

            {/* Password section */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--ed-line)' }}>修改密码</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>当前密码</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwCurrent ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="输入当前密码" style={{ ...inputStyle, paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPwCurrent(!showPwCurrent)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ed-ink-muted)', display: 'flex' }}>
                    {showPwCurrent ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>新密码</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwNew ? 'text' : 'password'} value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="至少6位" style={{ ...inputStyle, paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPwNew(!showPwNew)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ed-ink-muted)', display: 'flex' }}>
                      {showPwNew ? '🙈' : '👁'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 4 }}>密码至少6位，建议包含字母和数字</p>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ed-ink-soft)' }}>确认新密码</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwNew ? 'text' : 'password'} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="再次输入" style={{ ...inputStyle, paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPwNew(!showPwNew)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ed-ink-muted)', display: 'flex' }}>
                      {showPwNew ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              </div>
              {pwMsg && <p style={{ fontSize: 13, color: pwMsg.includes('已') ? '#2D8A4E' : 'var(--ed-accent)', marginBottom: 12 }}>{pwMsg}</p>}
              <button onClick={handleChangePassword} style={{ padding: '10px 32px', borderRadius: 'var(--ed-radius-md)', border: 'none', background: 'var(--ed-ink)', color: 'var(--ed-paper)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>更新密码</button>
            </div>

            {/* Danger zone */}
            <div>
              <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--ed-line)', color: 'var(--ed-accent)' }}>危险操作</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); window.location.href = '/'; }} style={{ padding: '8px 20px', borderRadius: 'var(--ed-radius-md)', border: '1px solid var(--ed-line)', background: '#fff', fontSize: 13, cursor: 'pointer', color: 'var(--ed-ink-soft)' }}>退出登录</button>
                <button style={{ padding: '8px 20px', borderRadius: 'var(--ed-radius-md)', border: '1px solid rgba(199,62,29,0.2)', background: '#fff', fontSize: 13, cursor: 'pointer', color: 'var(--ed-accent)' }}>删除账号</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
