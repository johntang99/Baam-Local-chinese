import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { EditPostForm } from './edit-form';
import { PageContainer } from '@/components/layout/page-shell';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: '编辑帖子',
};

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function EditPostPage({ params }: Props) {
  const { slug, locale } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect(`/${locale}/discover`);

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('site_id', site.id)
    .single() as { data: Record<string, any> | null };

  if (!post || post.author_id !== currentUser.id) notFound();

  // Fetch linked businesses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLinkedBiz } = await (supabase as any)
    .from('discover_post_businesses')
    .select('*, businesses(id, slug, display_name, display_name_zh, address_full)')
    .eq('post_id', post.id)
    .order('sort_order', { ascending: true });

  const linkedBusinesses = ((rawLinkedBiz || []) as AnyRow[])
    .map(r => r.businesses)
    .filter(Boolean);

  return (
    <main className="bg-bg-page min-h-screen">
      <PageContainer className="py-8 max-w-2xl">
        <h1 className="text-xl font-bold mb-6">编辑帖子</h1>
        <EditPostForm post={post} linkedBusinesses={linkedBusinesses} />
      </PageContainer>
    </main>
  );
}
