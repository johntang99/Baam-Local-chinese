import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import ArticlesTable from './ArticlesTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'ai_drafted', label: 'AI草稿' },
  { key: 'human_reviewed', label: '已审核' },
  { key: 'published', label: '已发布' },
  { key: 'archived', label: '已归档' },
];

const typeOptions = [
  { key: '', label: '全部类型' },
  { key: 'news', label: '新闻' },
  { key: 'guide', label: '指南' },
];

const GUIDE_VERTICALS = [
  'guide_howto',
  'guide_checklist',
  'guide_comparison',
  'guide_bestof',
  'guide_resource',
  'guide_scenario',
  'guide_seasonal',
  'guide_neighborhood',
];

const NEWS_VERTICALS = [
  'news_alert',
  'news_brief',
  'news_explainer',
  'news_roundup',
  'news_community',
];

export default async function AdminArticlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const siteScope = String(ctx.locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Resolve filters from searchParams
  const statusFilter = typeof params.status === 'string' ? params.status : '';
  const typeFilter = typeof params.type === 'string' ? params.type : '';
  const regionFilter = typeof params.filter_region === 'string' ? params.filter_region : '';
  const categoryFilter = typeof params.cat === 'string' ? params.cat : '';

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

  // Fetch region names for display
  const [{ data: regRows }, { data: rawGuideCategories }] = await Promise.all([
    supabase
      .from('regions')
      .select('id, name_zh, slug')
      .in('id', ctx.regionIds),
    supabase
      .from('categories_guide')
      .select('id, slug, name_zh, name_en, sort_order, site_scope')
      .eq('site_scope', siteScope)
      .order('sort_order', { ascending: true }),
  ]);
  const regionNameMap: Record<string, string> = {};
  (regRows || []).forEach((r: AnyRow) => {
    regionNameMap[r.id] = r.name_zh || r.slug;
  });
  const guideCategories = (rawGuideCategories || []) as AnyRow[];

  // Build query
  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false });

  // Some legacy/AI-generated guide articles may not have region_id.
  // Keep site-scoped rows, but include region-less rows so they are visible in admin.
  if (ctx.regionIds.length > 0) {
    query = query.or(`region_id.in.(${ctx.regionIds.join(',')}),region_id.is.null`);
  }

  if (statusFilter) {
    query = query.eq('editorial_status', statusFilter);
  }

  if (typeFilter === 'news') {
    query = query.in('content_vertical', NEWS_VERTICALS);
  } else if (typeFilter === 'guide') {
    query = query.in('content_vertical', GUIDE_VERTICALS);
  }

  if (regionFilter) {
    query = query.eq('region_id', regionFilter);
  }
  if (typeFilter === 'guide' && categoryFilter) {
    query = query.eq('category_id', categoryFilter);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rawArticles, count } = await query;
  const articles = (rawArticles || []) as AnyRow[];
  const totalCount = count ?? articles.length;

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
    if (!('status' in overrides) && statusFilter) p.set('status', statusFilter);
    if (!('type' in overrides) && typeFilter) p.set('type', typeFilter);
    if (!('filter_region' in overrides) && regionFilter) p.set('filter_region', regionFilter);
    if (!('cat' in overrides) && categoryFilter) p.set('cat', categoryFilter);
    return `/admin/articles?${p.toString()}`;
  }

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* New article button */}
        <div className="flex justify-end">
          <Link
            href={`/admin/articles/new?${baseParams.toString()}`}
            className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 inline-flex items-center"
          >
            + 新建文章
          </Link>
        </div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
            {statusTabs.map((tab) => (
              <Link
                key={tab.key}
                href={filterUrl({ status: tab.key, page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-bg-card text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {/* Type dropdown */}
          <div className="flex items-center gap-2">
            {typeOptions.map((opt) => (
              <Link
                key={opt.key}
                href={filterUrl({ type: opt.key, page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  typeFilter === opt.key
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Region dropdown */}
          {Object.keys(regionNameMap).length > 1 && (
            <div className="flex items-center gap-1">
              <Link
                href={filterUrl({ filter_region: '', page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  !regionFilter
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                全部地区
              </Link>
              {Object.entries(regionNameMap).map(([id, name]) => (
                <Link
                  key={id}
                  href={filterUrl({ filter_region: id, page: '' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    regionFilter === id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Guide category submenu */}
        {typeFilter === 'guide' && (
          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={filterUrl({ cat: '', page: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                !categoryFilter
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              全部分类
            </Link>
            {guideCategories.map((cat) => (
              <Link
                key={cat.id}
                href={filterUrl({ cat: String(cat.id), page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  categoryFilter === String(cat.id)
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                {cat.name_zh || cat.name_en || cat.slug}
              </Link>
            ))}
          </div>
        )}

        {/* Articles table (client component for bulk actions) */}
        {articles.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">&#128221;</p>
            <p className="text-text-muted">该站点暂无文章</p>
            <p className="text-sm text-text-muted mt-1">切换站点或创建新文章</p>
          </div>
        ) : (
          <ArticlesTable articles={articles} regionNameMap={regionNameMap} siteParams={baseParams.toString()} />
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            显示 {from + 1}-{Math.min(from + articles.length, totalCount)} / 共 {totalCount} 条
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
      </div>
    </div>
  );
}
