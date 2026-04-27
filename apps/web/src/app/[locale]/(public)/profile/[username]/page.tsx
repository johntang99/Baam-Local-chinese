import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { DiscoverCard } from '@/components/discover/discover-card';
import { MasonryGrid } from '@/components/discover/masonry-grid';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; username: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const profileTypeLabels: Record<string, string> = {
  creator: '创作者', expert: '认证专家', professional: '专业人士',
  community_leader: '社区领袖', business_owner: '商家主理人',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('display_name, headline').eq('username', username).single();
  const profile = data as AnyRow | null;
  if (!profile) return { title: 'Not Found' };
  return {
    title: `${profile.display_name || username} · Baam`,
    description: profile.headline || '',
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();

  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
  const profile = data as AnyRow | null;
  if (error || !profile) notFound();

  const currentUser = await getCurrentUser().catch(() => null);
  const isOwner = currentUser?.id === profile.id;

  // Fetch posts
  const { data: rawPosts } = await supabase
    .from('voice_posts')
    .select('*, profiles:author_id(id, username, display_name, avatar_url, is_verified)')
    .eq('author_id', profile.id)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30);
  const posts = (rawPosts || []) as AnyRow[];

  // Total likes
  const totalLikes = posts.reduce((s: number, p: AnyRow) => s + (p.like_count || 0), 0);

  const avatarInitial = profile.display_name?.[0] || '?';

  return (
    <main>
      {/* Cover */}
      <div style={{ height: 180, background: 'linear-gradient(135deg, var(--ed-paper-warm) 0%, #E8D5BE 40%, #D4C4A8 100%)', position: 'relative' }}>
        {isOwner && (
          <button style={{ position: 'absolute', bottom: 12, right: 12, padding: '5px 12px', borderRadius: 'var(--ed-radius-pill)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 11, border: 'none', cursor: 'pointer' }}>编辑封面</button>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 80px' }}>
        {/* Profile head */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: -40, position: 'relative', zIndex: 2 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', border: '4px solid var(--ed-paper)',
            background: 'var(--ed-accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--ed-font-serif)', fontSize: 34, fontWeight: 700, flexShrink: 0,
          }}>{avatarInitial}</div>
          <div style={{ paddingBottom: 8 }}>
            <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {profile.display_name}
              {profile.is_verified && (
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#3B82F6', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</span>
              )}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--ed-ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              @{profile.username}
              {profile.location_text && <> · {profile.location_text}</>}
              {profile.profile_type && profile.profile_type !== 'user' && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'rgba(199,62,29,0.06)', color: 'var(--ed-accent)', fontWeight: 500 }}>
                  {profileTypeLabels[profile.profile_type] || profile.profile_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p style={{ fontSize: 13, color: 'var(--ed-ink-soft)', margin: '12px 0 0', lineHeight: 1.6 }}>{profile.bio}</p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, margin: '16px 0', padding: '16px 0', borderBottom: '1px solid var(--ed-line)' }}>
          {[
            { num: posts.length, label: '笔记' },
            { num: profile.following_count || 0, label: '关注' },
            { num: profile.follower_count || 0, label: '粉丝' },
            { num: totalLikes, label: '获赞与收藏' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 700 }}>{s.num >= 1000 ? `${(s.num / 1000).toFixed(1)}k` : s.num}</div>
              <div style={{ fontSize: 11, color: 'var(--ed-ink-muted)', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, margin: '0 0 20px' }}>
          {isOwner ? (
            <>
              <Link href="/me?tab=settings" style={{ flex: 1, height: 36, borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line-strong)', background: 'transparent', color: 'var(--ed-ink-soft)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>编辑资料</Link>
              <Link href="/discover/new-post" style={{ flex: 1, height: 36, borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line-strong)', background: 'transparent', color: 'var(--ed-ink-soft)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+ 发布笔记</Link>
            </>
          ) : (
            <>
              <button style={{ flex: 1, height: 36, borderRadius: 'var(--ed-radius-pill)', border: 'none', background: 'var(--ed-accent)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 关注</button>
              <button style={{ flex: 1, height: 36, borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line-strong)', background: 'transparent', color: 'var(--ed-ink-soft)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>私信</button>
            </>
          )}
        </div>

        {/* Posts grid — 4 columns matching Discover */}
        {posts.length > 0 ? (
          <MasonryGrid>
            {posts.map((post, i) => (
              <DiscoverCard key={post.id} post={post} author={profile} index={i} />
            ))}
          </MasonryGrid>
        ) : (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 40, opacity: 0.4, marginBottom: 12 }}>📝</p>
            <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)' }}>还没有发布内容</p>
            {isOwner && <Link href="/discover/new-post" style={{ fontSize: 13, color: 'var(--ed-accent)', fontWeight: 500, marginTop: 8, display: 'inline-block' }}>发布第一篇笔记 →</Link>}
          </div>
        )}
      </div>
    </main>
  );
}
