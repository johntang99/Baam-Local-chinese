import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4) + '****';
}

function truncate(text: string | null, max = 50): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const statusBadge: Record<string, string> = {
  new: 'badge-red',
  contacted: 'badge-blue',
  qualified: 'badge-purple',
  converted: 'badge-green',
  closed: 'badge-gray',
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const ctx = getAdminSiteContext(await searchParams);
  const supabase = createAdminClient();

  // Resolve region IDs from slugs
  const { data: regionRows } = await supabase
    .from('regions')
    .select('id, slug')
    .in('slug', ctx.regionSlugs);
  const regionIds = (regionRows || []).map((r: AnyRow) => r.id);

  const [
    { count: totalCount },
    { count: newCount },
    { count: contactedCount },
    { count: convertedCount },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', regionIds),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', regionIds).eq('status', 'new'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', regionIds).eq('status', 'contacted'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('region_id', regionIds).eq('status', 'converted'),
  ]);

  const { data: rawLeads } = await supabase
    .from('leads')
    .select('*')
    .in('region_id', regionIds)
    .order('created_at', { ascending: false })
    .limit(50);
  const leads = (rawLeads || []) as AnyRow[];

  const stats = [
    { label: '总线索', value: totalCount || 0, color: 'text-text-primary' },
    { label: '新线索', value: newCount || 0, color: 'text-accent-red' },
    { label: '已联系', value: contactedCount || 0, color: 'text-accent-blue' },
    { label: '已转化', value: convertedCount || 0, color: 'text-accent-green' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">线索管理</h1>
            <p className="text-sm text-text-muted">Admin / Leads</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted bg-bg-page border border-border rounded px-2 py-1">
              Site: {ctx.siteId}
            </span>
            <button className="btn btn-outline h-9 px-4 text-sm">导出CSV</button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>来源</th>
                  <th>AI摘要</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-text-muted py-8">该站点暂无线索</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="font-medium">{lead.contact_name || '匿名'}</td>
                      <td className="text-text-secondary">{maskPhone(lead.contact_phone)}</td>
                      <td>{lead.source_type || '—'}</td>
                      <td className="text-text-secondary text-sm">{truncate(lead.ai_summary)}</td>
                      <td>
                        <span className={`badge ${statusBadge[lead.status] || 'badge-gray'}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="text-text-muted text-sm">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('zh-CN') : '—'}
                      </td>
                      <td>
                        <Link href={`/admin/leads/${lead.id}`} className="text-sm text-primary hover:underline">
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
