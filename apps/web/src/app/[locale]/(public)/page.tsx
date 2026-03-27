import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { NewsletterForm } from '@/components/shared/newsletter-form';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

// Badge config for news verticals
const verticalBadge: Record<string, { label: string; cls: string }> = {
  news_alert: { label: '快报', cls: 'bg-red-100 text-red-700' },
  news_brief: { label: '政策', cls: 'bg-blue-100 text-blue-700' },
  news_explainer: { label: '解读', cls: 'bg-purple-100 text-purple-700' },
  news_roundup: { label: '汇总', cls: 'bg-primary-100 text-primary-700' },
  news_community: { label: '社区', cls: 'bg-green-100 text-green-700' },
};

// Guide type badges
const guideBadge: Record<string, { label: string; cls: string }> = {
  guide_howto: { label: 'How-To', cls: 'bg-blue-100 text-blue-700' },
  guide_checklist: { label: 'Checklist', cls: 'bg-green-100 text-green-700' },
  guide_bestof: { label: 'Best-of', cls: 'bg-yellow-100 text-yellow-700' },
  guide_comparison: { label: '对比', cls: 'bg-purple-100 text-purple-700' },
  guide_scenario: { label: '场景', cls: 'bg-primary-100 text-primary-700' },
};

// Guide cover gradient colors
const guideGradients = [
  'from-blue-100 to-blue-200', 'from-green-100 to-green-200',
  'from-purple-100 to-purple-200', 'from-orange-100 to-orange-200',
];
const guideEmojis: Record<string, string> = {
  guide_howto: '📝', guide_checklist: '✅', guide_bestof: '🏆',
  guide_comparison: '⚖️', guide_scenario: '🎭',
};

// Category names for guides
const guideCategoryNames: Record<string, string> = {
  'guide-medical': '医疗健康', 'guide-new-immigrant': '新移民与安家',
  'guide-tax-business': '报税创业', 'guide-dmv-transport': '驾照交通',
  'guide-education': '教育学区', 'guide-housing': '租房买房',
};

// Forum board badge colors
const boardBadge: Record<string, { cls: string }> = {
  'forum-food': { cls: 'bg-primary-100 text-primary-700' },
  'forum-housing': { cls: 'bg-blue-100 text-blue-700' },
  'forum-medical': { cls: 'bg-green-100 text-green-700' },
  'forum-education': { cls: 'bg-purple-100 text-purple-700' },
  'forum-legal': { cls: 'bg-red-100 text-red-700' },
  'forum-finance': { cls: 'bg-yellow-100 text-yellow-700' },
  'forum-dmv': { cls: 'bg-cyan-100 text-cyan-700' },
  'forum-secondhand': { cls: 'bg-gray-100 text-gray-600' },
  'forum-expose': { cls: 'bg-red-100 text-red-700' },
  'forum-events': { cls: 'bg-primary-100 text-primary-700' },
};

// Voice avatar gradient colors
const voiceGradients = [
  'from-pink-200 to-pink-300', 'from-blue-200 to-blue-300',
  'from-yellow-200 to-yellow-300', 'from-green-200 to-green-300',
  'from-purple-200 to-purple-300', 'from-cyan-200 to-cyan-300',
];
const voiceEmojis: Record<string, string> = {
  expert: '👩‍⚕️', professional: '🏠', creator: '🍜', user: '👤',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(ms / 86400000);
  if (days < 7) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default async function HomePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  // Parallel queries
  const [
    { data: rNews }, { data: rGuides }, { data: rBiz },
    { data: rThreads }, { data: rEvents }, { data: rVoices },
    { data: rAlerts }, { data: rCategories }, { data: rBoards },
  ] = await Promise.all([
    supabase.from('articles').select('*').in('content_vertical', ['news_alert','news_brief','news_explainer','news_roundup','news_community']).eq('editorial_status', 'published').order('published_at', { ascending: false }).limit(3),
    supabase.from('articles').select('*').in('content_vertical', ['guide_howto','guide_checklist','guide_bestof','guide_comparison','guide_scenario']).eq('editorial_status', 'published').order('view_count', { ascending: false }).limit(4),
    supabase.from('businesses').select('*').eq('is_active', true).eq('status', 'active').order('is_featured', { ascending: false }).order('avg_rating', { ascending: false }).limit(6),
    supabase.from('forum_threads').select('*').eq('status', 'published').order('reply_count', { ascending: false }).limit(5),
    supabase.from('events').select('*').eq('status', 'published').order('start_at', { ascending: true }).limit(4),
    supabase.from('profiles').select('*').in('profile_type', ['creator','expert','professional','community_leader','business_owner']).order('follower_count', { ascending: false }).limit(4),
    supabase.from('articles').select('*').eq('content_vertical', 'news_alert').eq('editorial_status', 'published').order('published_at', { ascending: false }).limit(1),
    supabase.from('categories').select('id, slug, name_zh').eq('type', 'article'),
    supabase.from('categories').select('id, slug, name_zh').eq('type', 'forum'),
  ]);

  const news = (rNews || []) as AnyRow[];
  const guides = (rGuides || []) as AnyRow[];
  const businesses = (rBiz || []) as AnyRow[];
  const threads = (rThreads || []) as AnyRow[];
  const events = (rEvents || []) as AnyRow[];
  const voices = (rVoices || []) as AnyRow[];
  const alerts = (rAlerts || []) as AnyRow[];
  const cats = (rCategories || []) as AnyRow[];
  const boards = (rBoards || []) as AnyRow[];

  // Maps
  const catNameMap: Record<string, string> = {};
  cats.forEach(c => catNameMap[c.id] = c.name_zh || c.slug);
  const boardMap: Record<string, AnyRow> = {};
  boards.forEach(b => boardMap[b.id] = b);

  return (
    <main>
      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2.5 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span className="flex-1"><strong>紧急提醒：</strong>{alerts[0].title_zh}</span>
          <Link href={`/news/${alerts[0].slug}`} className="text-white/80 hover:text-white underline text-xs ml-2">详情 →</Link>
        </div>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-orange-600 text-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t('home.heroTitle')}</h1>
          <p className="text-orange-100 mb-8 text-lg">{t('home.heroSubtitle')}</p>
          <form action="/zh/ask" className="relative max-w-2xl mx-auto">
            <input type="text" name="q" placeholder="问我任何本地问题... 例如「法拉盛中文牙医推荐」" className="w-full h-14 pl-5 pr-14 rounded-xl text-gray-900 text-base shadow-lg border-0 focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400" />
            <button type="submit" className="absolute right-2 top-2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
          </form>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {['中文家庭医生', '报税服务', '驾照路考', '周末活动', '租房'].map(tag => (
              <Link key={tag} href={`/ask?q=${encodeURIComponent(tag)}`} className="px-3 py-1 bg-white/20 text-white/90 text-sm rounded-full cursor-pointer hover:bg-white/30">{tag}</Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">

        {/* ===== TODAY'S NEWS ===== */}
        {news.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">📰 {t('home.todayNews')}</h2>
              <Link href="/news" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {news.map((a) => {
                const badge = verticalBadge[a.content_vertical] || { label: '新闻', cls: 'bg-gray-100 text-gray-600' };
                return (
                  <Link key={a.id} href={`/news/${a.slug}`} className="card p-5 block">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs text-text-muted">{timeAgo(a.published_at)}</span>
                    </div>
                    <h3 className="font-semibold text-base mb-2 line-clamp-2">{a.title_zh || a.title_en}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2">{a.ai_summary_zh || a.summary_zh}</p>
                    {a.source_name && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-text-muted bg-gray-100 px-2 py-0.5 rounded">{a.source_type === 'official_gov' ? 'A类来源' : '来源'}</span>
                        <span className="text-xs text-text-muted">{a.source_name}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== HOT GUIDES ===== */}
        {guides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">📚 {t('home.hotGuides')}</h2>
              <Link href="/guides" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {guides.map((g, i) => {
                const gBadge = guideBadge[g.content_vertical] || { label: '指南', cls: 'bg-gray-100 text-gray-600' };
                const catName = g.category_id ? (catNameMap[g.category_id] || '') : '';
                const gradient = guideGradients[i % guideGradients.length];
                const emoji = guideEmojis[g.content_vertical] || '📚';
                return (
                  <Link key={g.id} href={`/guides/${g.slug}`} className="card block cursor-pointer">
                    <div className={`h-40 bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl`}>{emoji}</div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${gBadge.cls}`}>{gBadge.label}</span>
                        {catName && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{catName}</span>}
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1">{g.title_zh || g.title_en}</h3>
                      <p className="text-xs text-text-muted">适合：{(g.audience_types || ['所有人']).join(' · ')} · {Math.ceil((g.body_zh?.length || 500) / 400)}分钟阅读</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== LOCAL VOICES ===== */}
        {voices.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">🎙️ {t('home.localVoices')}</h2>
              <Link href="/voices" className="text-sm text-primary font-medium hover:underline">{t('home.viewMore')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {voices.map((v, i) => {
                const gradient = voiceGradients[i % voiceGradients.length];
                const emoji = voiceEmojis[v.profile_type] || '👤';
                return (
                  <div key={v.id} className="card p-5 text-center">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} mx-auto mb-3 flex items-center justify-center text-2xl`}>{emoji}</div>
                    <h3 className="font-semibold text-sm">{v.display_name}</h3>
                    {v.is_verified && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        <span className="text-xs text-blue-600">认证{v.profile_type === 'expert' ? '专家' : v.profile_type === 'professional' ? '专业人士' : '达人'}</span>
                      </div>
                    )}
                    <p className="text-xs text-text-muted mt-1">{v.headline || v.profile_type}</p>
                    <p className="text-xs text-text-muted">{v.follower_count || 0} 粉丝</p>
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">{v.bio_zh || v.bio}</p>
                    <button className="mt-3 w-full py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition">+ 关注</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== WEEKEND EVENTS ===== */}
        {events.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">🎪 周末活动精选</h2>
              <Link href="/events" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {events.map((e, i) => {
                const gradient = ['from-red-100 to-pink-200', 'from-blue-100 to-cyan-200', 'from-green-100 to-emerald-200', 'from-purple-100 to-violet-200'][i % 4];
                const emoji = ['🎆', '📚', '🎨', '🏃'][i % 4];
                const startDate = e.start_at ? new Date(e.start_at) : null;
                return (
                  <Link key={e.id} href={`/events/${e.slug}`} className="card block cursor-pointer">
                    <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center text-3xl`}>{emoji}</div>
                    <div className="p-4">
                      {startDate && (
                        <p className="text-xs text-primary font-medium mb-1">
                          {startDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                          {' '}
                          {['周日','周一','周二','周三','周四','周五','周六'][startDate.getDay()]}
                          {' · '}
                          {startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{e.title_zh}</h3>
                      <p className="text-xs text-text-muted">{e.venue_name} · {e.is_free ? '免费' : e.ticket_price || '付费'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== RECOMMENDED BUSINESSES ===== */}
        {businesses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">🏪 {t('home.recommendedBusinesses')}</h2>
              <Link href="/businesses" className="text-sm text-primary font-medium hover:underline">{t('home.browseDirectory')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {businesses.map((biz) => (
                <Link key={biz.id} href={`/businesses/${biz.slug}`} className={`card p-5 block ${biz.is_featured ? 'border-2 border-primary relative' : ''}`}>
                  {biz.is_featured && (
                    <span className="absolute top-3 right-0 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-l-md">推荐</span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-200 to-blue-300 flex-shrink-0 flex items-center justify-center text-xl">
                      {(biz.display_name_zh || biz.display_name)?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{biz.display_name_zh || biz.display_name}</h3>
                        {biz.verification_status === 'verified' && (
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        )}
                      </div>
                      {biz.avg_rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500 text-xs">{'★'.repeat(Math.round(Number(biz.avg_rating)))}</span>
                          <span className="text-xs text-text-muted">{Number(biz.avg_rating).toFixed(1)} ({biz.review_count}评价)</span>
                        </div>
                      )}
                      {biz.ai_tags && (biz.ai_tags as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(biz.ai_tags as string[]).slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-text-muted mt-2">{biz.short_desc_zh || ''}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== FORUM HOT THREADS ===== */}
        {threads.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">💬 {t('home.forumHotThreads')}</h2>
              <Link href="/forum" className="text-sm text-primary font-medium hover:underline">{t('home.enterForum')} →</Link>
            </div>
            <div className="bg-bg-card rounded-xl border border-border divide-y divide-border-light">
              {threads.map((thread) => {
                const board = boardMap[thread.board_id];
                const bSlug = board?.slug || '';
                const bName = board?.name_zh || '';
                const bCls = boardBadge[bSlug]?.cls || 'bg-gray-100 text-gray-600';
                const isHot = (thread.reply_count || 0) >= 50;
                return (
                  <Link key={thread.id} href={`/forum/${bSlug}/${thread.slug}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition block">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {bName && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bCls}`}>{bName}</span>}
                        {isHot && <span className="text-xs text-red-500 font-medium">🔥 热帖</span>}
                      </div>
                      <h3 className="text-sm font-medium truncate">{thread.title}</h3>
                      {thread.ai_summary_zh && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-1">AI摘要：{thread.ai_summary_zh}</p>
                      )}
                    </div>
                    <div className="text-center flex-shrink-0">
                      <p className="text-sm font-bold text-primary">{thread.reply_count || 0}</p>
                      <p className="text-xs text-text-muted">回复</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== NEWSLETTER ===== */}
        <section className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <h2 className="text-xl font-bold mb-2">📬 {t('home.newsletter.title')}</h2>
          <p className="text-sm text-text-secondary mb-5">{t('home.newsletter.subtitle')}</p>
          <NewsletterForm source="homepage" className="max-w-md mx-auto" />
          <p className="text-xs text-text-muted mt-3">{t('home.newsletter.subscriberCount', { count: '1,200' })}</p>
        </section>

      </div>
    </main>
  );
}
