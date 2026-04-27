import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { DashboardClient } from './dashboard-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '个人中心 · Baam',
  description: '管理你的帖子、评论、关注和账号设置',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch profile
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  const profile = (rawProfile || {}) as AnyRow;

  // Fetch user's posts (voice_posts)
  const { data: rawPosts } = await supabase
    .from('voice_posts')
    .select('id, slug, title, post_type, like_count, comment_count, view_count, status, published_at, created_at')
    .eq('author_id', user.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(50);
  const posts = (rawPosts || []) as AnyRow[];

  // Fetch user's forum threads
  const { data: rawThreads } = await supabase
    .from('forum_threads')
    .select('id, slug, title, reply_count, view_count, created_at, board_slug')
    .eq('author_id', user.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(20);
  const threads = (rawThreads || []) as AnyRow[];

  // Fetch user's classifieds
  const { data: rawClassifieds } = await supabase
    .from('classifieds')
    .select('id, slug, title, category, status, created_at, view_count, reply_count')
    .eq('author_id', user.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(20);
  const classifieds = (rawClassifieds || []) as AnyRow[];

  // Fetch user's comments
  const { data: rawComments } = await supabase
    .from('voice_post_comments')
    .select('id, content, like_count, created_at, post_id, voice_posts!inner(id, slug, title)')
    .eq('author_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(30);
  const comments = (rawComments || []) as AnyRow[];

  // Fetch following
  const { data: rawFollowing } = await supabase
    .from('follows')
    .select('id, created_at, followed_profile_id, profiles!follows_followed_profile_id_fkey(id, username, display_name, headline, post_count)')
    .eq('follower_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  const following = (rawFollowing || []) as AnyRow[];

  // Compute stats
  const totalViews = posts.reduce((s: number, p: AnyRow) => s + (p.view_count || 0), 0)
    + threads.reduce((s: number, t: AnyRow) => s + (t.view_count || 0), 0);
  const totalLikes = posts.reduce((s: number, p: AnyRow) => s + (p.like_count || 0), 0);

  return (
    <main>
      <DashboardClient
        profile={profile}
        posts={posts}
        threads={threads}
        classifieds={classifieds}
        comments={comments}
        following={following}
        stats={{
          totalViews,
          totalLikes,
          followers: profile.follower_count || 0,
          totalComments: comments.length,
          postCount: posts.length + threads.length + classifieds.length,
        }}
        userEmail={user.email || ''}
      />
    </main>
  );
}
