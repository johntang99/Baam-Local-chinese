import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('forum')} · Baam`,
    description: '纽约华人社区论坛，分享生活经验、求助互助、讨论本地话题',
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ForumHomePage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch forum boards
  const { data: rawScopedBoards } = await supabase
    .from('categories_forum')
    .select('*')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  let boards = (rawScopedBoards || []) as AnyRow[];
  if (boards.length === 0 && siteScope === 'en') {
    const { data: rawZhBoards } = await supabase
      .from('categories_forum')
      .select('*')
      .eq('site_scope', 'zh')
      .order('sort_order', { ascending: true });
    boards = (rawZhBoards || []) as AnyRow[];
  }

  // Fetch hot threads: weighted by replies and views
  const { data: rawHotThreads } = await supabase
    .from('forum_threads')
    .select('*')
    .eq('status', 'published')
    .eq('site_id', site.id)
    .order('reply_count', { ascending: false })
    .limit(10);

  const hotThreads = (rawHotThreads || []) as AnyRow[];

  return (
    <main>
      <PageContainer className="py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>💬</span> 社区论坛
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              分享经验、互助解答、讨论纽约华人生活
            </p>
          </div>
        </div>

        {/* Board Card Grid */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">版块</h2>
          {boards.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-text-secondary">暂无版块</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/forum/${board.slug}`}
                  className="block cursor-pointer"
                >
                  <Card className="p-5 h-full hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{board.emoji || board.icon || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1">{board.name_zh || board.name || board.name_en}</h3>
                        {board.description && (
                          <p className="text-xs text-text-secondary line-clamp-2">{board.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-text-muted">今日帖子 --</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Hot Threads */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🔥</span> 热门讨论
          </h2>
          {hotThreads.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-text-secondary">暂无热门帖子</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hotThreads.map((thread) => {
                const timeAgo = formatTimeAgo(thread.created_at);
                return (
                  <Link
                    key={thread.id}
                    href={`/forum/${thread.board_slug || 'general'}/${thread.slug}`}
                    className="block cursor-pointer"
                  >
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {thread.board_name && (
                          <Badge className="text-xs bg-blue-100 text-blue-700">{thread.board_name}</Badge>
                        )}
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                      </div>
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                        {thread.title_zh || thread.title}
                      </h3>
                      {thread.ai_summary_zh && (
                        <div className="ai-summary-card mt-2 mb-2">
                          <p className="text-xs text-text-secondary line-clamp-2">{thread.ai_summary_zh}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>💬 {thread.reply_count || 0}</span>
                        <span>👀 {thread.view_count || 0}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
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
