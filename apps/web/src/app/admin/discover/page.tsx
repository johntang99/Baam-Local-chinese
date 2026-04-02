import { createAdminClient } from '@/lib/supabase/admin';
import { DiscoverTable } from './DiscoverTable';

export const metadata = { title: '发现管理 · Admin · Baam' };

export default async function AdminDiscoverPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const [{ data: pending }, { data: all }] = await Promise.all([
    supabase
      .from('voice_posts')
      .select('id, slug, title, content, status, post_type, cover_images, cover_image_url, ai_spam_score, moderation_reason, created_at, profiles:author_id(display_name)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('voice_posts')
      .select('id, slug, title, content, status, post_type, cover_images, cover_image_url, ai_spam_score, moderation_reason, created_at, profiles:author_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">发现管理</h1>
          <p className="text-sm text-gray-500 mt-1">审核用户发布的笔记内容</p>
        </div>
      </div>
      <DiscoverTable pendingPosts={pending || []} allPosts={all || []} />
    </div>
  );
}
