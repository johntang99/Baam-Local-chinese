import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import LeadsTable from './LeadsTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'new', label: '新建' },
  { key: 'contacted', label: '已联系' },
  { key: 'converted', label: '已转化' },
  { key: 'closed', label: '已关闭' },
];

export default async function AdminLeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const statusFilter = typeof params.status === 'string' ? params.status : '';

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

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
    if (!('status' in overrides) && statusFilter) p.set('status', statusFilter);
    return `/admin/leads?${p.toString()}`;
  }

  // Fetch stats counts
  const [
    { count: totalCount },
    { count: newCount },
    { count: contactedCount },
    { count: convertedCount },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', ctx.regionIds),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', ctx.regionIds).eq('status', 'new'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', ctx.regionIds).eq('status', 'contacted'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', ctx.regionIds).eq('status', 'converted'),
  ]);

  const stats = [
    { label: '总线索', value: totalCount || 0, color: 'text-text-primary' },
    { label: '新线索', value: newCount || 0, color: 'text-accent-red' },
    { label: '已联系', value: contactedCount || 0, color: 'text-accent-blue' },
    { label: '已转化', value: convertedCount || 0, color: 'text-accent-green' },
  ];

  // Fetch leads with optional business join
  let query = supabase
    .from('leads')
    .select('*, businesses(name_zh)', { count: 'exact' })
    .in('region_id', ctx.regionIds)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rawLeads, count: leadsCount } = await query;
  const leads = ((rawLeads || []) as AnyRow[]).map((lead) => ({
    ...lead,
    business_name: lead.businesses?.name_zh || null,
  }));
  const leadsTotal = leadsCount ?? leads.length;

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Export button */}
        <div className="flex justify-end">
          <button className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page inline-flex items-center">
            导出CSV
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-bg-card border border-border rounded-xl p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-4">
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
        </div>

        {/* Leads table */}
        <LeadsTable leads={leads} />

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            显示 {from + 1}-{Math.min(from + leads.length, leadsTotal)} / 共 {leadsTotal} 条
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
            {from + pageSize < leadsTotal && (
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
