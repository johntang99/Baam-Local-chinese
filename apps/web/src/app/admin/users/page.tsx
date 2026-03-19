import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const profiles = (rawProfiles || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">用户管理</h1>
          <p className="text-sm text-text-muted">Admin / Users</p>
        </div>
      </div>

      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>显示名</th>
                  <th>用户名</th>
                  <th>类型</th>
                  <th>地区</th>
                  <th>粉丝数</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-text-muted py-8">暂无用户</td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="font-medium">{profile.display_name || '—'}</td>
                      <td className="text-text-secondary">{profile.username || '—'}</td>
                      <td>
                        <span className="badge badge-blue">{profile.profile_type || 'user'}</span>
                      </td>
                      <td className="text-text-muted">{profile.region_id || '—'}</td>
                      <td>{profile.follower_count ?? 0}</td>
                      <td className="text-text-muted text-sm">
                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString('zh-CN') : '—'}
                      </td>
                      <td>
                        <Link href={`/admin/users/${profile.id}`} className="text-sm text-primary hover:underline">
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
