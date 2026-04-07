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
import type { Metadata } from 'next';

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
  '餐饮美食': 'bg-primary-100 text-primary-700', '医疗健康': 'bg-blue-100 text-blue-700', '法律移民': 'bg-red-100 text-red-700',
  '地产保险': 'bg-green-100 text-green-700', '教育培训': 'bg-purple-100 text-purple-700', '装修家居': 'bg-gray-100 text-gray-700',
  '汽车服务': 'bg-gray-100 text-gray-700', '财税服务': 'bg-green-100 text-green-700', '美容保健': 'bg-purple-100 text-purple-700',
};

const categoryEmojis: Record<string, string> = {
  '餐饮美食': '🍜', '医疗健康': '🏥', '法律移民': '⚖️', '地产保险': '🏠',
  '教育培训': '📚', '装修家居': '🔧', '汽车服务': '🚗', '财税服务': '💼', '美容保健': '💆',
};

const categoryGradients: Record<string, string> = {
  '餐饮美食': 'from-yellow-200 to-yellow-300', '医疗健康': 'from-blue-200 to-blue-400',
  '法律移民': 'from-red-200 to-red-400', '地产保险': 'from-green-200 to-green-300',
  '教育培训': 'from-pink-200 to-pink-300', '装修家居': 'from-cyan-200 to-cyan-300',
  '汽车服务': 'from-slate-200 to-slate-300', '财税服务': 'from-green-200 to-green-300',
  '美容保健': 'from-rose-200 to-rose-300',
};

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
}

interface Props {
  searchParams: Promise<{ page?: string; cat?: string; sub?: string }>;
}

export default async function BusinessListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeCat = sp.cat || '';
  const activeSub = sp.sub || '';

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

  // Preserved params for pagination
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
              <h1 className="text-2xl sm:text-3xl font-bold">商家目录</h1>
              <p className="text-sm text-text-muted mt-1">
                共 {count || 0} 家商家 · 本地华人商家信息
              </p>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Category Filter — Tier 1: Parent Categories */}
      <section className="bg-bg-card border-b border-border sticky top-16 z-40">
        <PageContainer className="pt-4 pb-0">
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
            <Link
              href="/businesses"
              className={cn('flex-shrink-0 rounded-full', buttonVariants({ size: 'sm' }), `${
                !activeCat ? 'bg-primary text-text-inverse' : 'bg-border-light text-text-secondary hover:bg-primary/10 hover:text-primary'
              }`)}
            >
              全部
            </Link>
            {parentCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/businesses?cat=${cat.slug}`}
                className={cn('flex-shrink-0 whitespace-nowrap rounded-full', buttonVariants({ size: 'sm' }), `${
                  activeCat === cat.slug ? 'bg-primary text-text-inverse' : 'bg-border-light text-text-secondary hover:bg-primary/10 hover:text-primary'
                }`)}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name_zh}
              </Link>
            ))}
          </div>
        </PageContainer>

        {/* Tier 2: Subcategories (shown when a parent is selected) */}
        {subcategories.length > 0 && (
          <div className="border-t border-border bg-bg-page/50">
            <PageContainer className="py-2.5">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                <Link
                  href={`/businesses?cat=${activeCat}`}
                  className={cn('flex-shrink-0 rounded-full', buttonVariants({ variant: 'secondary', size: 'sm' }), `${
                    !activeSub ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                  }`)}
                >
                  全部{activeParent?.name_zh}
                </Link>
                {subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/businesses?cat=${activeCat}&sub=${sub.slug}`}
                    className={cn('flex-shrink-0 whitespace-nowrap rounded-full', buttonVariants({ variant: 'secondary', size: 'sm' }), `${
                      activeSub === sub.slug ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                    }`)}
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
        {businesses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">🏪</p>
            <p className="text-text-secondary">暂无商家信息</p>
            <p className="text-text-muted text-sm mt-1">商家将在这里显示</p>
          </div>
        ) : (
          <>
            {/* Business Cards (strictly sorted by total_score) */}
            <div className="grid lg:grid-cols-2 gap-5">
              {businesses.map((biz) => (
                <BusinessCard key={biz.id} biz={biz} />
              ))}
            </div>
          </>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/businesses"
          searchParams={preservedParams}
        />
      </PageContainer>

      {/* Business CTA Banner */}
      <section className="bg-gradient-to-r from-primary to-orange-600 text-white">
        <PageContainer className="py-10 sm:py-12 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            你是商家？立即入驻 Baam，获得更多曝光
          </h2>
          <p className="text-orange-100 text-sm sm:text-base mb-6">
            免费创建商家主页 · AI 自动优化 · 精准触达本地华人客户
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/businesses/claim"
              className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto bg-white text-primary hover:bg-orange-50 shadow-lg')}
            >
              免费入驻
            </Link>
            <Link
              href="/businesses/claim"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto border-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white')}
            >
              了解更多
            </Link>
          </div>
        </PageContainer>
      </section>
    </main>
  );
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

  const cardContent = (
    <>
      {/* Name + verified */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className={`${featured ? 'font-bold text-base' : 'font-semibold text-sm'} truncate`}>{name}</h3>
        {biz.is_verified && (
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Category + Rating */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <Badge variant="outline" className="text-xs">{primaryCat}</Badge>
        {cats[1] && <Badge variant="outline" className="text-xs">{cats[1]}</Badge>}
        <div className="flex items-center gap-1">
          <span className="text-yellow-500 text-xs">{renderStars(biz.avg_rating || 0)}</span>
          <span className="text-xs text-text-secondary font-medium">{biz.avg_rating?.toFixed(1) || '—'}</span>
          <span className="text-xs text-text-muted">({biz.review_count || 0})</span>
        </div>
      </div>

      {/* Tags */}
      {aiTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {aiTags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Address + Contact row */}
      <div className="space-y-1 text-xs text-text-muted">
        {address && (
          <p className="flex items-center gap-1 truncate">
            <span>📍</span> {address}
          </p>
        )}
        {(biz.phone || websiteLabel) && (
          <p className="flex items-center gap-3 flex-wrap">
            {biz.phone && <span className="inline-flex items-center gap-1"><span>📞</span>{biz.phone}</span>}
            {websiteLabel && <span className="inline-flex items-center gap-1"><span>🌐</span>Website</span>}
          </p>
        )}
      </div>
    </>
  );

  if (featured) {
    return (
      <Link href={`/businesses/${biz.slug}`} className="block">
        <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/5 to-white hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 bg-primary text-text-inverse text-xs font-bold px-3 py-1 rounded-br-lg">推荐</div>
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0 flex items-center justify-center text-2xl">
                {name[0] || '🏢'}
              </div>
              <div className="flex-1 min-w-0">{cardContent}</div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/businesses/${biz.slug}`} className="block">
      <Card className="hover:border-primary/30 transition-colors">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex-shrink-0 flex items-center justify-center text-lg">
              {name[0] || '🏢'}
            </div>
            <div className="flex-1 min-w-0">{cardContent}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
