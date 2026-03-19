import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function profileTypeBadge(type: string) {
  const map: Record<string, string> = {
    kol: 'badge-purple',
    expert: 'badge-blue',
    influencer: 'badge-yellow',
    creator: 'badge-green',
  };
  return map[type] || 'badge-gray';
}

export default async function AdminVoicesPage() {
  const supabase = await createClient();

  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('profile_type', 'user')
    .order('follower_count', { ascending: false })
    .limit(50);

  const profiles = (rawProfiles || []) as AnyRow[];
  const featuredProfiles = profiles.filter((p) => p.is_featured);

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">达人管理</h1>
            <p className="text-sm text-text-muted">Admin / Voices</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Featured Section */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">
            Featured管理
            <span className="badge badge-blue text-xs ml-2">{featuredProfiles.length}</span>
          </h2>

          {featuredProfiles.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">暂无Featured达人</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {featuredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 bg-bg-page border border-border rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium">{profile.display_name || '未命名'}</span>
                  <span className={`badge ${profileTypeBadge(profile.profile_type)} text-xs`}>
                    {profile.profile_type}
                  </span>
                  {profile.is_verified && (
                    <span className="badge badge-green text-xs">已认证</span>
                  )}
                  <Link
                    href={`/admin/voices?edit=${profile.id}`}
                    className="text-xs text-primary hover:underline ml-1"
                  >
                    编辑
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Profiles Table */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">全部达人 ({profiles.length})</h2>
          </div>

          {profiles.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">暂无达人</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>认证</th>
                  <th>Featured</th>
                  <th>粉丝数</th>
                  <th>帖子数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <span className="text-sm font-medium">{profile.display_name || '未命名'}</span>
                    </td>
                    <td>
                      <span className={`badge ${profileTypeBadge(profile.profile_type)} text-xs`}>
                        {profile.profile_type}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${profile.is_verified ? 'badge-green' : 'badge-gray'} text-xs`}>
                        {profile.is_verified ? '已认证' : '未认证'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${profile.is_featured ? 'badge-blue' : 'badge-gray'} text-xs`}>
                        {profile.is_featured ? '是' : '否'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{profile.follower_count ?? 0}</span>
                    </td>
                    <td>
                      <span className="text-sm">{profile.post_count ?? 0}</span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/voices?edit=${profile.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        编辑
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
