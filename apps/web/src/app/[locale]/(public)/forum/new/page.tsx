import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { ForumNewPostForm } from './form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '发布新帖 · 社区论坛 · Baam',
    description: '在 Baam 社区论坛发布新帖子',
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ForumNewPostPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch all forum boards for the selector
  const { data: rawScopedBoards } = await supabase
    .from('categories_forum')
    .select('id, slug, name_zh, name_en, icon, site_scope')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  let boardRows = (rawScopedBoards || []) as AnyRow[];
  if (boardRows.length === 0 && siteScope === 'en') {
    const { data: rawZhBoards } = await supabase
      .from('categories_forum')
      .select('id, slug, name_zh, name_en, icon, site_scope')
      .eq('site_scope', 'zh')
      .order('sort_order', { ascending: true });
    boardRows = (rawZhBoards || []) as AnyRow[];
  }
  const boards = (boardRows.map((board: AnyRow) => ({
    ...board,
    name: board.name || board.name_en,
    emoji: board.emoji || board.icon,
  }))) as AnyRow[];

  return (
    <main>
      <PageContainer className="max-w-3xl py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/forum" className="hover:text-primary">论坛</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">发布新帖</span>
        </nav>

        <h1 className="text-2xl font-bold mb-6">发布新帖</h1>

        <ForumNewPostForm boards={boards} isLoggedIn={!!user} />
      </PageContainer>
    </main>
  );
}
