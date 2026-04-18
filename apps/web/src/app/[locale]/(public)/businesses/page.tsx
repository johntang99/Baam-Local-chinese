import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Pagination } from '@/components/shared/pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { pickBusinessDisplayName } from '@/lib/business-name';
import BusinessMapWrapper from '@/components/businesses/BusinessMapWrapper';
import type { Metadata } from 'next';
import type { MapBusiness } from '@/components/businesses/BusinessMapView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('businesses')} · Baam`,
    description: '纽约本地华人商家目录 — 餐饮美食、医疗健康、法律移民、地产保险、教育培训等',
  };
}

const categoryColors: Record<string, string> = {
  '餐饮美食': 'bg-primary-100 text-primary-700', '医疗健康': 'bg-accent-blue-light text-secondary-dark', '法律移民': 'bg-accent-red-light text-accent-red',
  '地产保险': 'bg-accent-green-light text-accent-green', '教育培训': 'bg-accent-purple-light text-accent-purple', '装修家居': 'bg-bg-page text-text-secondary',
  '汽车服务': 'bg-bg-page text-text-secondary', '财税服务': 'bg-accent-green-light text-accent-green', '美容保健': 'bg-accent-purple-light text-accent-purple',
};

const categoryEmojis: Record<string, string> = {
  '餐饮美食': '🍜', '医疗健康': '🏥', '法律移民': '⚖️', '地产保险': '🏠',
  '教育培训': '📚', '装修家居': '🔧', '汽车服务': '🚗', '财税服务': '💼', '美容保健': '💆',
};

const categoryGradients: Record<string, string> = {
  '餐饮美食': 'from-accent-yellow/20 to-accent-yellow/30', '医疗健康': 'from-secondary-light to-secondary',
  '法律移民': 'from-accent-red-light to-accent-red', '地产保险': 'from-accent-green-light to-accent-green-light',
  '教育培训': 'from-pink-200 to-pink-300', '装修家居': 'from-cyan-200 to-cyan-300',
  '汽车服务': 'from-slate-200 to-slate-300', '财税服务': 'from-accent-green-light to-accent-green-light',
  '美容保健': 'from-rose-200 to-rose-300',
};

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
}

interface Props {
  searchParams: Promise<{ page?: string; cat?: string; sub?: string; view?: string }>;
}

export default async function BusinessListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeCat = sp.cat || '';
  const activeSub = sp.sub || '';
  const viewMode = sp.view === 'map' ? 'map' : 'list';

  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();

  // Fetch business categories (parents + children)
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'business')
    .eq('site_scope', 'zh')
    .order('sort_order', { ascending: true });

  const allCategories = (rawCategories || []) as AnyRow[];
  const parentCategories = allCategories.filter(c => !c.parent_id);
  const activeParent = parentCategories.find(c => c.slug === activeCat);
  const subcategories = activeParent
    ? allCategories.filter(c => c.parent_id === activeParent.id)
    : [];

  // If category/subcategory filter active, get category IDs for filtering
  let filterCatIds: string[] | null = null;
  const filterSlug = activeSub || activeCat;
  if (filterSlug) {
    const matchedCat = allCategories.find(c => c.slug === filterSlug);
    if (matchedCat) {
      filterCatIds = [matchedCat.id];
      if (!matchedCat.parent_id) {
        const childIds = allCategories.filter(c => c.parent_id === matchedCat.id).map(c => c.id);
        filterCatIds.push(...childIds);
      }
    }
  }

  // For category filtering: use inner join via business_categories instead of .in() with 1000+ IDs
  // This avoids the "Bad Request" error when too many IDs are passed
  let count = 0;
  let businesses: AnyRow[] = [];
  const pageFrom = (currentPage - 1) * PAGE_SIZE;

  if (filterCatIds && filterCatIds.length > 0) {
    // Strategy: query via business_categories inner join to avoid .in() with 1000+ IDs
    // Use business_categories as the base table, join businesses, then sort and paginate

    // Step 1: Get all business IDs for this category (deduplicated)
    const { data: bizIdData } = await supabase
      .from('business_categories')
      .select('business_id')
      .in('category_id', filterCatIds)
      .range(0, 999);
    const bizIds = [...new Set((bizIdData || []).map((bc: AnyRow) => bc.business_id))];
    count = 0;

    if (bizIds.length > 0) {
      // Step 2: Fetch ALL businesses for sorting (but only minimal fields for sort)
      // Break into chunks of 200 to avoid Bad Request
      const CHUNK_SIZE = 200;
      const allBizSorted: AnyRow[] = [];

      for (let i = 0; i < bizIds.length; i += CHUNK_SIZE) {
        const chunk = bizIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkData } = await supabase
          .from('businesses')
          .select('id, is_featured, total_score, updated_at')
          .eq('is_active', true)
          .eq('status', 'active')
          .eq('site_id', site.id)
          .in('id', chunk);
        if (chunkData) allBizSorted.push(...chunkData);
      }
      count = allBizSorted.length;

      // Step 3: Sort all businesses by DB-computed total_score only
      allBizSorted.sort((a, b) => {
        return (b.total_score || 0) - (a.total_score || 0);
      });

      // Step 4: Get the page slice of IDs (now properly sorted)
      const pageIds = allBizSorted.slice(pageFrom, pageFrom + PAGE_SIZE).map(b => b.id);

      if (pageIds.length > 0) {
        // Step 5: Fetch full data for this page only
        const { data: rawBiz, error: bizError } = await supabase
          .from('businesses')
          .select('*, business_categories(categories(name_zh, slug))')
          .eq('site_id', site.id)
          .in('id', pageIds);
        if (bizError) console.error('[businesses] Category query error:', JSON.stringify(bizError));

        // Re-sort the fetched page to match our sorted order
        const idOrder = new Map(pageIds.map((id, idx) => [id, idx]));
        businesses = ((rawBiz || []) as AnyRow[]).sort((a, b) =>
          (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0)
        );
      }
    }
  } else {
    // No category filter — query all businesses directly
    const { count: totalCount } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('site_id', site.id)
      .eq('status', 'active');
    count = totalCount || 0;

    let dataQuery = supabase
      .from('businesses')
      .select('*, business_categories(categories(name_zh, slug))')
      .eq('is_active', true)
      .eq('site_id', site.id)
      .eq('status', 'active');

    dataQuery = dataQuery.order('total_score', { ascending: false, nullsFirst: false });

    const { data: rawBiz, error: bizError } = await dataQuery.range(pageFrom, pageFrom + PAGE_SIZE - 1);
    if (bizError) console.error('[businesses] Query error:', JSON.stringify(bizError));
    businesses = (rawBiz || []) as AnyRow[];
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  // Fetch map businesses (all with lat/lng, no pagination) when map view is active
  let mapBusinesses: MapBusiness[] = [];
  if (viewMode === 'map') {
    const MAP_SELECT = 'id, slug, display_name, display_name_zh, phone, avg_rating, review_count, business_locations(latitude, longitude, address_line1, city), business_categories(categories(name_zh))';
    let rawMapData: AnyRow[] = [];

    if (filterCatIds && filterCatIds.length > 0) {
      // Category-filtered: get matching business IDs, then fetch in chunks
      const { data: catBizIds } = await supabase
        .from('business_categories')
        .select('business_id')
        .in('category_id', filterCatIds)
        .range(0, 999);
      const bizIds = [...new Set((catBizIds || []).map((r: AnyRow) => r.business_id))];
      const CHUNK = 200;
      for (let i = 0; i < bizIds.length; i += CHUNK) {
        const { data } = await supabase
          .from('businesses')
          .select(MAP_SELECT)
          .eq('is_active', true).eq('status', 'active').eq('site_id', site.id)
          .in('id', bizIds.slice(i, i + CHUNK));
        if (data) rawMapData.push(...data);
      }
    } else {
      // No filter: fetch all businesses up to 1000
      const { data, error } = await supabase
        .from('businesses')
        .select(MAP_SELECT)
        .eq('is_active', true).eq('status', 'active').eq('site_id', site.id)
        .limit(1000);
      if (error) console.error('[businesses/map] Query error:', JSON.stringify(error));
      rawMapData = (data || []) as AnyRow[];
    }

    mapBusinesses = rawMapData
      .map((biz) => {
        const loc = Array.isArray(biz.business_locations) ? biz.business_locations[0] : null;
        if (!loc?.latitude || !loc?.longitude) return null;
        const cats = Array.isArray(biz.business_categories)
          ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean)
          : [];
        return {
          id: biz.id,
          slug: biz.slug,
          name: pickBusinessDisplayName(biz, ''),
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: [loc.address_line1, loc.city].filter(Boolean).join(', '),
          phone: biz.phone || undefined,
          category: cats[0] || undefined,
          avg_rating: biz.avg_rating || undefined,
          review_count: biz.review_count || undefined,
        };
      })
      .filter(Boolean) as MapBusiness[];
  }

  // Preserved params for pagination and view mode
  const viewParam = viewMode === 'map' ? '&view=map' : '';
  const preservedParams: Record<string, string> = {};
  if (activeCat) preservedParams.cat = activeCat;
  if (activeSub) preservedParams.sub = activeSub;

  return (
    <main>
      {/* Page Header */}
      <section className="bg-bg-card border-b border-border">
        <PageContainer className="py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl fw-bold">商家目录</h1>
              <p className="text-sm text-text-muted mt-1">
                共 {count || 0} 家商家 · 本地华人商家信息
              </p>
            </div>
            {/* List / Map toggle */}
            <div className="flex r-lg border border-border overflow-hidden">
              <Link
                href={`/businesses${activeCat ? `?cat=${activeCat}` : ''}${activeSub ? `&sub=${activeSub}` : ''}`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm fw-medium transition-colors',
                  viewMode === 'list' ? 'bg-primary text-text-inverse' : 'bg-bg-card text-text-secondary hover:text-primary'
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                列表
              </Link>
              <Link
                href={`/businesses?view=map${activeCat ? `&cat=${activeCat}` : ''}${activeSub ? `&sub=${activeSub}` : ''}`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm fw-medium transition-colors border-l border-border',
                  viewMode === 'map' ? 'bg-primary text-text-inverse' : 'bg-bg-card text-text-secondary hover:text-primary'
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                地图
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Search + Category Filter */}
      <section className="bg-bg-card border-b border-border sticky top-14 z-40">
        <PageContainer className="pt-3 pb-0">
          <div className="flex items-center gap-2 pb-3 -mx-4 px-4">
            {/* Search + Near Me grouped together */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/search"
                className="relative flex items-center w-40 sm:w-56 pl-9 pr-3 py-1.5 text-sm r-full border border-border bg-bg-page text-text-muted hover:border-primary/50 transition-colors"
              >
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                搜索商家...
              </Link>
              <Link
                href={`/businesses?view=map&nearby=1${activeCat ? `&cat=${activeCat}` : ''}${activeSub ? `&sub=${activeSub}` : ''}`}
                className={cn('flex-shrink-0 flex items-center gap-1 r-full', buttonVariants({ size: 'sm' }), 'bg-border-light text-text-secondary hover:bg-primary/10 hover:text-primary')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                附近
              </Link>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <Link
                href={`/businesses${viewMode === 'map' ? '?view=map' : ''}`}
                className={cn('chip flex-shrink-0', !activeCat && 'active')}
              >
                全部
              </Link>
              {parentCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/businesses?cat=${cat.slug}${viewParam}`}
                  className={cn('chip flex-shrink-0', activeCat === cat.slug && 'active')}
                >
                  {cat.icon && <span className="mr-0.5">{cat.icon}</span>}
                  {cat.name_zh}
                </Link>
              ))}
            </div>
          </div>
        </PageContainer>

        {/* Tier 2: Subcategories (shown when a parent is selected) */}
        {subcategories.length > 0 && (
          <div className="border-t border-border bg-bg-page/50">
            <PageContainer className="py-2.5">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                <Link
                  href={`/businesses?cat=${activeCat}${viewParam}`}
                  className={cn('chip flex-shrink-0', !activeSub && 'active')}
                >
                  全部{activeParent?.name_zh}
                </Link>
                {subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/businesses?cat=${activeCat}&sub=${sub.slug}${viewParam}`}
                    className={cn('chip flex-shrink-0', activeSub === sub.slug && 'active')}
                  >
                    {sub.icon && <span className="mr-0.5">{sub.icon}</span>}
                    {sub.name_zh}
                  </Link>
                ))}
              </div>
            </PageContainer>
          </div>
        )}

        {/* Sort info */}
        <PageContainer className="py-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {count || 0} 家商家
              {activeParent ? ` · ${activeParent.icon || ''} ${activeParent.name_zh}` : ''}
              {activeSub ? ` > ${allCategories.find(c => c.slug === activeSub)?.name_zh || ''}` : ''}
            </span>
            <span className="text-xs text-text-muted">按综合评分排序</span>
          </div>
        </PageContainer>
      </section>

      {/* Results */}
      <PageContainer className="py-6">
        {viewMode === 'map' ? (
          mapBusinesses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-4">📍</p>
              <p className="text-text-secondary">暂无地图数据</p>
              <p className="text-text-muted text-sm mt-1">没有找到有位置信息的商家</p>
            </div>
          ) : (
            <BusinessMapWrapper businesses={mapBusinesses} />
          )
        ) : (
          <>
            {businesses.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">🏪</p>
                <p className="text-text-secondary">暂无商家信息</p>
                <p className="text-text-muted text-sm mt-1">商家将在这里显示</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {businesses.map((biz) => (
                  <BusinessCard key={biz.id} biz={biz} />
                ))}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/businesses"
              searchParams={preservedParams}
            />
          </>
        )}
      </PageContainer>

      {/* Business CTA Banner */}
      <section className="bg-gradient-to-r from-primary to-primary-dark text-text-inverse">
        <PageContainer className="py-10 sm:py-12 text-center">
          <h2 className="text-xl sm:text-2xl fw-bold mb-2">
            你是商家？立即入驻 Baam，获得更多曝光
          </h2>
          <p className="text-primary-100 text-sm sm:text-base mb-6">
            免费创建商家主页 · AI 自动优化 · 精准触达本地华人客户
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/businesses/claim"
              className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto bg-bg-card text-primary hover:bg-primary-50 elev-lg')}
            >
              免费入驻
            </Link>
            <Link
              href="/businesses/claim"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto border-2 border-border-light/50 bg-transparent text-text-inverse hover:bg-bg-card/10 hover:text-text-inverse')}
            >
              了解更多
            </Link>
          </div>
        </PageContainer>
      </section>
    </main>
  );
}

// Deterministic palette for business card banner based on name
const CARD_BANNER_PALETTES = [
  'from-primary-100 via-primary-50 to-bg-card',
  'from-secondary-50 via-secondary-50 to-bg-card',
  'from-accent-green-light via-emerald-50 to-bg-card',
  'from-accent-purple-light via-violet-50 to-bg-card',
  'from-accent-yellow/20 via-amber-50 to-bg-card',
  'from-accent-red-light via-rose-50 to-bg-card',
  'from-cyan-100 via-sky-50 to-bg-card',
  'from-pink-100 via-rose-50 to-bg-card',
];

const CATEGORY_EMOJI: Record<string, string> = {
  '餐饮美食': '🍜', '医疗健康': '🏥', '法律移民': '⚖️', '地产保险': '🏠',
  '教育培训': '📚', '购物零售': '🛍️', '装修家居': '🔧', '汽车服务': '🚗',
  '财税服务': '💼', '美容保健': '💆', '其他服务': '🏢', '商家': '🏢',
  '书店文具': '📖', '百货商场': '🏬', '旅行社': '✈️', '电子产品': '📱',
  '韩餐': '🍲', '搬家': '📦', '超市杂货': '🛒', 'SPA按摩': '💆‍♀️',
  '火锅烧烤': '🥘', '中餐': '🍚', '礼品特色': '🎁', '酒吧夜生活': '🍷',
  '眼科验光': '👓', '泰餐': '🍛', '烘焙甜品': '🧁',
};

function pickPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CARD_BANNER_PALETTES[hash % CARD_BANNER_PALETTES.length];
}

function BusinessCard({ biz, featured = false }: { biz: AnyRow; featured?: boolean }) {
  const aiTags = (biz.ai_tags || []).filter((t: string) => t !== 'GBP已认领') as string[];
  const name = pickBusinessDisplayName(biz, '');

  // Get address from joined location
  const loc = Array.isArray(biz.business_locations) ? biz.business_locations[0] : null;
  const address = (loc ? `${loc.address_line1 || ''}${loc.city ? ', ' + loc.city : ''}` : '') || biz.address_full || '';
  const websiteLabel = (biz.website_url || biz.website)
    ? String(biz.website_url || biz.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
    : '';

  // Get categories from joined data
  const cats = Array.isArray(biz.business_categories)
    ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean)
    : [];
  const primaryCat = cats[0] || '商家';
  const emoji = CATEGORY_EMOJI[primaryCat] || '🏢';
  const palette = pickPalette(String(biz.id || biz.slug || name));
  const rating = typeof biz.avg_rating === 'number' ? biz.avg_rating : Number(biz.avg_rating || 0);
  const reviewCount = typeof biz.review_count === 'number' ? biz.review_count : Number(biz.review_count || 0);

  return (
    <Link href={`/businesses/${biz.slug}`} className="group block h-full">
      <Card className={cn('relative overflow-hidden h-full flex flex-col hover:elev-md transition-shadow', (featured || biz.is_featured) && 'card-featured')}>
        {/* Banner */}
        <div className={cn('relative h-24 bg-gradient-to-br flex items-center justify-center', palette)}>
          <div className="w-16 h-16 r-xl bg-bg-card/90 backdrop-blur flex items-center justify-center text-3xl elev-sm border border-border-light">
            <span aria-hidden="true">{emoji}</span>
          </div>
          {(featured || biz.is_featured) && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-bg-card/90 backdrop-blur text-primary-dark text-[11px] fw-semibold px-2 py-0.5 r-full border border-primary-100 elev-sm">
              <span className="w-1 h-1 r-full bg-primary" /> 推荐
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-2.5">
          {/* Name + verified */}
          <div className="flex items-start gap-1.5">
            <h3 className="fw-semibold text-sm leading-snug line-clamp-2 flex-1 group-hover:text-primary transition-colors">{name || '未命名商家'}</h3>
            {biz.is_verified && (
              <svg className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-label="已认证">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Rating row */}
          {reviewCount > 0 ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-accent-yellow">★</span>
              <span className="fw-semibold text-text-primary">{rating ? rating.toFixed(1) : '—'}</span>
              <span className="text-text-muted">({reviewCount} 评价)</span>
            </div>
          ) : (
            <p className="text-xs text-text-muted">暂无评价</p>
          )}

          {/* Category + AI tags (combined) */}
          <div className="flex flex-wrap gap-1.5">
            <span className="chip chip-ghost text-[11px] bg-bg-page border-border-light">{primaryCat}</span>
            {aiTags.slice(0, 2).map((tag) => (
              <span key={tag} className="chip chip-ghost text-[11px] bg-bg-page border-border-light text-text-secondary">
                {tag}
              </span>
            ))}
          </div>

          {/* Address */}
          {address && (
            <p className="text-xs text-text-muted flex items-start gap-1 line-clamp-2">
              <span className="flex-shrink-0">📍</span>
              <span className="truncate">{address}</span>
            </p>
          )}

          {/* Bottom contact row */}
          <div className="mt-auto pt-2 border-t border-border-light flex items-center gap-3 text-xs text-text-secondary">
            {biz.phone ? (
              <span className="inline-flex items-center gap-1 truncate"><span aria-hidden="true">📞</span>{biz.phone}</span>
            ) : (
              <span className="text-text-muted">电话 —</span>
            )}
            {websiteLabel && (
              <span className="inline-flex items-center gap-1 text-secondary ml-auto">
                <span aria-hidden="true">🌐</span>官网
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
