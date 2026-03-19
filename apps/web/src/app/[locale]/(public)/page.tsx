import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function HomePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  // Parallel data fetching for all homepage sections
  const [
    { data: rawNews },
    { data: rawGuides },
    { data: rawBusinesses },
    { data: rawThreads },
    { data: rawEvents },
    { data: rawVoices },
    { data: rawAlerts },
  ] = await Promise.all([
    // Latest news (3)
    supabase.from('articles').select('*')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .eq('editorial_status', 'published')
      .order('published_at', { ascending: false }).limit(3),
    // Hot guides (4)
    supabase.from('articles').select('*')
      .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison'])
      .eq('editorial_status', 'published')
      .order('view_count', { ascending: false }).limit(4),
    // Recommended businesses (6)
    supabase.from('businesses').select('*')
      .eq('is_active', true).eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('avg_rating', { ascending: false }).limit(6),
    // Hot threads (5)
    supabase.from('forum_threads').select('*')
      .eq('status', 'published')
      .order('reply_count', { ascending: false }).limit(5),
    // Weekend events (4)
    supabase.from('events').select('*')
      .eq('status', 'published')
      .order('start_at', { ascending: true }).limit(4),
    // Featured voices (4)
    supabase.from('profiles').select('*')
      .in('profile_type', ['creator', 'expert', 'professional', 'community_leader', 'business_owner'])
      .order('follower_count', { ascending: false }).limit(4),
    // Active alerts
    supabase.from('articles').select('*')
      .eq('content_vertical', 'news_alert').eq('editorial_status', 'published')
      .order('published_at', { ascending: false }).limit(1),
  ]);

  const news = (rawNews || []) as AnyRow[];
  const guides = (rawGuides || []) as AnyRow[];
  const businesses = (rawBusinesses || []) as AnyRow[];
  const threads = (rawThreads || []) as AnyRow[];
  const events = (rawEvents || []) as AnyRow[];
  const voices = (rawVoices || []) as AnyRow[];
  const alerts = (rawAlerts || []) as AnyRow[];

  const guideEmoji: Record<string, string> = {
    guide_howto: '📝', guide_checklist: '✅', guide_bestof: '🏆', guide_comparison: '⚖️',
    guide_neighborhood: '🗺️', guide_seasonal: '📅', guide_resource: '📋', guide_scenario: '🎭',
  };

  return (
    <main>
      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="alert-banner">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">
            <strong>紧急提醒：</strong>{alerts[0].title_zh}
          </span>
          <Link href={`/news/${alerts[0].slug}`} className="text-white/90 underline text-sm ml-2">
            详情 →
          </Link>
        </div>
      )}

      {/* Hero / AI Search */}
      <section className="bg-gradient-to-br from-primary to-orange-600 text-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t('home.heroTitle')}</h1>
          <p className="text-orange-100 mb-8 text-lg">{t('home.heroSubtitle')}</p>
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder={t('home.searchPlaceholder')}
              className="w-full h-14 pl-5 pr-14 rounded-xl text-gray-900 text-base shadow-lg border-0 focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400"
            />
            <button className="absolute right-2 top-2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {['中文家庭医生', '报税服务', '驾照路考', '周末活动', '租房'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-white/20 text-white/90 text-sm rounded-full cursor-pointer hover:bg-white/30">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Today's News */}
        {news.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">📰 {t('home.todayNews')}</h2>
              <Link href="/news" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {news.map((article) => (
                <Link key={article.id} href={`/news/${article.slug}`} className="card p-5 block">
                  <h3 className="font-semibold text-base mb-2 line-clamp-2">{article.title_zh || article.title_en}</h3>
                  <p className="text-sm text-text-secondary line-clamp-2">{article.ai_summary_zh || article.summary_zh}</p>
                  <p className="text-xs text-text-muted mt-2">{article.source_name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Hot Guides */}
        {guides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">📚 {t('home.hotGuides')}</h2>
              <Link href="/guides" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {guides.map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.slug}`} className="card block">
                  <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-4xl">
                    {guideEmoji[guide.content_vertical] || '📚'}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2">{guide.title_zh || guide.title_en}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Local Voices */}
        {voices.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">🎙️ {t('home.localVoices')}</h2>
              <Link href="/voices" className="text-sm text-primary font-medium hover:underline">{t('home.viewMore')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {voices.map((voice) => (
                <Link key={voice.id} href={`/voices/${voice.username || voice.id}`} className="card p-5 text-center block">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 mx-auto mb-3 flex items-center justify-center text-2xl">
                    {voice.display_name?.charAt(0) || '👤'}
                  </div>
                  <h3 className="font-semibold text-sm">{voice.display_name}</h3>
                  <p className="text-xs text-text-muted mt-1">{voice.headline || voice.profile_type}</p>
                  <p className="text-xs text-text-muted">{voice.follower_count || 0} 粉丝</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recommended Businesses */}
        {businesses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">🏪 {t('home.recommendedBusinesses')}</h2>
              <Link href="/businesses" className="text-sm text-primary font-medium hover:underline">{t('home.browseDirectory')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {businesses.map((biz) => (
                <Link key={biz.id} href={`/businesses/${biz.slug}`} className={`card p-5 block ${biz.is_featured ? 'card-featured' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex-shrink-0 flex items-center justify-center text-xl">
                      {biz.display_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{biz.display_name}</h3>
                      {biz.avg_rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-accent-yellow text-xs">{'★'.repeat(Math.round(biz.avg_rating))}</span>
                          <span className="text-xs text-text-muted">{biz.avg_rating} ({biz.review_count})</span>
                        </div>
                      )}
                      {biz.ai_tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(biz.ai_tags as string[]).slice(0, 2).map((tag: string) => (
                            <span key={tag} className="text-xs bg-secondary-50 text-secondary-dark px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Forum Hot Threads */}
        {threads.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">💬 {t('home.forumHotThreads')}</h2>
              <Link href="/forum" className="text-sm text-primary font-medium hover:underline">{t('home.enterForum')} →</Link>
            </div>
            <div className="bg-bg-card rounded-xl border border-border divide-y divide-border-light">
              {threads.map((thread) => (
                <Link key={thread.id} href={`/forum/board/${thread.slug}`} className="flex items-center gap-4 p-4 hover:bg-bg-page transition block">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{thread.title}</h3>
                    {thread.ai_summary_zh && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-1">{thread.ai_summary_zh}</p>
                    )}
                  </div>
                  <div className="text-center flex-shrink-0">
                    <p className="text-sm font-bold text-primary">{thread.reply_count || 0}</p>
                    <p className="text-xs text-text-muted">回复</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Newsletter */}
        <section className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <h2 className="text-xl font-bold mb-2">{t('home.newsletter.title')}</h2>
          <p className="text-sm text-text-secondary mb-5">{t('home.newsletter.subtitle')}</p>
          <div className="flex max-w-md mx-auto gap-3">
            <input
              type="email"
              placeholder={t('home.newsletter.placeholder')}
              className="flex-1 h-11 px-4 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button className="btn btn-primary h-11 px-6 text-sm">{t('home.newsletter.subscribe')}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
