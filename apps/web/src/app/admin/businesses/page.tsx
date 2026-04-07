import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import BusinessesTable, { ClaimsTable } from './BusinessesTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const mainTabs = [
  { key: 'all', label: '全部商家' },
  { key: 'claims', label: '待审核认领' },
  { key: 'featured', label: 'Featured商家' },
];

const statusOptions = [
  { key: '', label: '全部状态' },
  { key: 'active', label: '活跃' },
  { key: 'inactive', label: '未激活' },
  { key: 'suspended', label: '已暂停' },
  { key: 'claimed', label: '已认领' },
];

const verificationOptions = [
  { key: '', label: '全部认证' },
  { key: 'verified', label: '已认证' },
  { key: 'pending', label: '待认证' },
  { key: 'unverified', label: '未认证' },
  { key: 'rejected', label: '已拒绝' },
];

const planOptions = [
  { key: '', label: '全部套餐' },
  { key: 'free', label: 'Free' },
  { key: 'basic', label: 'Basic' },
  { key: 'premium', label: 'Premium' },
  { key: 'enterprise', label: 'Enterprise' },
];

export default async function AdminBusinessesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Resolve filters from searchParams
  const tab = typeof params.tab === 'string' ? params.tab : 'all';
  const statusFilter = typeof params.status === 'string' ? params.status : '';
  const verificationFilter = typeof params.verification === 'string' ? params.verification : '';
  const planFilter = typeof params.plan === 'string' ? params.plan : '';
  const catFilter = typeof params.cat === 'string' ? params.cat : '';
  const subFilter = typeof params.sub === 'string' ? params.sub : '';

  // Fetch business categories for filter
  const { data: rawCats } = await supabase
    .from('categories')
    .select('id, name_zh, slug, parent_id, icon')
    .eq('type', 'business')
    .eq('site_scope', 'zh')
    .order('sort_order', { ascending: true });
  const allCats = (rawCats || []) as AnyRow[];
  const parentCats = allCats.filter((c: AnyRow) => !c.parent_id);
  const activeParentCat = parentCats.find((c: AnyRow) => c.slug === catFilter);
  const childCats = activeParentCat ? allCats.filter((c: AnyRow) => c.parent_id === activeParentCat.id) : [];

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

  // Fetch pending claims count
  const { count: pendingClaimCount } = await supabase
    .from('business_claim_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Build base URL for filter links
  const baseParams = new URLSearchParams();
  if (params.region) baseParams.set('region', String(params.region));
  if (params.locale) baseParams.set('locale', String(params.locale));

  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams(baseParams);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    // Preserve existing filters not being overridden
    if (!('tab' in overrides) && tab !== 'all') p.set('tab', tab);
    if (!('status' in overrides) && statusFilter) p.set('status', statusFilter);
    if (!('verification' in overrides) && verificationFilter) p.set('verification', verificationFilter);
    if (!('plan' in overrides) && planFilter) p.set('plan', planFilter);
    if (!('cat' in overrides) && catFilter) p.set('cat', catFilter);
    if (!('sub' in overrides) && subFilter) p.set('sub', subFilter);
    return `/admin/businesses?${p.toString()}`;
  }

  // Fetch data based on active tab
  let businesses: AnyRow[] = [];
  let totalCount = 0;
  let claims: AnyRow[] = [];

  if (tab === 'claims') {
    // Fetch pending claims scoped to this site
    const { data: siteBizRows } = await supabase
      .from('businesses')
      .select('id')
      .eq('site_id', ctx.siteId);
    const siteBizIds = (siteBizRows || []).map((r: AnyRow) => r.id);

    if (siteBizIds.length > 0) {
      const { data: rawClaims } = await supabase
        .from('business_claim_requests')
        .select('*')
        .eq('status', 'pending')
        .in('business_id', siteBizIds)
        .order('created_at', { ascending: false })
        .limit(50);
      claims = (rawClaims || []) as AnyRow[];
    } else {
      claims = [];
    }
  } else {
    // Build businesses query — filter by site_id directly
    let query = supabase
      .from('businesses')
      .select('*', { count: 'exact' })
      .eq('site_id', ctx.siteId)
      .order('created_at', { ascending: false });

    if (tab === 'featured') query = query.eq('is_featured', true);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (verificationFilter) query = query.eq('verification_status', verificationFilter);
    if (planFilter) query = query.eq('current_plan', planFilter);

    // Category filter
    const filterCatSlug = subFilter || catFilter;
    if (filterCatSlug) {
      const matchedCat = allCats.find((c: AnyRow) => c.slug === filterCatSlug);
      if (matchedCat) {
        const filterCatIds = [matchedCat.id];
        if (!matchedCat.parent_id) {
          filterCatIds.push(...allCats.filter((c: AnyRow) => c.parent_id === matchedCat.id).map((c: AnyRow) => c.id));
        }
        const { data: bizCatRows } = await supabase
          .from('business_categories')
          .select('business_id')
          .in('category_id', filterCatIds)
          .limit(10000);
        const bizIds = (bizCatRows || []).map((r: AnyRow) => r.business_id);
        if (bizIds.length > 0) {
          query = query.in('id', bizIds);
        } else {
          query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
      }
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data: rawBusinesses, count } = await query;
    businesses = (rawBusinesses || []) as AnyRow[];
    totalCount = count ?? businesses.length;
  }

  const from = (page - 1) * pageSize;

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* New business button */}
        <div className="flex justify-end">
          <Link
            href={`/admin/businesses/new?${baseParams.toString()}`}
            className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 inline-flex items-center"
          >
            + 添加商家
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
          {mainTabs.map((t) => (
            <Link
              key={t.key}
              href={filterUrl({ tab: t.key === 'all' ? '' : t.key, status: '', verification: '', plan: '', page: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {t.label}
              {t.key === 'claims' && (pendingClaimCount || 0) > 0 && (
                <span className="ml-1 badge badge-red text-xs">{pendingClaimCount}</span>
              )}
            </Link>
          ))}
        </div>

        {/* Filter bar (only for all and featured tabs) */}
        {tab !== 'claims' && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Status filter */}
            <div className="flex items-center gap-1">
              {statusOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={filterUrl({ status: opt.key, page: '' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    statusFilter === opt.key
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {/* Verification filter */}
            <div className="flex items-center gap-1">
              {verificationOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={filterUrl({ verification: opt.key, page: '' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    verificationFilter === opt.key
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {/* Plan filter */}
            <div className="flex items-center gap-1">
              {planOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={filterUrl({ plan: opt.key, page: '' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    planFilter === opt.key
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {/* Category filter */}
            <div className="w-full flex flex-wrap items-center gap-1 pt-2 border-t border-border">
              <span className="text-sm text-text-secondary mr-1">分类:</span>
              <Link
                href={filterUrl({ cat: '', sub: '', page: '' })}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  !catFilter ? 'bg-primary text-white' : 'text-text-secondary hover:text-text hover:bg-bg-page'
                }`}
              >
                全部
              </Link>
              {parentCats.map((cat) => (
                <Link
                  key={cat.id}
                  href={filterUrl({ cat: cat.slug, sub: '', page: '' })}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    catFilter === cat.slug ? 'bg-primary text-white' : 'text-text-secondary hover:text-text hover:bg-bg-page'
                  }`}
                >
                  {cat.icon} {cat.name_zh}
                </Link>
              ))}
            </div>

            {/* Subcategory filter */}
            {childCats.length > 0 && (
              <div className="w-full flex flex-wrap items-center gap-1">
                <span className="text-sm text-text-secondary mr-1">子分类:</span>
                <Link
                  href={filterUrl({ sub: '', page: '' })}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    !subFilter ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text hover:bg-bg-page'
                  }`}
                >
                  全部
                </Link>
                {childCats.map((sub) => (
                  <Link
                    key={sub.id}
                    href={filterUrl({ sub: sub.slug, page: '' })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      subFilter === sub.slug ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text hover:bg-bg-page'
                    }`}
                  >
                    {sub.icon} {sub.name_zh}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content based on tab */}
        {tab === 'claims' ? (
          <ClaimsTable claims={claims} siteId={ctx.siteId} />
        ) : businesses.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-text-muted">暂无商家数据</p>
            <p className="text-sm text-text-muted mt-1">切换筛选条件或创建新商家</p>
          </div>
        ) : (
          <BusinessesTable businesses={businesses} siteId={ctx.siteId} siteParams={baseParams.toString()} />
        )}

        {/* Pagination (not for claims tab) */}
        {tab !== 'claims' && (
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>
              显示 {from + 1}-{Math.min(from + businesses.length, totalCount)} / 共 {totalCount} 条
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={filterUrl({ page: String(page - 1) })}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
                >
                  上一页
                </Link>
              )}
              {from + pageSize < totalCount && (
                <Link
                  href={filterUrl({ page: String(page + 1) })}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
                >
                  下一页
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
