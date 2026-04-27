import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { HeroSection } from './components/hero-section';
import { TickerBar } from './components/ticker-bar';
import { ShareSection } from './components/share-section';
import { NewsSection } from './components/news-section';
import { GuidesSection } from './components/guides-section';
import { EventsSection } from './components/events-section';
import { DealsSection } from './components/deals-section';
import { BusinessesSection } from './components/businesses-section';
import { ClassifiedsSection } from './components/classifieds-section';
import { NewsletterSection } from './components/newsletter-section';
import { getCurrentUser } from '@/lib/auth';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: 'Baam 纽约 · 你的华人本地生活',
  description: '纽约华人本地生活门户 — 美食、医疗、法律、教育、社区，AI 驱动的一站式服务',
};

export default async function HomepageV2() {
  const supabase = await createClient();
  const site = await getCurrentSite();
  const currentUser = await getCurrentUser().catch(() => null);

  // Parallel data fetching
  const [
    { data: rHero },
    { data: rNews },
    { data: rGuides },
    { data: rDiscoverPosts },
    { data: rEvents },
    { data: rDeals },
    { data: rBiz },
    { data: rBizCategories },
    { data: rBizSubcategories },
    { data: rClfHousing },
    { data: rClfJobs },
    { data: rClfSecondhand },
    { data: rClfHelp },
  ] = await Promise.all([
    // Hero: latest published article (any type) for the hero section
    supabase.from('articles').select('*').eq('site_id', site.id).eq('editorial_status', 'published').not('title_zh', 'is', null).order('created_at', { ascending: false }).limit(1),
    // News articles (only featured ones appear on homepage)
    supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community']).eq('editorial_status', 'published').eq('is_featured', true).not('title_zh', 'is', null).order('created_at', { ascending: false }).limit(6),
    // Guides (only featured ones appear on homepage)
    supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_scenario']).eq('editorial_status', 'published').eq('is_featured', true).not('title_zh', 'is', null).order('view_count', { ascending: false }).limit(4),
    // Discover posts
    supabase.from('voice_posts').select('*, profiles!voice_posts_author_id_fkey(display_name, username)').eq('site_id', site.id).eq('status', 'published').eq('visibility', 'public').order('published_at', { ascending: false }).limit(7),
    // Events
    supabase.from('events').select('*').eq('site_id', site.id).eq('status', 'published').order('start_at', { ascending: true }).limit(4),
    // Deals (featured + approved + not expired)
    supabase.from('deals').select('*, businesses(display_name_zh, display_name, slug)').eq('site_id', site.id).eq('status', 'approved').eq('is_featured', true).order('sort_order', { ascending: true }).limit(4),
    // Businesses (with primary category join — fetch more to cover all tabs)
    supabase.from('businesses').select('*, business_categories!inner(category_id, is_primary, categories!inner(slug, name_zh))').eq('site_id', site.id).eq('is_active', true).eq('status', 'active').eq('is_featured', true).eq('business_categories.is_primary', true).order('total_score', { ascending: false, nullsFirst: false }).limit(80),
    // Business categories (parents = tabs)
    supabase.from('categories').select('id, slug, name_zh, icon').eq('type', 'business').is('parent_id', null).eq('is_active', true).eq('site_scope', 'zh').order('sort_order', { ascending: true }),
    // Business subcategories (for mapping sub → parent)
    supabase.from('categories').select('id, slug, parent_id').eq('type', 'business').not('parent_id', 'is', null).eq('is_active', true),
    // Classifieds: 4 queries, one per category
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).in('category', ['housing_rent', 'housing_buy']).eq('status', 'active').order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).eq('category', 'jobs').eq('status', 'active').order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).eq('category', 'secondhand').eq('status', 'active').order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).in('category', ['services', 'general']).eq('status', 'active').order('created_at', { ascending: false }).limit(4),
  ]);

  const heroArticle = ((rHero || []) as AnyRow[])[0] || null;
  const newsItems = (rNews || []) as AnyRow[];
  const guides = (rGuides || []) as AnyRow[];
  const discoverPosts = (rDiscoverPosts || []) as AnyRow[];
  const events = (rEvents || []) as AnyRow[];
  const deals = (rDeals || []) as AnyRow[];
  const allBiz = (rBiz || []) as AnyRow[];
  const bizCategories = (rBizCategories || []) as AnyRow[];
  const bizSubcategories = (rBizSubcategories || []) as AnyRow[];
  const clfHousing = (rClfHousing || []) as AnyRow[];
  const clfJobs = (rClfJobs || []) as AnyRow[];
  const clfSecondhand = (rClfSecondhand || []) as AnyRow[];
  const clfHelp = (rClfHelp || []) as AnyRow[];

  // Build subcategory ID → parent slug map
  const parentById = new Map(bizCategories.map((c) => [c.id, c.slug]));
  const subToParentSlug = new Map<string, string>();
  for (const sub of bizSubcategories) {
    const parentSlug = parentById.get(sub.parent_id);
    if (parentSlug) subToParentSlug.set(sub.slug, parentSlug);
  }
  for (const cat of bizCategories) subToParentSlug.set(cat.slug, cat.slug);

  // Group businesses by parent category slug → pick top 8 per category
  const bizByCategory: Record<string, AnyRow[]> = {};
  for (const biz of allBiz) {
    const subCatSlug = biz.business_categories?.[0]?.categories?.slug;
    if (!subCatSlug) continue;
    const parentSlug = subToParentSlug.get(subCatSlug) || subCatSlug;
    if (!bizByCategory[parentSlug]) bizByCategory[parentSlug] = [];
    if (bizByCategory[parentSlug].length < 8) bizByCategory[parentSlug].push(biz);
  }

  // Collect unique businesses across all displayed tabs for cover photo fetching
  const displayedBizIds = new Set<string>();
  const displayedBizList: AnyRow[] = [];
  for (const catBizArr of Object.values(bizByCategory)) {
    for (const biz of catBizArr) {
      if (!displayedBizIds.has(biz.id)) {
        displayedBizIds.add(biz.id);
        displayedBizList.push(biz);
      }
    }
  }

  // Hero: latest article (separate from featured news/guides)
  const featuredStory = heroArticle;
  // Ticker: use featured news, fall back to hero if no featured news
  const tickerItems = newsItems.length > 0 ? newsItems : (heroArticle ? [heroArticle] : []);

  // Fetch cover photos for displayed businesses from Supabase Storage
  const adminSupa = createAdminClient();
  const bizCoverMap: Record<string, string> = {};
  await Promise.all(
    displayedBizList.map(async (biz) => {
      const folder = `businesses/${biz.slug}`;
      const { data: files } = await adminSupa.storage.from('media').list(folder, { limit: 1, sortBy: { column: 'name', order: 'asc' } });
      const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
      if (first) {
        const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
        bizCoverMap[biz.id] = urlData.publicUrl;
      }
    })
  );

  return (
    <main>
      {/* Hero: Featured Story + AI Chatbox */}
      <HeroSection featuredStory={featuredStory} />

      {/* Ticker: Scrolling news bar */}
      <TickerBar items={tickerItems} />

      {/* N°01: 逛逛晒晒 */}
      <ShareSection posts={discoverPosts} isLoggedIn={!!currentUser} currentUserId={currentUser?.id} />

      {/* N°02: 今日要闻 */}
      <NewsSection news={newsItems} />

      {/* N°03: 热门生活指南 */}
      <GuidesSection guides={guides} />

      {/* N°04: 周末活动精选 */}
      <EventsSection events={events} />

      {/* N°05: 限时优惠 */}
      <DealsSection deals={deals} />

      {/* N°06: 推荐商家 */}
      <BusinessesSection bizByCategory={bizByCategory} categories={bizCategories} coverPhotos={bizCoverMap} />

      {/* N°07: 分类信息 */}
      <ClassifiedsSection housing={clfHousing} jobs={clfJobs} secondhand={clfSecondhand} help={clfHelp} />

      {/* Newsletter CTA */}
      <NewsletterSection />
    </main>
  );
}
