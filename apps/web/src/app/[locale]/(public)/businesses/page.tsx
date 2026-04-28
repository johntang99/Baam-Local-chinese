import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { Link } from '@/lib/i18n/routing';
import { EditorialContainer } from '@/components/editorial/container';
import { EditorialCard } from '@/components/editorial/card';
import { pickBusinessDisplayName } from '@/lib/business-name';
import { BusinessSearchBar } from '@/components/businesses/BusinessSearchBar';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch { return url; }
}

function WebsiteLink({ url, fontSize = 11 }: { url: string; fontSize?: number }) {
  const href = url.startsWith('http') ? url : `https://${url}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--ed-accent)', fontSize }}>
      🌐 {extractDomain(url)}
    </a>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '商家目录 · Baam',
    description: '纽约本地华人商家目录 — 餐饮美食、医疗健康、法律移民、地产保险、教育培训等',
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  '餐饮美食': '🍜', '医疗健康': '🏥', '法律移民': '⚖️', '地产保险': '🏠',
  '教育培训': '📚', '购物零售': '🛍️', '装修家居': '🔧', '汽车服务': '🚗',
  '财税服务': '💼', '美容保健': '💆', '其他服务': '🏢', '商家': '🏢',
};

const CATEGORY_EN: Record<string, string> = {
  '餐饮美食': 'Food & Dining', '医疗健康': 'Medical & Health', '法律移民': 'Legal & Immigration',
  '地产保险': 'Real Estate', '教育培训': 'Education', '购物零售': 'Shopping',
  '装修家居': 'Home Renovation', '汽车服务': 'Auto Services', '财税服务': 'Finance & Tax',
  '美容保健': 'Beauty & Wellness', '其他服务': 'Other Services',
};

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

  // Fetch all business categories
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

  // ─── VIEW MODE: Directory home (no cat) ───
  if (!activeCat) {
    return renderDirectoryHome(supabase, site, parentCategories, allCategories);
  }

  // ─── VIEW MODE: Category or Subcategory ───
  let filterCatIds: string[] = [];
  const filterSlug = activeSub || activeCat;
  const matchedCat = allCategories.find(c => c.slug === filterSlug);
  if (matchedCat) {
    filterCatIds = [matchedCat.id];
    if (!matchedCat.parent_id) {
      const childIds = allCategories.filter(c => c.parent_id === matchedCat.id).map(c => c.id);
      filterCatIds.push(...childIds);
    }
  }

  // Fetch businesses for this category
  let count = 0;
  let businesses: AnyRow[] = [];
  const pageFrom = (currentPage - 1) * PAGE_SIZE;

  if (filterCatIds.length > 0) {
    const { data: bizIdData } = await supabase
      .from('business_categories')
      .select('business_id')
      .in('category_id', filterCatIds)
      .range(0, 9999);
    const bizIds = [...new Set((bizIdData || []).map((bc: AnyRow) => bc.business_id))];

    if (bizIds.length > 0) {
      // Get all IDs with scores for sorting
      const CHUNK_SIZE = 200;
      const allBizSorted: AnyRow[] = [];
      for (let i = 0; i < bizIds.length; i += CHUNK_SIZE) {
        const chunk = bizIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkData } = await supabase
          .from('businesses')
          .select('id, is_featured, total_score')
          .eq('is_active', true).eq('status', 'active').eq('site_id', site.id)
          .in('id', chunk);
        if (chunkData) allBizSorted.push(...chunkData);
      }
      count = allBizSorted.length;
      allBizSorted.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
      const pageIds = allBizSorted.slice(pageFrom, pageFrom + PAGE_SIZE).map(b => b.id);

      if (pageIds.length > 0) {
        const { data: rawBiz } = await supabase
          .from('businesses')
          .select('*, business_categories(categories(name_zh, slug))')
          .eq('site_id', site.id)
          .in('id', pageIds);
        const idOrder = new Map(pageIds.map((id, idx) => [id, idx]));
        businesses = ((rawBiz || []) as AnyRow[]).sort((a, b) => (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0));
      }

      // For category view (not sub): also fetch featured businesses with images
      if (!activeSub && activeParent) {
        const featuredIds = allBizSorted.filter(b => b.is_featured).slice(0, 8).map(b => b.id);
        if (featuredIds.length > 0) {
          const { data: featuredRaw } = await supabase
            .from('businesses')
            .select('*, business_categories(categories(name_zh, slug))')
            .eq('site_id', site.id)
            .in('id', featuredIds);
          const featured = (featuredRaw || []) as AnyRow[];
          // Fetch cover photos
          const adminSupa = createAdminClient();
          const coverMap: Record<string, string> = {};
          await Promise.all(featured.map(async (biz) => {
            const folder = `businesses/${biz.slug}`;
            const { data: files } = await adminSupa.storage.from('media').list(folder, { limit: 1, sortBy: { column: 'name', order: 'asc' } });
            const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
            if (first) {
              const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
              coverMap[biz.id] = urlData.publicUrl;
            }
          }));

          return renderCategoryPage({
            parentCategories, activeParent, subcategories, allCategories,
            featured, coverMap, businesses, count, currentPage, activeCat, activeSub,
          });
        }
      }
    }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  // Subcategory view or category without featured
  if (activeSub) {
    return renderSubcategoryPage({
      parentCategories, activeParent, subcategories, allCategories,
      businesses, count, currentPage, totalPages, activeCat, activeSub,
    });
  }

  // Category view without featured businesses
  return renderCategoryPage({
    parentCategories, activeParent, subcategories, allCategories,
    featured: [], coverMap: {}, businesses, count, currentPage, activeCat, activeSub,
  });
}

// ═══════════════════════════════════════════════════════
// ═══ VIEW 1: Directory Home — Left/Right/Even sections
// ═══════════════════════════════════════════════════════

async function renderDirectoryHome(
  supabase: any, site: any, parentCategories: AnyRow[], allCategories: AnyRow[],
) {
  // Get total count
  const { count: totalCount } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true).eq('site_id', site.id).eq('status', 'active');

  // Build subcategory → parent slug map
  const parentById = new Map(parentCategories.map(c => [c.id, c.slug]));
  const subToParent = new Map<string, string>();
  for (const cat of allCategories) {
    if (cat.parent_id) {
      const p = parentById.get(cat.parent_id);
      if (p) subToParent.set(cat.slug, p);
    } else {
      subToParent.set(cat.slug, cat.slug);
    }
  }

  // Fetch featured businesses with category join
  const { data: rBiz } = await supabase
    .from('businesses')
    .select('*, business_categories!inner(category_id, is_primary, categories!inner(slug, name_zh))')
    .eq('site_id', site.id).eq('is_active', true).eq('status', 'active')
    .eq('is_featured', true).eq('business_categories.is_primary', true)
    .order('total_score', { ascending: false, nullsFirst: false })
    .limit(80);
  const allBiz = (rBiz || []) as AnyRow[];

  // Group by parent category
  const bizByCategory: Record<string, AnyRow[]> = {};
  for (const biz of allBiz) {
    const subCatSlug = biz.business_categories?.[0]?.categories?.slug;
    if (!subCatSlug) continue;
    const parentSlug = subToParent.get(subCatSlug) || subCatSlug;
    if (!bizByCategory[parentSlug]) bizByCategory[parentSlug] = [];
    if (bizByCategory[parentSlug].length < 5) bizByCategory[parentSlug].push(biz);
  }

  // Fetch cover photos
  const adminSupa = createAdminClient();
  const coverMap: Record<string, string> = {};
  const uniqueBiz = allBiz.filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);
  await Promise.all(uniqueBiz.map(async (biz) => {
    const folder = `businesses/${biz.slug}`;
    const { data: files } = await adminSupa.storage.from('media').list(folder, { limit: 1, sortBy: { column: 'name', order: 'asc' } });
    const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
    if (first) {
      const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
      coverMap[biz.id] = urlData.publicUrl;
    }
  }));

  const layouts = ['left', 'right', 'even'] as const;

  return (
    <main>
      {/* Hero Header */}
      <div style={{ background: 'var(--ed-paper)', borderBottom: '1px solid var(--ed-line)' }}>
        <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '28px 16px 24px' }}>
          <nav className="flex items-center gap-1.5 mb-5" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
            <Link href="/" className="hover:text-[var(--ed-accent)] transition-colors">首页</Link>
            <span>›</span><span>商家目录</span>
          </nav>
          <div className="grid" style={{ gridTemplateColumns: '1.2fr 506px 1fr', alignItems: 'center', gap: '24px 40px' }}>
            <div className="flex-shrink-0">
              <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 36, fontWeight: 900, lineHeight: 1.15 }}>商家目录</h1>
              <p style={{ fontFamily: 'var(--ed-font-serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ed-ink-muted)', marginTop: 4 }}>Directory</p>
              <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)', marginTop: 12 }}>收录 <strong style={{ color: 'var(--ed-accent)', fontWeight: 600 }}>{(totalCount || 0).toLocaleString()}</strong> 家纽约华人商家</p>
            </div>
            <div>
              <BusinessSearchBar businessCount={totalCount || 0} />
            </div>
            <div className="hidden lg:grid grid-cols-2 gap-x-4 gap-y-1">
              {['法拉盛火锅店推荐', '哪里有中文牙医？', '华埠早茶点心最好？', '推荐中文家庭医生', '正宗川菜馆推荐', '附近搬家公司报价', '报税会计师推荐', '移民律师哪家好？'].map(q => (
                <Link key={q} href={`/helper-2?q=${encodeURIComponent(q)}`} className="flex items-center gap-1.5 hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 12.5, color: 'var(--ed-ink-soft)', whiteSpace: 'nowrap', padding: '5px 0' }}>
                  <span style={{ color: 'var(--ed-accent)', fontSize: 10 }}>›</span>{q}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs — sticky */}
      <div className="sticky top-[52px] z-40" style={{ background: 'var(--ed-paper)', borderBottom: '1px solid var(--ed-line)' }}>
        <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '10px 16px' }}>
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <Link href="/businesses" className="flex-shrink-0 whitespace-nowrap transition-all" style={{ padding: '6px 12px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)', border: '1px solid var(--ed-ink)' }}>全部</Link>
            {parentCategories.map(cat => (
              <Link key={cat.id} href={`/businesses?cat=${cat.slug}`} className="flex-shrink-0 whitespace-nowrap transition-all" style={{ padding: '6px 12px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, color: 'var(--ed-ink-soft)', border: '1px solid var(--ed-line)' }}>
                {cat.icon} {cat.name_zh}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Category Sections */}
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '32px 16px 80px' }}>
        {parentCategories.map((cat, idx) => {
          const catBiz = bizByCategory[cat.slug] || [];
          const subs = allCategories.filter(c => c.parent_id === cat.id).slice(0, 7);
          const layout = layouts[idx % 3];
          const catName = cat.name_zh || '';
          const catEn = CATEGORY_EN[catName] || '';
          const emoji = cat.icon || CATEGORY_EMOJI[catName] || '🏢';

          return (
            <section key={cat.id} style={{ marginBottom: 112 }}>
              {/* Section header with inline subcategory tabs */}
              <div className="flex items-center gap-4" style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--ed-line)' }}>
                <h2 className="flex items-center gap-2 flex-shrink-0" style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 20, fontWeight: 700 }}>
                  <span style={{ fontSize: 22 }}>{emoji}</span> {catName}
                  <span style={{ fontFamily: 'var(--ed-font-serif-italic)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ed-ink-muted)', fontSize: '0.65em' }}>{catEn}</span>
                </h2>
                <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
                  <Link href={`/businesses?cat=${cat.slug}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '6px 14px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)', border: '1px solid var(--ed-ink)' }}>全部</Link>
                  {subs.map(sub => (
                    <Link key={sub.id} href={`/businesses?cat=${cat.slug}&sub=${sub.slug}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '6px 14px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, color: 'var(--ed-ink-soft)', border: '1px solid var(--ed-line)' }}>
                      {sub.name_zh}
                    </Link>
                  ))}
                </div>
                <Link href={`/businesses?cat=${cat.slug}`} className="flex-shrink-0 whitespace-nowrap" style={{ fontSize: 13, color: 'var(--ed-accent)', fontWeight: 500 }}>查看全部 →</Link>
              </div>

              {catBiz.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontSize: 36, opacity: 0.4 }}>{emoji}</p>
                  <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)', marginTop: 12 }}>该分类暂无推荐商家</p>
                  <Link href={`/businesses?cat=${cat.slug}`} style={{ fontSize: 13, color: 'var(--ed-accent)', fontWeight: 500, marginTop: 8, display: 'inline-block' }}>浏览全部{catName}商家 →</Link>
                </div>
              ) : layout === 'left' ? (
                <LayoutLeftRight businesses={catBiz} coverMap={coverMap} direction="left" catName={catName} />
              ) : layout === 'right' ? (
                <LayoutLeftRight businesses={catBiz} coverMap={coverMap} direction="right" catName={catName} />
              ) : (
                <LayoutEven businesses={catBiz} coverMap={coverMap} />
              )}
            </section>
          );
        })}
      </div>

      <CTABanner />
    </main>
  );
}

// ═══════════════════════════════════════════
// ═══ VIEW 2: Category Page
// ═══════════════════════════════════════════

function renderCategoryPage({ parentCategories, activeParent, subcategories, allCategories, featured, coverMap, businesses, count, currentPage, activeCat, activeSub }: {
  parentCategories: AnyRow[]; activeParent: AnyRow | undefined; subcategories: AnyRow[]; allCategories: AnyRow[];
  featured: AnyRow[]; coverMap: Record<string, string>; businesses: AnyRow[]; count: number; currentPage: number; activeCat: string; activeSub: string;
}) {
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const catName = activeParent?.name_zh || '';
  const catEn = CATEGORY_EN[catName] || '';
  const emoji = activeParent?.icon || CATEGORY_EMOJI[catName] || '🏢';

  return (
    <main>
      {/* Page header */}
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '32px 16px 24px' }}>
        <nav className="flex items-center gap-1.5 mb-4" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ed-accent)]">首页</Link><span>›</span>
          <Link href="/businesses" className="hover:text-[var(--ed-accent)]">商家目录</Link><span>›</span>
          <span>{catName}</span>
        </nav>
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontSize: 32 }}>{emoji}</span>
          <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 32, fontWeight: 900 }}>
            {catName}
            <span style={{ fontFamily: 'var(--ed-font-serif-italic)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ed-ink-muted)', fontSize: '0.55em', marginLeft: 8 }}>{catEn}</span>
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ed-ink-muted)', marginLeft: 44 }}>共 {count.toLocaleString()} 家{catName}商家</p>
      </div>

      {/* Subcategory tabs */}
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 20px' }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Link href={`/businesses?cat=${activeCat}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '7px 18px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, background: !activeSub ? 'var(--ed-ink)' : 'transparent', color: !activeSub ? 'var(--ed-paper)' : 'var(--ed-ink-soft)', border: !activeSub ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)' }}>全部</Link>
          {subcategories.map(sub => (
            <Link key={sub.id} href={`/businesses?cat=${activeCat}&sub=${sub.slug}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '7px 18px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, background: activeSub === sub.slug ? 'var(--ed-ink)' : 'transparent', color: activeSub === sub.slug ? 'var(--ed-paper)' : 'var(--ed-ink-soft)', border: activeSub === sub.slug ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)' }}>
              {sub.name_zh}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 80px' }}>
        {/* Featured businesses with images */}
        {featured.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 600 }}>
              编辑精选 <span style={{ fontSize: 12, color: 'var(--ed-accent)', fontWeight: 500, padding: '3px 10px', background: 'rgba(199,62,29,0.08)', borderRadius: 'var(--ed-radius-pill)' }}>推荐商家</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {featured.map(biz => {
                const name = pickBusinessDisplayName(biz, '');
                const cover = coverMap[biz.id];
                const cats = Array.isArray(biz.business_categories) ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean) : [];
                const rating = Number(biz.avg_rating || 0);
                const reviews = Number(biz.review_count || 0);
                return (
                  <div key={biz.id}>
                    <EditorialCard className="overflow-hidden hover:-translate-y-1 transition-transform">
                      <Link href={`/businesses/${biz.slug}`}>
                        {cover ? (
                          <img src={cover} alt={name} className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
                        ) : (
                          <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: 'var(--ed-paper-warm)' }}>
                            <span style={{ fontSize: 40, opacity: 0.3 }}>{emoji}</span>
                          </div>
                        )}
                      </Link>
                      <div style={{ padding: '14px 16px' }}>
                        <Link href={`/businesses/${biz.slug}`}><h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{name}</h3></Link>
                        {biz.display_name && biz.display_name !== name && <p style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 2 }}>{biz.display_name}</p>}
                        {reviews > 0 && <div style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginTop: 8 }}><span style={{ color: 'var(--ed-amber)' }}>★</span> {rating.toFixed(1)} ({reviews.toLocaleString()})</div>}
                        {biz.address_full && <a href={gmapUrl(biz.address_full)} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {cleanAddr(biz.address_full)}</a>}
                        {cats[0] && <span style={{ display: 'inline-block', fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-paper-warm)', color: 'var(--ed-ink-soft)', marginTop: 8 }}>{cats[0]}</span>}
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--ed-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ed-ink-soft)' }}>
                          {biz.phone ? <a href={`tel:${biz.phone}`} className="hover:text-[var(--ed-accent)] transition-colors">📞 {biz.phone}</a> : <span>电话 —</span>}
                          {(biz.website_url || biz.website) && <WebsiteLink url={biz.website_url || biz.website} />}
                        </div>
                      </div>
                    </EditorialCard>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* All businesses — ranked list */}
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--ed-line)' }}>
          <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 600 }}>全部{catName}商家</h2>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>共 {count.toLocaleString()} 家</span>
            <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>按综合评分排序</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {businesses.map((biz, i) => {
            const rank = (currentPage - 1) * PAGE_SIZE + i + 1;
            return <RankedRow key={biz.id} biz={biz} rank={rank} />;
          })}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/businesses" extra={{ cat: activeCat }} />
      </div>

      <CTABanner />
    </main>
  );
}

// ═══════════════════════════════════════════
// ═══ VIEW 3: Subcategory Page
// ═══════════════════════════════════════════

function renderSubcategoryPage({ parentCategories, activeParent, subcategories, allCategories, businesses, count, currentPage, totalPages, activeCat, activeSub }: {
  parentCategories: AnyRow[]; activeParent: AnyRow | undefined; subcategories: AnyRow[]; allCategories: AnyRow[];
  businesses: AnyRow[]; count: number; currentPage: number; totalPages: number; activeCat: string; activeSub: string;
}) {
  const activeSc = allCategories.find(c => c.slug === activeSub);
  const subName = activeSc?.name_zh || '';
  const catName = activeParent?.name_zh || '';
  const emoji = activeParent?.icon || '🏢';

  return (
    <main>
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '32px 16px 20px' }}>
        <nav className="flex items-center gap-1.5 mb-4" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ed-accent)]">首页</Link><span>›</span>
          <Link href="/businesses" className="hover:text-[var(--ed-accent)]">商家目录</Link><span>›</span>
          <Link href={`/businesses?cat=${activeCat}`} className="hover:text-[var(--ed-accent)]">{catName}</Link><span>›</span>
          <span>{subName}</span>
        </nav>
        <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          {emoji} {subName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)', marginTop: 6 }}>共 {count.toLocaleString()} 家{subName}商家 · 按综合评分排序</p>
      </div>

      {/* Sibling subcategory tabs */}
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 20px' }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Link href={`/businesses?cat=${activeCat}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '7px 18px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, color: 'var(--ed-ink-soft)', border: '1px solid var(--ed-line)' }}>← 全部{catName}</Link>
          {subcategories.map(sub => (
            <Link key={sub.id} href={`/businesses?cat=${activeCat}&sub=${sub.slug}`} className="flex-shrink-0 whitespace-nowrap" style={{ padding: '7px 18px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13, fontWeight: 500, background: activeSub === sub.slug ? 'var(--ed-ink)' : 'transparent', color: activeSub === sub.slug ? 'var(--ed-paper)' : 'var(--ed-ink-soft)', border: activeSub === sub.slug ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)' }}>
              {sub.name_zh}
            </Link>
          ))}
        </div>
      </div>

      {/* Subcategory card grid — 4 columns, no images */}
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 80px' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {businesses.map((biz, i) => {
            const rank = (currentPage - 1) * PAGE_SIZE + i + 1;
            return <SubcategoryCard key={biz.id} biz={biz} rank={rank} />;
          })}
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/businesses" extra={{ cat: activeCat, sub: activeSub }} />
      </div>

      <CTABanner />
    </main>
  );
}

// ═══════════════════════════════════════
// ═══ HELPERS
// ═══════════════════════════════════════

function gmapUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function cleanAddr(address: string) {
  return address.replace(/,?\s*(USA|美国)\s*$/i, '');
}

// ═══════════════════════════════════════
// ═══ SHARED COMPONENTS
// ═══════════════════════════════════════

function LayoutLeftRight({ businesses, coverMap, direction, catName }: { businesses: AnyRow[]; coverMap: Record<string, string>; direction: 'left' | 'right'; catName: string }) {
  const hero = businesses[0];
  const rest = businesses.slice(1, 5);
  if (!hero) return null;

  const heroName = pickBusinessDisplayName(hero, '');
  const heroCover = coverMap[hero.id];
  const heroCats = Array.isArray(hero.business_categories) ? hero.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean) : [];
  const heroRating = Number(hero.avg_rating || 0);
  const heroReviews = Number(hero.review_count || 0);
  const heroAddr = hero.address_full || '';
  const heroDesc = hero.short_desc_zh || hero.full_desc_zh?.slice(0, 100) || '';

  const heroCard = (
    <div className="block">
      <EditorialCard className="overflow-hidden h-full hover:-translate-y-1 transition-transform">
        <Link href={`/businesses/${hero.slug}`}>
          {heroCover ? (
            <img src={heroCover} alt={heroName} className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: 'var(--ed-paper-warm)' }}>
              <span style={{ fontSize: 48, opacity: 0.3 }}>{CATEGORY_EMOJI[catName] || '🏢'}</span>
            </div>
          )}
        </Link>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginBottom: 6 }}>{heroCats[0] || catName} · 推荐</div>
          <Link href={`/businesses/${hero.slug}`}><h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 600, lineHeight: 1.35 }}>{heroName}</h3></Link>
          {hero.display_name && hero.display_name !== heroName && <p style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 2 }}>{hero.display_name}</p>}
          {heroReviews > 0 && <div style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginTop: 6 }}><span style={{ color: 'var(--ed-amber)' }}>★</span> {heroRating.toFixed(1)} ({heroReviews.toLocaleString()} 评价)</div>}
          {heroDesc && <p style={{ fontSize: 12.5, color: 'var(--ed-ink-soft)', lineHeight: 1.65, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{heroDesc}</p>}
          {heroAddr && <a href={gmapUrl(heroAddr)} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginTop: 6 }}>📍 {cleanAddr(heroAddr)}</a>}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--ed-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--ed-ink-soft)' }}>
            {hero.phone ? <a href={`tel:${hero.phone}`} className="hover:text-[var(--ed-accent)] transition-colors">📞 {hero.phone}</a> : <span>电话 —</span>}
            {(hero.website_url || hero.website) && <WebsiteLink url={hero.website_url || hero.website} />}
          </div>
        </div>
      </EditorialCard>
    </div>
  );

  const smallCards = (
    <div className="grid grid-cols-2 gap-4">
      {rest.map(biz => <SmallCard key={biz.id} biz={biz} coverMap={coverMap} catName={catName} />)}
    </div>
  );

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: direction === 'left' ? '2fr 3fr' : '3fr 2fr' }}>
      {direction === 'left' ? <>{heroCard}{smallCards}</> : <>{smallCards}{heroCard}</>}
    </div>
  );
}

function LayoutEven({ businesses, coverMap }: { businesses: AnyRow[]; coverMap: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {businesses.slice(0, 4).map((biz, i) => {
        const name = pickBusinessDisplayName(biz, '');
        const cover = coverMap[biz.id];
        const rating = Number(biz.avg_rating || 0);
        const reviews = Number(biz.review_count || 0);
        return (
          <div key={biz.id} className="relative">
            <EditorialCard className="overflow-hidden hover:-translate-y-1 transition-transform">
              <span className="absolute z-10 flex items-center justify-center" style={{ top: 10, left: 10, width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700, color: 'var(--ed-paper)', background: i === 0 ? 'var(--ed-accent)' : i === 1 ? 'var(--ed-amber)' : i === 2 ? 'var(--ed-ink)' : 'rgba(0,0,0,0.4)' }}>{i + 1}</span>
              <Link href={`/businesses/${biz.slug}`}>
                {cover ? (
                  <img src={cover} alt={name} className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
                ) : (
                  <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: 'var(--ed-paper-warm)' }}>
                    <span style={{ fontSize: 40, opacity: 0.3 }}>🏢</span>
                  </div>
                )}
              </Link>
              <div style={{ padding: '14px 16px' }}>
                <Link href={`/businesses/${biz.slug}`}><h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{name}</h3></Link>
                {biz.display_name && biz.display_name !== name && <p style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 2 }}>{biz.display_name}</p>}
                {reviews > 0 && <div style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginTop: 6 }}><span style={{ color: 'var(--ed-amber)' }}>★</span> {rating.toFixed(1)} ({reviews.toLocaleString()} 评价)</div>}
                {biz.address_full && <a href={gmapUrl(biz.address_full)} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {cleanAddr(biz.address_full)}</a>}
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--ed-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ed-ink-soft)' }}>
                  {biz.phone ? <a href={`tel:${biz.phone}`} className="hover:text-[var(--ed-accent)] transition-colors">📞 {biz.phone}</a> : <span>电话 —</span>}
                  {(biz.website_url || biz.website) && <WebsiteLink url={biz.website_url || biz.website} />}
                </div>
              </div>
            </EditorialCard>
          </div>
        );
      })}
    </div>
  );
}

function SmallCard({ biz, coverMap, catName }: { biz: AnyRow; coverMap: Record<string, string>; catName: string }) {
  const name = pickBusinessDisplayName(biz, '');
  const cover = coverMap[biz.id];
  const rating = Number(biz.avg_rating || 0);
  const reviews = Number(biz.review_count || 0);
  const website = biz.website_url || biz.website || '';
  return (
    <div>
      <EditorialCard className="overflow-hidden hover:-translate-y-1 transition-transform">
        <Link href={`/businesses/${biz.slug}`}>
          {cover ? (
            <img src={cover} alt={name} className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: 'var(--ed-paper-warm)' }}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>{CATEGORY_EMOJI[catName] || '🏢'}</span>
            </div>
          )}
        </Link>
        <div style={{ padding: '12px 14px' }}>
          <Link href={`/businesses/${biz.slug}`}><h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{name}</h3></Link>
          {biz.display_name && biz.display_name !== name && <p style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 2 }}>{biz.display_name}</p>}
          {reviews > 0 && <div style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginTop: 6 }}><span style={{ color: 'var(--ed-amber)' }}>★</span> {rating.toFixed(1)} ({reviews.toLocaleString()})</div>}
          {biz.address_full && <a href={gmapUrl(biz.address_full)} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {cleanAddr(biz.address_full)}</a>}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--ed-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ed-ink-soft)' }}>
            {biz.phone ? <a href={`tel:${biz.phone}`} className="hover:text-[var(--ed-accent)] transition-colors">📞 {biz.phone}</a> : <span>电话 —</span>}
            {website && <WebsiteLink url={website} />}
          </div>
        </div>
      </EditorialCard>
    </div>
  );
}

function RankedRow({ biz, rank }: { biz: AnyRow; rank: number }) {
  const name = pickBusinessDisplayName(biz, '');
  const englishName = biz.display_name && biz.display_name !== name ? biz.display_name : '';
  const address = biz.address_full || '';
  const rating = Number(biz.avg_rating || 0);
  const reviews = Number(biz.review_count || 0);
  const cats = Array.isArray(biz.business_categories) ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean) : [];

  return (
    <div className="flex items-center gap-3.5 transition-colors hover:bg-[var(--ed-surface)]" style={{ padding: '14px 16px', borderBottom: '1px solid var(--ed-line)' }}>
      <span className="flex items-center justify-center flex-shrink-0" style={{
        width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700,
        background: rank === 1 ? 'var(--ed-accent)' : rank === 2 ? 'var(--ed-amber)' : rank === 3 ? 'var(--ed-ink)' : 'transparent',
        color: rank <= 3 ? 'var(--ed-paper)' : 'var(--ed-ink-muted)',
        border: rank > 3 ? '1px solid var(--ed-line)' : 'none',
      }}>{rank}</span>
      <div className="flex-1 min-w-0">
        <Link href={`/businesses/${biz.slug}`}><h4 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</h4></Link>
        {englishName && <p style={{ fontSize: 11, color: 'var(--ed-ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{englishName}</p>}
        <div style={{ fontSize: 11.5, color: 'var(--ed-ink-soft)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {reviews > 0 && <><span style={{ color: 'var(--ed-amber)' }}>★</span> {rating.toFixed(1)} ({reviews.toLocaleString()})</>}
          {address && <>{reviews > 0 && <span> · </span>}<a href={gmapUrl(address)} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ed-accent)] transition-colors">📍 {cleanAddr(address).slice(0, 40)}</a></>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ed-ink-soft)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
          {biz.phone && <a href={`tel:${biz.phone}`} className="hover:text-[var(--ed-accent)] transition-colors">📞 {biz.phone}</a>}
          {(biz.website_url || biz.website) && <WebsiteLink url={biz.website_url || biz.website} />}
        </div>
      </div>
      {cats[0] && <span className="flex-shrink-0" style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>{cats[0]}</span>}
    </div>
  );
}

function SubcategoryCard({ biz, rank }: { biz: AnyRow; rank: number }) {
  const name = pickBusinessDisplayName(biz, '');
  const englishName = biz.display_name && biz.display_name !== name ? biz.display_name : '';
  const address = biz.address_full || '';
  const rating = Number(biz.avg_rating || 0);
  const reviews = Number(biz.review_count || 0);
  const aiTags = (biz.ai_tags || []).filter((t: string) => t !== 'GBP已认领').slice(0, 3) as string[];
  const cats = Array.isArray(biz.business_categories) ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean) : [];
  const website = biz.website_url || biz.website || '';

  return (
    <div>
      <EditorialCard className="h-full hover:-translate-y-0.5 hover:border-[var(--ed-ink-soft)] transition-all">
        <div style={{ padding: '18px 20px' }}>
        {/* Top row */}
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          {cats[0] && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-paper-warm)', color: 'var(--ed-ink-soft)' }}>{cats[0]}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-accent)' }}>{rank}</span>
        </div>
        {/* Name */}
        <Link href={`/businesses/${biz.slug}`}><h4 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{name}</h4></Link>
        {englishName && <p style={{ fontSize: 11.5, color: 'var(--ed-ink-soft)', marginBottom: 8 }}>{englishName}</p>}
        {/* Rating */}
        {reviews > 0 && (
          <div style={{ fontSize: 12.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--ed-amber)' }}>★</span>
            <span style={{ fontWeight: 600 }}>{rating.toFixed(1)}</span>
            <span style={{ color: 'var(--ed-ink-soft)' }}>({reviews.toLocaleString()} 评价)</span>
          </div>
        )}
        {/* Star bar */}
        {reviews > 0 && (
          <div className="flex gap-0.5" style={{ marginBottom: 10 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < Math.round(rating) ? 'var(--ed-amber)' : 'var(--ed-line)' }} />
            ))}
          </div>
        )}
        {/* Tags */}
        {aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginBottom: 10 }}>
            {aiTags.map(tag => (
              <span key={tag} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>{tag}</span>
            ))}
          </div>
        )}
        {/* Address & Phone */}
        {address && <a href={gmapUrl(address)} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginBottom: 6 }}>📍 {cleanAddr(address)}</a>}
        {biz.phone && <a href={`tel:${biz.phone}`} className="block hover:text-[var(--ed-accent)] transition-colors" style={{ fontSize: 12, color: 'var(--ed-ink)' }}>📞 {biz.phone}</a>}
        {/* Bottom */}
        <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ed-line)' }}>
          <Link href={`/businesses/${biz.slug}`} style={{ fontSize: 12, color: 'var(--ed-accent)', fontWeight: 500 }}>查看详情 →</Link>
          {website && <WebsiteLink url={website} />}
        </div>
        </div>
      </EditorialCard>
    </div>
  );
}

function Pagination({ currentPage, totalPages, basePath, extra }: { currentPage: number; totalPages: number; basePath: string; extra: Record<string, string> }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-1 mt-10" aria-label="分页">
      {currentPage > 1 ? (
        <Link href={buildHref(basePath, currentPage - 1, extra)} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ed-ink-soft)', borderRadius: 'var(--ed-radius-md)' }}>上一页</Link>
      ) : (
        <span style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ed-ink-muted)', opacity: 0.4 }}>上一页</span>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
        .map((page, idx, arr) => (
          <span key={page} className="flex items-center">
            {idx > 0 && arr[idx - 1] !== page - 1 && <span style={{ padding: '0 4px', color: 'var(--ed-ink-muted)' }}>...</span>}
            <Link href={buildHref(basePath, page, extra)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, borderRadius: 8, background: page === currentPage ? 'var(--ed-ink)' : 'transparent', color: page === currentPage ? 'var(--ed-paper)' : 'var(--ed-ink-soft)', border: page === currentPage ? 'none' : '1px solid var(--ed-line)', fontWeight: page === currentPage ? 600 : 400 }}>{page}</Link>
          </span>
        ))}
      {currentPage < totalPages ? (
        <Link href={buildHref(basePath, currentPage + 1, extra)} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ed-ink-soft)', borderRadius: 'var(--ed-radius-md)' }}>下一页</Link>
      ) : (
        <span style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ed-ink-muted)', opacity: 0.4 }}>下一页</span>
      )}
    </nav>
  );
}

function CTABanner() {
  return (
    <section style={{ background: 'var(--ed-ink)', color: 'var(--ed-paper)' }}>
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 700, marginBottom: 8 }}>你是商家？立即入驻 Baam，获得更多曝光</h2>
        <p style={{ fontSize: 14, opacity: 0.65, marginBottom: 28 }}>免费创建商家主页 · AI 自动优化 · 精准触达本地华人客户</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/businesses/claim" style={{ padding: '10px 28px', borderRadius: 'var(--ed-radius-md)', fontSize: 14, fontWeight: 500, background: 'var(--ed-paper)', color: 'var(--ed-ink)' }}>免费入驻</Link>
          <Link href="/businesses/claim" style={{ padding: '10px 28px', borderRadius: 'var(--ed-radius-md)', fontSize: 14, fontWeight: 500, border: '1px solid rgba(255,255,255,0.3)', color: 'var(--ed-paper)', background: 'transparent' }}>了解更多</Link>
        </div>
      </div>
    </section>
  );
}

function buildHref(basePath: string, page: number, extra: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
