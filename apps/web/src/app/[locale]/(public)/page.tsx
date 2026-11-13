import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { HeroSection } from '@/app/[locale]/(editorial)/homepage-v2/components/hero-section';
import { TickerBar } from '@/app/[locale]/(editorial)/homepage-v2/components/ticker-bar';
import { ShareSection } from '@/app/[locale]/(editorial)/homepage-v2/components/share-section';
import { NewsSection } from '@/app/[locale]/(editorial)/homepage-v2/components/news-section';
import { GuidesSection } from '@/app/[locale]/(editorial)/homepage-v2/components/guides-section';
import { EventsSection } from '@/app/[locale]/(editorial)/homepage-v2/components/events-section';
import { DealsSection } from '@/app/[locale]/(editorial)/homepage-v2/components/deals-section';
import { BusinessesSection } from '@/app/[locale]/(editorial)/homepage-v2/components/businesses-section';
import { ClassifiedsSection } from '@/app/[locale]/(editorial)/homepage-v2/components/classifieds-section';
import { NewsletterSection } from '@/app/[locale]/(editorial)/homepage-v2/components/newsletter-section';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Baam 纽约 · 你的华人本地生活',
  description: '纽约华人本地生活门户 — 美食、医疗、法律、教育、社区，AI 驱动的一站式服务',
};

export default async function HomePage() {
  const supabase = await createClient();
  const site = await getCurrentSite();

  const [
    { data: rHero },
    { data: rNews },
    { data: rGuides },
    { data: rDiscoverPosts },
    { data: rEvents },
    { data: rDeals },
    { data: rBizCategories },
    { data: rBizSubcategories },
    { data: rClfHousing },
    { data: rClfJobs },
    { data: rClfSecondhand },
    { data: rClfHelp },
    { data: rDiscoverCategories },
  ] = await Promise.all([
    supabase
      .from('articles')
      .select('*')
      .eq('site_id', site.id)
      .eq('editorial_status', 'published')
      .not('title_zh', 'is', null)
      .order('is_hero', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community']).eq('editorial_status', 'published').eq('is_featured', true).not('title_zh', 'is', null).order('created_at', { ascending: false }).limit(6),
    supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_scenario']).eq('editorial_status', 'published').eq('is_featured', true).not('title_zh', 'is', null).order('view_count', { ascending: false }).limit(4),
    supabase.from('voice_posts').select('*, profiles!voice_posts_author_id_fkey(display_name, username)').eq('site_id', site.id).eq('status', 'published').eq('visibility', 'public').order('published_at', { ascending: false }).limit(7),
    supabase.from('events').select('*').eq('site_id', site.id).eq('status', 'published').order('start_at', { ascending: true }).limit(4),
    supabase.from('deals').select('*, businesses(display_name_zh, display_name, slug)').eq('site_id', site.id).eq('status', 'approved').eq('is_featured', true).order('sort_order', { ascending: true }).limit(4),
    supabase.from('categories').select('id, slug, name_zh, icon').eq('type', 'business').is('parent_id', null).eq('is_active', true).eq('site_scope', 'zh').order('sort_order', { ascending: true }),
    supabase.from('categories').select('id, slug, parent_id').eq('type', 'business').not('parent_id', 'is', null).eq('is_active', true),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).in('category', ['housing_rent', 'housing_buy']).eq('status', 'active').eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).eq('category', 'jobs').eq('status', 'active').eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).eq('category', 'secondhand').eq('status', 'active').eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
    supabase.from('classifieds').select('*, profiles:author_id(display_name)').eq('site_id', site.id).in('category', ['services', 'general']).eq('status', 'active').eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
    supabase.from('categories_discover').select('id, slug, name_zh, name_en, icon, sort_order').eq('is_active', true).eq('site_scope', 'zh').order('sort_order', { ascending: true }),
  ]);

  const heroArticle = ((rHero || []) as AnyRow[])[0] || null;
  const newsItems = (rNews || []) as AnyRow[];
  const guides = (rGuides || []) as AnyRow[];
  const discoverPosts = (rDiscoverPosts || []) as AnyRow[];
  const events = (rEvents || []) as AnyRow[];
  const deals = (rDeals || []) as AnyRow[];
  const bizCategories = (rBizCategories || []) as AnyRow[];
  const bizSubcategories = (rBizSubcategories || []) as AnyRow[];
  const clfHousing = (rClfHousing || []) as AnyRow[];
  const clfJobs = (rClfJobs || []) as AnyRow[];
  const clfSecondhand = (rClfSecondhand || []) as AnyRow[];
  const clfHelp = (rClfHelp || []) as AnyRow[];
  const discoverCategories = (rDiscoverCategories || []) as AnyRow[];

  // Fetch top-20 featured businesses for each parent category (by primary category), then UI displays first 8.
  const childCategoryIdsByParentId = new Map<string, string[]>();
  for (const sub of bizSubcategories) {
    const list = childCategoryIdsByParentId.get(sub.parent_id) || [];
    list.push(sub.id);
    childCategoryIdsByParentId.set(sub.parent_id, list);
  }
  const bizByCategoryEntries = await Promise.all(
    bizCategories.map(async (parentCat) => {
      const categoryIds = [parentCat.id, ...(childCategoryIdsByParentId.get(parentCat.id) || [])];
      const { data } = await supabase
        .from('businesses')
        .select('*, business_categories!inner(category_id, is_primary, categories!inner(slug, name_zh))')
        .eq('site_id', site.id)
        .eq('is_active', true)
        .eq('status', 'active')
        .eq('is_featured', true)
        .eq('business_categories.is_primary', true)
        .in('business_categories.category_id', categoryIds)
        .order('total_score', { ascending: false, nullsFirst: false })
        .limit(20);
      return [parentCat.slug, (data || []) as AnyRow[]] as const;
    }),
  );
  const bizByCategory: Record<string, AnyRow[]> = Object.fromEntries(bizByCategoryEntries);

  const displayedBizIds = new Set<string>();
  const displayedBizList: AnyRow[] = [];
  for (const catBizArr of Object.values(bizByCategory)) {
    for (const biz of catBizArr) {
      if (!displayedBizIds.has(biz.id)) { displayedBizIds.add(biz.id); displayedBizList.push(biz); }
    }
  }

  const featuredStory = heroArticle;
  const tickerItems = newsItems.length > 0 ? newsItems : (heroArticle ? [heroArticle] : []);

  const adminSupa = createAdminClient();
  const bizCoverMap: Record<string, string> = {};
  await Promise.all(
    displayedBizList.map(async (biz) => {
      const folder = `businesses/${biz.slug}`;
      const { data: files } = await adminSupa.storage.from('media').list(folder, { limit: 1, sortBy: { column: 'name', order: 'desc' } });
      const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
      if (first) {
        const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
        bizCoverMap[biz.id] = urlData.publicUrl;
      }
    })
  );

  return (
    <main>
      <HeroSection featuredStory={featuredStory} />
      <TickerBar items={tickerItems} />
      <ShareSection posts={discoverPosts} categories={discoverCategories} />
      <NewsSection news={newsItems} />
      <GuidesSection guides={guides} />
      <EventsSection events={events} />
      <DealsSection deals={deals} />
      <BusinessesSection bizByCategory={bizByCategory} categories={bizCategories} coverPhotos={bizCoverMap} />
      <ClassifiedsSection housing={clfHousing} jobs={clfJobs} secondhand={clfSecondhand} help={clfHelp} />
      <NewsletterSection />
    </main>
  );
}
