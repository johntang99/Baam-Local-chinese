import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Pagination } from '@/components/shared/pagination';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('news')} · Baam`,
    description: '纽约本地新闻、政策变化、社区动态、活动公告',
  };
}

const verticalConfig: Record<string, { label: string; className: string; key: string }> = {
  news_alert: { label: '快报', className: 'bg-red-100 text-red-700', key: 'alert' },
  news_brief: { label: '简报', className: 'bg-blue-100 text-blue-700', key: 'brief' },
  news_explainer: { label: '政策解读', className: 'bg-purple-100 text-purple-700', key: 'explainer' },
  news_roundup: { label: '周度汇总', className: 'bg-primary-100 text-primary-700', key: 'roundup' },
  news_community: { label: '社区新闻', className: 'bg-green-100 text-green-700', key: 'community' },
};

const filterTabs = [
  { key: 'all', label: '全部', verticals: ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'] },
  { key: 'alert', label: '快报', verticals: ['news_alert'] },
  { key: 'brief', label: '简报', verticals: ['news_brief'] },
  { key: 'explainer', label: '解读', verticals: ['news_explainer'] },
  { key: 'roundup', label: '汇总', verticals: ['news_roundup'] },
  { key: 'community', label: '社区', verticals: ['news_community'] },
];

interface Props {
  searchParams: Promise<{ page?: string; type?: string }>;
}

export default async function NewsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeType = sp.type || 'all';
  const activeTab = filterTabs.find(t => t.key === activeType) || filterTabs[0];

  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();

  // Count total for pagination
  const countQuery = supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .in('content_vertical', activeTab.verticals)
    .eq('editorial_status', 'published');
  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch page of articles
  const from = (currentPage - 1) * PAGE_SIZE;
  const { data: rawArticles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', activeTab.verticals)
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const articles = (rawArticles || []) as AnyRow[];

  // Fetch active alerts (always show)
  const { data: rawAlerts } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('content_vertical', 'news_alert')
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(3);

  const alerts = (rawAlerts || []) as AnyRow[];
  const hasAlerts = alerts.length > 0;

  // Build preserved search params for pagination links
  const preservedParams: Record<string, string> = {};
  if (activeType !== 'all') preservedParams.type = activeType;

  return (
    <main>
      {/* Alert Banner */}
      {hasAlerts && (
        <div className="alert-banner">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">
            <strong>紧急提醒：</strong>
            {alerts[0].title_zh}
          </span>
          <Link href={`/news/${alerts[0].slug}`} className="text-white/90 underline hover:text-white ml-2 text-sm">
            查看详情 →
          </Link>
        </div>
      )}

      <PageContainer className="py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>📰</span> {t('nav.news')}
          </h1>
        </div>

        <div className="lg:flex gap-8">
          <div className="flex-1">
            {/* Filter Tabs — now functional links */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
              {filterTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === 'all' ? '/news' : `/news?type=${tab.key}`}
                  className={cn(
                    buttonVariants({ size: 'sm' }),
                    'rounded-full',
                    activeType === tab.key
                      ? 'bg-primary text-text-inverse'
                      : 'bg-border-light text-text-secondary hover:bg-gray-200 hover:text-text-primary'
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {/* News List */}
            {error ? (
              <p className="text-text-secondary py-8 text-center">加载新闻时出错，请稍后重试。</p>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">📰</p>
                <p className="text-text-secondary">暂无新闻内容</p>
                <p className="text-text-muted text-sm mt-1">新闻将在这里显示</p>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => {
                  const vertical = verticalConfig[article.content_vertical] || {
                    label: '新闻',
                    className: 'bg-gray-100 text-gray-700',
                  };
                  const summary = article.ai_summary_zh || article.summary_zh;
                  const timeAgo = formatTimeAgo(article.published_at);

                  return (
                    <Link
                      key={article.id}
                      href={`/news/${article.slug}`}
                      className="block cursor-pointer"
                    >
                      <Card
                        className={cn(
                          'p-5 hover:shadow-md transition-shadow',
                          article.content_vertical === 'news_alert'
                            ? 'border-l-4 border-l-accent-red bg-accent-red-light/30'
                            : ''
                        )}
                      >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn('text-xs', vertical.className)}>{vertical.label}</Badge>
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                        {article.source_name && (
                          <Badge variant="muted" className="text-xs">
                            {article.source_name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-2 line-clamp-2">
                        {article.title_zh || article.title_en}
                      </h3>
                      {summary && (
                        <p className="text-sm text-text-secondary line-clamp-2">{summary}</p>
                      )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/news"
              searchParams={preservedParams}
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            <Card className="bg-bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">📬 订阅本地周报</h3>
              <p className="text-xs text-text-secondary mb-3">每周精选本地新闻、指南、活动</p>
              <NewsletterForm source="news_sidebar" />
            </Card>
          </aside>
        </div>
      </PageContainer>
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
