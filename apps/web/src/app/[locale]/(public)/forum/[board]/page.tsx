import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Pagination } from '@/components/shared/pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

interface Props {
  params: Promise<{ locale: string; board: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board, locale } = await params;
  const supabase = await createClient();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  const { data: scopedData } = await supabase
    .from('categories_forum')
    .select('name_zh, name_en, description, slug')
    .eq('slug', board)
    .eq('site_scope', siteScope)
    .single();
  let boardData = scopedData as AnyRow | null;
  if (!boardData && siteScope === 'en') {
    const { data: zhData } = await supabase
      .from('categories_forum')
      .select('name_zh, name_en, description, slug')
      .eq('slug', board)
      .eq('site_scope', 'zh')
      .single();
    boardData = zhData as AnyRow | null;
  }
  if (!boardData) return { title: 'Not Found' };

  return {
    title: `${boardData.name_zh || boardData.name || boardData.name_en} · 社区论坛 · Baam`,
    description: boardData.description || '',
  };
}

export default async function ForumBoardPage({ params, searchParams }: Props) {
  const { board, locale } = await params;
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const sortBy = sp.sort || 'latest_reply';
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch board info
  const { data: rawScopedBoard } = await supabase
    .from('categories_forum')
    .select('*')
    .eq('slug', board)
    .eq('site_scope', siteScope)
    .single();
  let boardData = rawScopedBoard as AnyRow | null;
  if (!boardData && siteScope === 'en') {
    const { data: rawZhBoard } = await supabase
      .from('categories_forum')
      .select('*')
      .eq('slug', board)
      .eq('site_scope', 'zh')
      .single();
    boardData = rawZhBoard as AnyRow | null;
  }
  if (!boardData) notFound();

  // Count total threads
  const { count } = await supabase
    .from('forum_threads')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardData.id)
    .eq('status', 'published')
    .eq('site_id', site.id);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Build query with sort
  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = supabase
    .from('forum_threads')
    .select('*')
    .eq('board_id', boardData.id)
    .eq('status', 'published')
    .eq('site_id', site.id)
    .order('is_pinned', { ascending: false });

  if (sortBy === 'newest') {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  } else if (sortBy === 'hot') {
    dataQuery = dataQuery.order('reply_count', { ascending: false });
  } else {
    dataQuery = dataQuery.order('last_replied_at', { ascending: false });
  }

  const { data: rawThreads } = await dataQuery.range(from, from + PAGE_SIZE - 1);
  const threads = (rawThreads || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (sortBy !== 'latest_reply') preservedParams.sort = sortBy;

  const sortOptions = [
    { key: 'latest_reply', label: '最新回复' },
    { key: 'newest', label: '最新发布' },
    { key: 'hot', label: '最热' },
  ];

  return (
    <main>
      <PageContainer className="py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/forum" className="hover:text-primary">论坛</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">{boardData.name_zh || boardData.name || boardData.name_en}</span>
        </nav>

        <div className="lg:flex gap-8">
          <div className="flex-1">
            {/* Board Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>{boardData.emoji || boardData.icon || '📋'}</span>
                {boardData.name_zh || boardData.name || boardData.name_en}
              </h1>
              {boardData.description && (
                <p className="text-sm text-text-secondary mt-1">{boardData.description}</p>
              )}
            </div>

            {/* Sort Buttons — now functional */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
              {sortOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={opt.key === 'latest_reply' ? `/forum/${board}` : `/forum/${board}?sort=${opt.key}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'rounded-full', `${
                    sortBy === opt.key
                      ? 'bg-primary text-text-inverse'
                      : 'bg-border-light text-text-secondary hover:bg-gray-200'
                  }`)}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {/* Thread List */}
            {threads.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">💬</p>
                <p className="text-text-secondary">该版块还没有帖子</p>
                <p className="text-text-muted text-sm mt-1">成为第一个发帖的人吧</p>
                <Link href="/forum/new" className={cn(buttonVariants(), 'mt-4 inline-block')}>发布新帖</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {threads.map((thread) => {
                  const timeAgo = formatTimeAgo(thread.last_replied_at || thread.created_at);
                  return (
                    <Link
                      key={thread.id}
                      href={`/forum/${board}/${thread.slug}`}
                      className="block cursor-pointer"
                    >
                      <Card className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {thread.is_pinned && (
                                <Badge className="text-xs bg-red-100 text-red-700">置顶</Badge>
                              )}
                              <h3 className="font-semibold text-sm line-clamp-1">
                                {thread.title_zh || thread.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-text-muted">
                              <span>{thread.author_name || '匿名用户'}</span>
                              <span>{timeAgo}</span>
                              <span className="flex items-center gap-1">💬 {thread.reply_count || 0}</span>
                              <span className="flex items-center gap-1">👀 {thread.view_count || 0}</span>
                              {thread.ai_summary_zh && (
                                <span className="text-primary" title="AI 速读可用">🤖</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={`/forum/${board}`}
              searchParams={preservedParams}
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            <Card className="bg-bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">📜 版规</h3>
              <ul className="text-xs text-text-secondary space-y-2">
                <li>1. 请遵守社区规范，文明发言</li>
                <li>2. 禁止发布广告和垃圾信息</li>
                <li>3. 尊重他人隐私，不要人身攻击</li>
                <li>4. 请使用正确的版块发帖</li>
              </ul>
            </Card>
            <Card className="bg-bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">🏪 相关商家</h3>
              <p className="text-xs text-text-muted">商家推荐将在这里显示</p>
            </Card>
          </aside>
        </div>
      </PageContainer>

      {/* Floating New Post Button */}
      <Link
        href="/forum/new"
        className={cn(buttonVariants({ size: 'icon' }), 'fab fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow text-2xl z-50')}
        style={{ backgroundColor: 'var(--color-accent-orange, #f97316)' }}
      >
        ✏️
      </Link>
    </main>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
