import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('news')} · Baam`,
    description: '纽约本地新闻、政策变化、社区动态、活动公告',
  };
}

// Badge color mapping for content verticals
const verticalConfig: Record<string, { label: string; className: string }> = {
  news_alert: { label: '快报', className: 'badge-red' },
  news_brief: { label: '简报', className: 'badge-blue' },
  news_explainer: { label: '政策解读', className: 'badge-purple' },
  news_roundup: { label: '周度汇总', className: 'badge-primary' },
  news_community: { label: '社区新闻', className: 'badge-green' },
};

export default async function NewsListPage() {
  const supabase = await createClient();
  const t = await getTranslations();

  // Fetch published news articles, newest first
  const { data: rawArticles, error } = await supabase
    .from('articles')
    .select('*')
    .in('content_vertical', [
      'news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community',
    ])
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(20);

  const articles = (rawArticles || []) as AnyRow[];

  // Fetch active alerts (unexpired)
  const { data: rawAlerts } = await supabase
    .from('articles')
    .select('*')
    .eq('content_vertical', 'news_alert')
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(3);

  const alerts = (rawAlerts || []) as AnyRow[];

  const hasAlerts = alerts.length > 0;

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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>📰</span> {t('nav.news')}
          </h1>
        </div>

        <div className="lg:flex gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Filter Tabs */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-primary text-text-inverse">全部</button>
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-border-light text-text-secondary hover:bg-gray-200">快报</button>
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-border-light text-text-secondary hover:bg-gray-200">简报</button>
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-border-light text-text-secondary hover:bg-gray-200">解读</button>
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-border-light text-text-secondary hover:bg-gray-200">汇总</button>
              <button className="px-4 py-2 text-sm font-medium rounded-full bg-border-light text-text-secondary hover:bg-gray-200">社区</button>
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
                    className: 'badge-gray',
                  };
                  const summary = article.ai_summary_zh || article.summary_zh;
                  const timeAgo = formatTimeAgo(article.published_at);

                  return (
                    <Link
                      key={article.id}
                      href={`/news/${article.slug}`}
                      className={`card p-5 block cursor-pointer ${
                        article.content_vertical === 'news_alert'
                          ? 'border-l-4 border-l-accent-red bg-accent-red-light/30'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`badge ${vertical.className}`}>{vertical.label}</span>
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                        {article.source_name && (
                          <span className="text-xs text-text-muted bg-border-light px-2 py-0.5 rounded">
                            {article.source_name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-2 line-clamp-2">
                        {article.title_zh || article.title_en}
                      </h3>
                      {summary && (
                        <p className="text-sm text-text-secondary line-clamp-2">{summary}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            {/* Newsletter Subscribe */}
            <div className="bg-bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">📬 订阅本地周报</h3>
              <p className="text-xs text-text-secondary mb-3">每周精选本地新闻、指南、活动</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="输入邮箱"
                  className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <button className="btn btn-primary h-9 px-4 text-sm">订阅</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
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
