import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer, SectionBlock, SectionHeader } from '@/components/layout/page-shell';
import { VideoHoverCard } from '@/components/discover/video-hover-card';
import { HeartButton } from '@/components/discover/heart-button';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { pickBusinessDisplayName } from '@/lib/business-name';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

// Badge config for news verticals
const verticalBadge: Record<string, { label: string; cls: string }> = {
  news_alert: { label: '快报', cls: 'bg-accent-red-light text-accent-red' },
  news_brief: { label: '政策', cls: 'bg-accent-blue-light text-secondary-dark' },
  news_explainer: { label: '解读', cls: 'bg-accent-purple-light text-accent-purple' },
  news_roundup: { label: '汇总', cls: 'bg-primary-100 text-primary-700' },
  news_community: { label: '社区', cls: 'bg-accent-green-light text-accent-green' },
};

// Guide type badges
const guideBadge: Record<string, { label: string; cls: string }> = {
  guide_howto: { label: 'How-To', cls: 'bg-accent-blue-light text-secondary-dark' },
  guide_checklist: { label: 'Checklist', cls: 'bg-accent-green-light text-accent-green' },
  guide_bestof: { label: 'Best-of', cls: 'bg-accent-yellow/20 text-accent-yellow' },
  guide_comparison: { label: '对比', cls: 'bg-accent-purple-light text-accent-purple' },
  guide_scenario: { label: '场景', cls: 'bg-primary-100 text-primary-700' },
};

// Guide cover gradient colors
const guideGradients = [
  'from-secondary-light to-secondary-light', 'from-accent-green-light to-accent-green-light',
  'from-accent-purple-light to-accent-purple-light', 'from-primary-100 to-primary-200',
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
  'forum-housing': { cls: 'bg-accent-blue-light text-secondary-dark' },
  'forum-medical': { cls: 'bg-accent-green-light text-accent-green' },
  'forum-education': { cls: 'bg-accent-purple-light text-accent-purple' },
  'forum-legal': { cls: 'bg-accent-red-light text-accent-red' },
  'forum-finance': { cls: 'bg-accent-yellow/20 text-accent-yellow' },
  'forum-dmv': { cls: 'bg-cyan-100 text-cyan-700' },
  'forum-secondhand': { cls: 'bg-bg-page text-text-secondary' },
  'forum-expose': { cls: 'bg-accent-red-light text-accent-red' },
  'forum-events': { cls: 'bg-primary-100 text-primary-700' },
};

// Voice avatar gradient colors
const voiceGradients = [
  'from-pink-200 to-pink-300', 'from-secondary-light to-secondary-light',
  'from-accent-yellow/20 to-accent-yellow/30', 'from-accent-green-light to-accent-green-light',
  'from-accent-purple-light to-accent-purple-light', 'from-cyan-200 to-cyan-300',
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

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  const t = await getTranslations();
  const supabase = await createClient();
  const site = await getCurrentSite();
  const isEnglishSite = siteScope === 'en';

  let newsQuery = supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(3);
  let guidesQuery = supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_scenario'])
    .eq('editorial_status', 'published')
    .order('view_count', { ascending: false })
    .limit(4);
  let alertsQuery = supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('content_vertical', 'news_alert')
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(1);

  // Prevent cross-language bleed on homepage sections.
  if (isEnglishSite) {
    newsQuery = newsQuery.not('title_en', 'is', null);
    guidesQuery = guidesQuery.not('title_en', 'is', null);
    alertsQuery = alertsQuery.not('title_en', 'is', null);
  } else {
    newsQuery = newsQuery.not('title_zh', 'is', null);
    guidesQuery = guidesQuery.not('title_zh', 'is', null);
    alertsQuery = alertsQuery.not('title_zh', 'is', null);
  }

  // Parallel queries
  const [
    { data: rNews }, { data: rGuides }, { data: rBiz },
    { data: rThreads }, { data: rEvents }, { data: rVoices },
    { data: rAlerts }, { data: rCategories }, { data: rBoardsScoped },
    { data: rDiscoverPosts }, { data: rBizCategories },
  ] = await Promise.all([
    newsQuery,
    guidesQuery,
    supabase.from('businesses').select('*').eq('site_id', site.id).eq('is_active', true).eq('status', 'active').order('is_featured', { ascending: false }).order('total_score', { ascending: false, nullsFirst: false }).limit(10),
    supabase.from('forum_threads').select('*').eq('site_id', site.id).eq('status', 'published').order('reply_count', { ascending: false }).limit(5),
    supabase.from('events').select('*').eq('site_id', site.id).eq('status', 'published').order('start_at', { ascending: true }).limit(4),
    supabase.from('profiles').select('*').in('profile_type', ['creator','expert','professional','community_leader','business_owner']).order('follower_count', { ascending: false }).limit(4),
    alertsQuery,
    supabase.from('categories_guide').select('id, slug, name_zh').eq('site_scope', siteScope),
    supabase.from('categories_forum').select('id, slug, name_zh, name_en').eq('site_scope', siteScope),
    supabase.from('voice_posts').select('*, profiles!voice_posts_author_id_fkey(display_name, username)').eq('site_id', site.id).eq('status', 'published').eq('visibility', 'public').order('published_at', { ascending: false }).limit(5),
    supabase.from('categories').select('slug, name_zh, icon').eq('type', 'business').is('parent_id', null).eq('is_active', true).eq('site_scope', siteScope).order('sort_order', { ascending: true }),
  ]);

  const news = (rNews || []) as AnyRow[];
  const guides = (rGuides || []) as AnyRow[];
  const businesses = (rBiz || []) as AnyRow[];

  // Fetch cover photos from Supabase Storage for each business
  const adminSupa = createAdminClient();
  const bizCoverMap: Record<string, string> = {};
  await Promise.all(
    businesses.map(async (biz) => {
      const folder = `businesses/${biz.slug}`;
      const { data: files } = await adminSupa.storage.from('media').list(folder, { limit: 1, sortBy: { column: 'name', order: 'asc' } });
      const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
      if (first) {
        const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
        bizCoverMap[biz.id] = urlData.publicUrl;
      }
    })
  );

  const threads = (rThreads || []) as AnyRow[];
  const events = (rEvents || []) as AnyRow[];
  const voices = (rVoices || []) as AnyRow[];
  const alerts = (rAlerts || []) as AnyRow[];
  const cats = (rCategories || []) as AnyRow[];
  let boards = (rBoardsScoped || []) as AnyRow[];
  if (boards.length === 0 && siteScope === 'en') {
    const { data: rBoardsZh } = await supabase
      .from('categories_forum')
      .select('id, slug, name_zh, name_en')
      .eq('site_scope', 'zh');
    boards = (rBoardsZh || []) as AnyRow[];
  }
  const discoverPosts = (rDiscoverPosts || []) as AnyRow[];
  const bizCategories = (rBizCategories || []) as AnyRow[];

  // Maps
  const catNameMap: Record<string, string> = {};
  cats.forEach(c => catNameMap[c.id] = c.name_zh || c.slug);
  const boardMap: Record<string, AnyRow> = {};
  boards.forEach(b => boardMap[b.id] = b);

  return (
    <main>
      {/* Alert Banner (soft warning) */}
      {alerts.length > 0 && (
        <div className="alert-banner">
          <svg className="alert-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span className="flex-1 text-text-primary">
            <strong className="fw-semibold">提醒：</strong>
            <span className="text-text-secondary ml-1">{isEnglishSite ? (alerts[0].title_en || alerts[0].title_zh) : (alerts[0].title_zh || alerts[0].title_en)}</span>
          </span>
          <Link href={`/news/${alerts[0].slug}`} className="text-xs fw-medium text-primary hover:text-primary-dark ml-2">详情 →</Link>
        </div>
      )}

      {/* Hero — soft pastel gradient with dark text */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-bg-card to-backdrop-secondary py-12 sm:py-16">
        <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%), radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--secondary) 10%, transparent), transparent 50%)' }} />
        <PageContainer className="relative max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 r-full bg-primary-50 text-primary-dark text-xs fw-medium mb-4 border border-primary-100">
            <span className="w-1.5 h-1.5 r-full bg-primary animate-pulse" />
            AI 驱动 · 纽约华人本地生活
          </div>
          <h1 className="text-3xl sm:text-4xl fw-bold mb-3 text-text-primary leading-tight">{t('home.heroTitle')}</h1>
          <p className="text-text-secondary mb-6 text-sm sm:text-base">{t('home.heroSubtitle')}</p>
          <form action="/zh/ask" className="relative max-w-2xl mx-auto">
            <input
              type="text"
              name="q"
              placeholder="问我任何本地问题... 例如「法拉盛中文牙医推荐」"
              className="w-full h-12 pl-5 pr-14 r-xl bg-bg-card text-text-primary text-sm elev-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text-muted"
            />
            <button type="submit" className={cn(buttonVariants(), 'absolute right-1 top-1 w-10 h-10 px-0')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
          </form>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {['中文家庭医生', '报税服务', '驾照路考', '周末活动', '租房'].map(tag => (
              <Link key={tag} href={`/ask?q=${encodeURIComponent(tag)}`} className="chip">
                {tag}
              </Link>
            ))}
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8 space-y-12">

        {/* ===== DISCOVER (逛逛晒晒) ===== */}
        {discoverPosts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl fw-bold flex items-center gap-2">📝 逛逛晒晒</h2>
              <div className="flex items-center gap-3">
                <Link href="/discover/new-post" className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-text-inverse text-xs fw-semibold r-full hover:bg-primary-dark transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  发布晒晒
                </Link>
                <Link href="/discover" className="text-sm text-primary fw-medium hover:underline">{t('home.viewMore')} →</Link>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
              {['美食', '健康', '美妆', '穿搭', '影视', '职场', '走走', '家居', '小窍门'].map((tag) => (
                <span key={tag} className="px-3 py-1 text-xs fw-medium text-text-secondary bg-bg-page border border-border-light r-full whitespace-nowrap hover:text-primary hover:border-primary-200 transition cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {discoverPosts.map((post, i) => {
                const coverImage = post.cover_images?.[0] || post.cover_image_url || post.video_thumbnail_url;
                const authorName = post.profiles?.display_name || '匿名';
                const isVideo = post.post_type === 'video';
                const gradients = [
                  'from-rose-200 to-pink-100', 'from-emerald-200 to-teal-100',
                  'from-violet-200 to-accent-purple-light', 'from-sky-200 to-secondary-light',
                  'from-amber-200 to-primary-100',
                ];
                return (
                  <Link key={post.id} href={`/discover/${post.slug || post.id}`} className="group">
                    <div className="r-xl overflow-hidden bg-bg-card border border-border-light hover:elev-md transition-shadow">
                      <div className="aspect-[3/4] overflow-hidden relative">
                        {isVideo && post.video_url ? (
                          <VideoHoverCard
                            thumbnailUrl={coverImage}
                            videoUrl={post.video_url}
                            alt={post.title || ''}
                          />
                        ) : coverImage ? (
                          <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                            <span className="text-3xl opacity-70" aria-hidden="true">{post.title?.[0] || '📝'}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-xs fw-semibold text-text-primary line-clamp-2 leading-snug">{post.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="w-4 h-4 r-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-[8px] fw-bold text-primary-dark flex-shrink-0">
                            {authorName.charAt(0)}
                          </span>
                          <p className="text-[10px] text-text-muted truncate flex-1">{authorName}</p>
                          <HeartButton postId={post.id} initialCount={post.like_count || 0} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== TODAY'S NEWS ===== */}
        {news.length > 0 && (
          <SectionBlock>
            <SectionHeader
              title={<><span>📰</span> {t('home.todayNews')}</>}
              right={<Link href="/news" className="text-sm text-primary fw-medium hover:underline">{t('home.viewAll')} →</Link>}
            />
            <div className="grid md:grid-cols-3 gap-5">
              {news.map((a) => {
                const badge = verticalBadge[a.content_vertical] || { label: '新闻', cls: 'bg-bg-page text-text-secondary' };
                const newsTitle = isEnglishSite ? (a.title_en || a.title_zh) : (a.title_zh || a.title_en);
                const newsSummary = isEnglishSite
                  ? (a.ai_summary_en || a.summary_en || a.ai_summary_zh || a.summary_zh)
                  : (a.ai_summary_zh || a.summary_zh || a.ai_summary_en || a.summary_en);
                return (
                  <Link key={a.id} href={`/news/${a.slug}`} className="block">
                    <Card className="p-5 h-full hover:elev-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={cn('text-xs', badge.cls)}>{badge.label}</Badge>
                      <span className="text-xs text-text-muted">{timeAgo(a.published_at)}</span>
                    </div>
                    <h3 className="fw-semibold text-base mb-2 line-clamp-2">{newsTitle}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2">{newsSummary}</p>
                    {a.source_name && (
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="muted" className="text-xs">{a.source_type === 'official_gov' ? 'A类来源' : '来源'}</Badge>
                        <span className="text-xs text-text-muted">{a.source_name}</span>
                      </div>
                    )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          </SectionBlock>
        )}

        {/* ===== HOT GUIDES ===== */}
        {guides.length > 0 && (
          <SectionBlock>
            <SectionHeader
              title={<><span>📚</span> {t('home.hotGuides')}</>}
              right={<Link href="/guides" className="text-sm text-primary fw-medium hover:underline">{t('home.viewAll')} →</Link>}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {guides.map((g, i) => {
                const gBadge = guideBadge[g.content_vertical] || { label: '指南', cls: 'bg-bg-page text-text-secondary' };
                const catName = g.category_id ? (catNameMap[g.category_id] || '') : '';
                const gradient = guideGradients[i % guideGradients.length];
                const emoji = guideEmojis[g.content_vertical] || '📚';
                const guideTitle = isEnglishSite ? (g.title_en || g.title_zh) : (g.title_zh || g.title_en);
                const guideBody = isEnglishSite ? (g.body_en || g.body_zh || '') : (g.body_zh || g.body_en || '');
                return (
                  <Link key={g.id} href={`/guides/${g.slug}`} className="block cursor-pointer">
                    <Card className="overflow-hidden h-full hover:elev-md transition-shadow">
                      {g.cover_image_url ? (
                        <div className="h-40 overflow-hidden">
                          <img
                            src={g.cover_image_url}
                            alt={guideTitle || 'Guide cover'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className={`h-40 bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl`}>{emoji}</div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn('text-xs', gBadge.cls)}>{gBadge.label}</Badge>
                          {catName && <Badge variant="muted" className="text-xs">{catName}</Badge>}
                        </div>
                        <h3 className="fw-semibold text-sm line-clamp-2 mb-1">{guideTitle}</h3>
                        <p className="text-xs text-text-muted">适合：{(g.audience_types || ['所有人']).join(' · ')} · {Math.ceil((guideBody.length || 500) / 400)}分钟阅读</p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </SectionBlock>
        )}

        {/* ===== WEEKEND EVENTS ===== */}
        {events.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl fw-bold flex items-center gap-2">🎪 周末活动精选</h2>
              <Link href="/events" className="text-sm text-primary fw-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {events.map((e, i) => {
                const gradient = ['from-accent-red-light to-pink-200', 'from-secondary-light to-cyan-200', 'from-accent-green-light to-emerald-200', 'from-accent-purple-light to-violet-200'][i % 4];
                const emoji = ['🎆', '📚', '🎨', '🏃'][i % 4];
                const startDate = e.start_at ? new Date(e.start_at) : null;
                return (
                  <Link key={e.id} href={`/events/${e.slug}`} className="block cursor-pointer">
                    <Card className="overflow-hidden h-full hover:elev-md transition-shadow">
                      <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center text-3xl`}>{emoji}</div>
                      <div className="p-4">
                        {startDate && (
                          <p className="text-xs text-primary fw-medium mb-1">
                            {startDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                            {' '}
                            {['周日','周一','周二','周三','周四','周五','周六'][startDate.getDay()]}
                            {' · '}
                            {startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        )}
                        <h3 className="fw-semibold text-sm mb-1 line-clamp-2">{e.title_zh}</h3>
                        <p className="text-xs text-text-muted">{e.venue_name} · {e.is_free ? '免费' : e.ticket_price || '付费'}</p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== RECOMMENDED BUSINESSES ===== */}
        {businesses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl fw-bold flex items-center gap-2">🏪 推荐商家</h2>
              <Link href="/businesses" className="text-sm text-primary fw-medium hover:underline">{t('home.browseDirectory')} →</Link>
            </div>
            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
              {bizCategories.map((cat) => (
                <Link key={cat.slug} href={`/businesses?category=${cat.slug}`} className="px-3 py-1 text-xs fw-medium text-text-secondary bg-bg-page border border-border-light r-full whitespace-nowrap hover:text-primary hover:border-primary-200 transition">
                  {cat.icon} {cat.name_zh}
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {businesses.map((biz, i) => {
                const bizName = pickBusinessDisplayName(biz, '商家');
                const firstChar = (bizName || '').charAt(0) || '🏢';
                const coverPhoto = bizCoverMap[biz.id] || null;
                const gradients = [
                  'from-primary-100 to-primary-50', 'from-secondary-50 to-cyan-50',
                  'from-accent-green-light to-emerald-50', 'from-accent-purple-light to-violet-50',
                  'from-amber-100 to-primary-50',
                ];
                const street = (biz.address_full || '').replace(/,?\s*(NY|New York)\s*\d{0,5},?\s*(USA|美国)?$/i, '').trim().replace(/,\s*$/, '');
                const streetCity = [street, biz.city].filter(Boolean).join(', ');
                const bizHref = `/businesses/${biz.slug}`;
                const tags = (biz.ai_tags as string[] | null)?.slice(0, 2) || [];
                return (
                  <div key={biz.id} className="r-xl overflow-hidden bg-bg-card border border-border-light hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 group">
                    {/* Cover Photo */}
                    <Link href={bizHref} className="block relative">
                      <div className="aspect-[4/3] overflow-hidden">
                        {coverPhoto ? (
                          <img src={coverPhoto} alt={bizName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                            <span className="text-4xl fw-bold text-primary-dark/20">{firstChar}</span>
                          </div>
                        )}
                      </div>
                      {/* Rating pill */}
                      {biz.avg_rating && (
                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-[11px] fw-semibold px-2 py-0.5 r-md shadow-sm flex items-center gap-1">
                          <span className="text-amber-500">★</span>
                          <span className="text-text-primary">{Number(biz.avg_rating).toFixed(1)}</span>
                          <span className="text-text-muted">({biz.review_count})</span>
                        </div>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="p-3">
                      <Link href={bizHref}>
                        <h3 className="text-sm fw-semibold text-text-primary line-clamp-1 leading-snug group-hover:text-primary transition-colors">{bizName}</h3>
                      </Link>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-primary-50 text-primary-dark text-[10px] r-md">{tag}</span>
                          ))}
                        </div>
                      )}

                      {biz.short_desc_zh && (
                        <p className="text-[11px] text-text-secondary line-clamp-2 mt-1.5 leading-relaxed">{biz.short_desc_zh}</p>
                      )}

                      {/* Address */}
                      {streetCity && (
                        <p className="text-[11px] text-text-secondary mt-2 truncate flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {streetCity}
                        </p>
                      )}

                      {/* Phone & Website */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-light">
                        {biz.phone && (
                          <a href={`tel:${biz.phone}`} className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-primary transition-colors truncate">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            {biz.phone}
                          </a>
                        )}
                        {biz.website_url && (
                          <a href={biz.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-dark transition-colors ml-auto flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            官网
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== FORUM HOT THREADS ===== */}
        {threads.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl fw-bold flex items-center gap-2">💬 {t('home.forumHotThreads')}</h2>
              <Link href="/forum" className="text-sm text-primary fw-medium hover:underline">{t('home.enterForum')} →</Link>
            </div>
            <Card className="bg-bg-card divide-y divide-border-light">
              {threads.map((thread) => {
                const board = boardMap[thread.board_id];
                const bSlug = board?.slug || '';
                const bName = board?.name_zh || '';
                const bCls = boardBadge[bSlug]?.cls || 'bg-bg-page text-text-secondary';
                const isHot = (thread.reply_count || 0) >= 50;
                return (
                  <Link key={thread.id} href={`/forum/${bSlug}/${thread.slug}`} className="flex items-center gap-4 p-4 hover:bg-bg-page transition block">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {bName && <Badge className={cn('text-xs', bCls)}>{bName}</Badge>}
                        {isHot && <span className="text-xs text-accent-red fw-medium">🔥 热帖</span>}
                      </div>
                      <h3 className="text-sm fw-medium truncate">{thread.title}</h3>
                      {thread.ai_summary_zh && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-1">AI摘要：{thread.ai_summary_zh}</p>
                      )}
                    </div>
                    <div className="text-center flex-shrink-0">
                      <p className="text-sm fw-bold text-primary">{thread.reply_count || 0}</p>
                      <p className="text-xs text-text-muted">回复</p>
                    </div>
                  </Link>
                );
              })}
            </Card>
          </section>
        )}

        {/* ===== NEWSLETTER ===== */}
        <Card className="bg-bg-card p-8 text-center">
          <h2 className="text-xl fw-bold mb-2">📬 {t('home.newsletter.title')}</h2>
          <p className="text-sm text-text-secondary mb-5">{t('home.newsletter.subtitle')}</p>
          <NewsletterForm source="homepage" className="max-w-md mx-auto" />
          <p className="text-xs text-text-muted mt-3">{t('home.newsletter.subscriberCount', { count: '1,200' })}</p>
        </Card>

      </PageContainer>
    </main>
  );
}
