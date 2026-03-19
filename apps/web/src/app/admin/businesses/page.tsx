import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'badge-green',
    inactive: 'badge-gray',
    suspended: 'badge-red',
  };
  return map[status] || 'badge-gray';
}

function verificationBadge(status: string) {
  const map: Record<string, string> = {
    verified: 'badge-green',
    pending: 'badge-yellow',
    rejected: 'badge-red',
    unverified: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

function planBadge(plan: string) {
  const map: Record<string, string> = {
    free: 'badge-gray',
    basic: 'badge-blue',
    premium: 'badge-purple',
    enterprise: 'badge-yellow',
  };
  return map[plan] || 'badge-gray';
}

export default async function AdminBusinessesPage() {
  const supabase = await createClient();

  const [
    { data: rawBusinesses, count },
    { count: pendingClaimCount },
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('business_claim_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const businesses = (rawBusinesses || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              商家管理
              {(pendingClaimCount || 0) > 0 && (
                <span className="badge badge-red text-xs ml-2">
                  {pendingClaimCount} 待审核认领
                </span>
              )}
            </h1>
            <p className="text-sm text-text-muted">Admin / Businesses</p>
          </div>
          <Link href="/admin/businesses?new=true" className="btn btn-primary h-9 px-4 text-sm">
            + 添加商家
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-text-muted">共 {count ?? businesses.length} 家商家</p>

        {businesses.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-text-muted">暂无商家</p>
            <Link href="/admin/businesses?new=true" className="btn btn-primary h-9 px-4 text-sm mt-4 inline-block">
              + 添加商家
            </Link>
          </div>
        ) : (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>商家名称</th>
                  <th>状态</th>
                  <th>认证</th>
                  <th>套餐</th>
                  <th>评分</th>
                  <th>评论数</th>
                  <th>线索数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((biz) => (
                  <tr key={biz.id}>
                    <td>
                      <span className="text-sm font-medium">{biz.display_name || '未命名'}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(biz.status)} text-xs`}>
                        {biz.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${verificationBadge(biz.verification_status)} text-xs`}>
                        {biz.verification_status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${planBadge(biz.current_plan)} text-xs`}>
                        {biz.current_plan}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{biz.avg_rating ? biz.avg_rating.toFixed(1) : '—'}</span>
                    </td>
                    <td>
                      <span className="text-sm">{biz.review_count ?? 0}</span>
                    </td>
                    <td>
                      <span className="text-sm">{biz.lead_count ?? 0}</span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/businesses?edit=${biz.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        编辑
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
