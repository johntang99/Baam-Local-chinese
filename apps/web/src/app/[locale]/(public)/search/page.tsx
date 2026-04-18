import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '搜索 · Baam',
    description: '搜索本地商家、新闻、指南、达人、活动',
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight occurrences of `query` inside `text`. Returns a ReactNode with
 * matches wrapped in a styled <mark>. Safe on server because it only renders
 * React primitives (string + span).
 */
function highlightMatch(text: string | null | undefined, query: string) {
  const value = String(text ?? '');
  if (!value) return null;
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 1) return value;
  const tokens = trimmed
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map(escapeRegex);
  if (tokens.length === 0) return value;
  const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = value.split(pattern);
  return parts.map((part, index) => {
    if (!part) return null;
    const isMatch = tokens.some((t) => new RegExp(`^${t}$`, 'i').test(part));
    return isMatch ? (
      <mark
        key={`${part}-${index}`}
        className="bg-primary-100 text-primary-dark r-base px-0.5 py-px"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

const searchTabs = [
  { key: 'all', label: '全部' },
  { key: 'biz', label: '商家' },
  { key: 'news', label: '新闻' },
  { key: 'guides', label: '指南' },
  { key: 'forum', label: '论坛' },
  { key: 'voices', label: '达人' },
  { key: 'events', label: '活动' },
];

interface Props {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = sp.q?.trim() || '';
  const activeTab = sp.tab || 'all';
  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();

  // Results containers
  let businesses: AnyRow[] = [];
  let news: AnyRow[] = [];
  let guides: AnyRow[] = [];
  let threads: AnyRow[] = [];
  let voices: AnyRow[] = [];
  let events: AnyRow[] = [];

  if (query) {
    const searchPattern = `%${query}%`;

    // Run queries in parallel based on active tab
    const shouldSearch = (tab: string) => activeTab === 'all' || activeTab === tab;

    const promises: PromiseLike<void>[] = [];

    if (shouldSearch('biz')) {
      promises.push(
        supabase
          .from('businesses')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'active')
          .or(`display_name.ilike.${searchPattern},display_name_zh.ilike.${searchPattern},short_desc_zh.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('is_featured', { ascending: false })
          .limit(activeTab === 'all' ? 6 : 20)
          .then(({ data }) => { businesses = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('news')) {
      promises.push(
        supabase
          .from('articles')
          .select('*')
          .eq('site_id', site.id)
          .eq('editorial_status', 'published')
          .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('published_at', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { news = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('guides')) {
      promises.push(
        supabase
          .from('articles')
          .select('*')
          .eq('site_id', site.id)
          .eq('editorial_status', 'published')
          .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('published_at', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { guides = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('forum')) {
      promises.push(
        supabase
          .from('forum_threads')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'published')
          .or(`title.ilike.${searchPattern},body.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('reply_count', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { threads = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('voices')) {
      promises.push(
        supabase
          .from('profiles')
          .select('*')
          .neq('profile_type', 'user')
          .or(`display_name.ilike.${searchPattern},headline.ilike.${searchPattern},username.ilike.${searchPattern}`)
          .order('follower_count', { ascending: false })
          .limit(activeTab === 'all' ? 4 : 20)
          .then(({ data }) => { voices = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('events')) {
      promises.push(
        supabase
          .from('events')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'published')
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},summary_zh.ilike.${searchPattern},venue_name.ilike.${searchPattern}`)
          .order('start_at', { ascending: true })
          .limit(activeTab === 'all' ? 4 : 20)
          .then(({ data }) => { events = (data || []) as AnyRow[]; })
      );
    }

    await Promise.all(promises);
  }

  const totalResults = businesses.length + news.length + guides.length + threads.length + voices.length + events.length;

  // Generate AI search summary (only when results exist, uses fast Haiku model)
  let aiSummary = '';
  if (query && totalResults > 0) {
    try {
      const { generateSearchSummary } = await import('@/lib/ai/claude');
      const resultTypes = [
        { type: '商家', count: businesses.length },
        { type: '新闻', count: news.length },
        { type: '指南', count: guides.length },
        { type: '论坛帖子', count: threads.length },
        { type: '达人', count: voices.length },
        { type: '活动', count: events.length },
      ].filter(r => r.count > 0);
      const result = await generateSearchSummary(query, resultTypes);
      aiSummary = result.data;
    } catch {
      // AI summary is optional, don't block search results
    }
  }

  const counts: Record<string, number> = {
    all: totalResults,
    biz: businesses.length,
    news: news.length,
    guides: guides.length,
    forum: threads.length,
    voices: voices.length,
    events: events.length,
  };

  return (
    <main>
      <PageContainer className="py-6">
        {/* Search Header */}
        <div className="mb-6">
          <h1 className="text-2xl fw-bold mb-4">搜索</h1>
          <form className="max-w-2xl">
            <input type="hidden" name="tab" value={activeTab} />
            <div className="flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="搜索商家、新闻、指南、达人..."
                className="flex-1 h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <button type="submit" className={cn(buttonVariants(), 'h-11 px-6 text-sm')}>搜索</button>
            </div>
          </form>
        </div>

        {/* Tab chips with counts */}
        {query && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {searchTabs.map((tab) => {
              const count = counts[tab.key] || 0;
              const href = tab.key === 'all' ? `/search?q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}&tab=${tab.key}`;

              return (
                <Link key={tab.key} href={href} className={cn('chip flex-shrink-0', activeTab === tab.key && 'active')}>
                  {tab.label}
                  {query && count > 0 && <span className="ml-1 text-xs opacity-75">({count})</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* Results */}
        {!query ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-text-secondary">输入关键词开始搜索</p>
            <p className="text-text-muted text-sm mt-1">搜索商家、新闻、指南、达人、活动</p>
            {/* Popular Searches */}
            <div className="mt-8 max-w-md mx-auto">
              <p className="text-sm text-text-muted mb-3">热门搜索</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['家庭医生', '报税', '中文律师', '装修', '搬家', '驾照', '月嫂', '学区'].map((term) => (
                  <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="chip">
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : totalResults === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">😔</p>
            <p className="text-text-secondary">没有找到「{query}」的相关结果</p>
            <p className="text-text-muted text-sm mt-1">试试其他关键词或浏览分类</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* AI Summary */}
            {/* AI Summary */}
            {aiSummary && (
              <div className="bg-gradient-to-r from-secondary-50 to-secondary-50 border-l-4 border-secondary r-lg px-5 py-4">
                <p className="text-xs fw-semibold text-secondary-dark mb-1">🤖 AI 搜索摘要</p>
                <p className="text-sm text-text-secondary leading-relaxed">{aiSummary}</p>
              </div>
            )}

            {/* Business Results */}
            {businesses.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">🏪 商家 ({businesses.length})</h2>
                  {activeTab === 'all' && businesses.length >= 6 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=biz`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {businesses.map((biz) => (
                    <Link key={biz.id} href={`/businesses/${biz.slug}`} className="block">
                      <Card className="p-4 h-full">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 r-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">🏢</div>
                        <div className="min-w-0">
                          <h3 className="fw-semibold text-sm truncate">
                            {highlightMatch(biz.display_name_zh || biz.display_name || biz.name_zh, query)}
                          </h3>
                          {biz.category_name && <span className="text-xs text-text-muted">{biz.category_name}</span>}
                        </div>
                      </div>
                      {biz.avg_rating > 0 && (
                        <div className="flex items-center gap-1 text-xs mb-1">
                          <span className="text-accent-yellow">{'★'.repeat(Math.round(biz.avg_rating))}</span>
                          <span className="text-text-muted">{biz.avg_rating?.toFixed(1)} ({biz.review_count || 0})</span>
                        </div>
                      )}
                      {biz.short_desc_zh && <p className="text-xs text-text-muted line-clamp-2">{highlightMatch(biz.short_desc_zh, query)}</p>}
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* News Results */}
            {news.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">📰 新闻 ({news.length})</h2>
                  {activeTab === 'all' && news.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=news`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {news.map((article) => (
                    <Link key={article.id} href={`/news/${article.slug}`} className="block">
                      <Card className="p-4">
                      <h3 className="fw-semibold text-sm mb-1 line-clamp-2">{highlightMatch(article.title_zh || article.title_en, query)}</h3>
                      {(article.ai_summary_zh || article.summary_zh) && (
                        <p className="text-xs text-text-secondary line-clamp-2">{highlightMatch(article.ai_summary_zh || article.summary_zh, query)}</p>
                      )}
                      <span className="text-xs text-text-muted mt-1 block">{article.source_name || ''}</span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Guide Results */}
            {guides.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">📚 指南 ({guides.length})</h2>
                  {activeTab === 'all' && guides.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=guides`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {guides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="block">
                      <Card className="p-4">
                      <h3 className="fw-semibold text-sm mb-1 line-clamp-2">{highlightMatch(guide.title_zh || guide.title_en, query)}</h3>
                      {(guide.ai_summary_zh || guide.summary_zh) && (
                        <p className="text-xs text-text-secondary line-clamp-2">{highlightMatch(guide.ai_summary_zh || guide.summary_zh, query)}</p>
                      )}
                      {guide.audience_tags && Array.isArray(guide.audience_tags) && (
                        <div className="flex gap-1 mt-1">
                          {guide.audience_tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} className="text-xs bg-accent-green-light text-accent-green">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Forum Results */}
            {threads.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">💬 论坛 ({threads.length})</h2>
                  {activeTab === 'all' && threads.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=forum`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <Link key={thread.id} href={`/forum/${thread.board_slug || 'general'}/${thread.slug}`} className="block">
                      <Card className="p-4">
                      <h3 className="fw-semibold text-sm mb-1 line-clamp-1">{highlightMatch(thread.title_zh || thread.title, query)}</h3>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>{thread.author_name || '匿名'}</span>
                        <span>💬 {thread.reply_count || 0}</span>
                        <span>👀 {thread.view_count || 0}</span>
                      </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Voices Results */}
            {voices.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">🎙️ 达人 ({voices.length})</h2>
                  {activeTab === 'all' && voices.length >= 4 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=voices`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {voices.map((voice) => (
                    <Link key={voice.id} href={`/voices/${voice.username}`} className="block">
                      <Card className="p-4 h-full">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 r-full bg-primary/10 flex items-center justify-center text-lg">
                          {voice.display_name?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="fw-medium text-sm truncate">{voice.display_name || voice.username}</h3>
                          {voice.is_verified && <span className="text-xs text-secondary-dark">已认证</span>}
                        </div>
                      </div>
                      {voice.headline && <p className="text-xs text-text-secondary line-clamp-2">{voice.headline}</p>}
                      <span className="text-xs text-text-muted mt-1 block">{voice.follower_count || 0} 关注者</span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Events Results */}
            {events.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg fw-bold">🎉 活动 ({events.length})</h2>
                  {activeTab === 'all' && events.length >= 4 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=events`} className="text-sm text-primary hover:underline">查看全部 →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {events.map((event) => {
                    const startDate = event.start_at ? new Date(event.start_at) : null;
                    const dateStr = startDate ? startDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '';
                    return (
                      <Link key={event.id} href={`/events/${event.slug}`} className="block">
                        <Card className="p-4">
                        <h3 className="fw-semibold text-sm mb-1 line-clamp-2">{event.title_zh || event.title_en || event.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          {dateStr && <span>📅 {dateStr}</span>}
                          {event.venue_name && <span>📍 {event.venue_name}</span>}
                          {event.is_free && <Badge className="text-xs bg-accent-green-light text-accent-green">免费</Badge>}
                        </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </PageContainer>
    </main>
  );
}
