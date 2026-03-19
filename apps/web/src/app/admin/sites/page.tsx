import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminSitesPage() {
  const supabase = createAdminClient();

  // Fetch all regions
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('*')
    .order('sort_order', { ascending: true });
  const regions = (rawRegions || []) as AnyRow[];

  // Predefined site configurations
  const sites = [
    {
      id: 'ny-zh',
      name: 'New York Chinese',
      name_zh: '纽约中文站',
      locale: 'zh',
      domain: 'ny.baam.us',
      regions: ['flushing-ny', 'queens-ny', 'new-york-city'],
      status: 'active',
      description: '面向纽约华人社区，提供中文本地生活信息、商家目录、社区论坛',
    },
    {
      id: 'oc-en',
      name: 'Middletown OC English',
      name_zh: 'Middletown英文站',
      locale: 'en',
      domain: 'oc.baam.us',
      regions: ['middletown-ny', 'orange-county-ny'],
      status: 'planned',
      description: 'Local portal for Orange County English-speaking community',
    },
  ];

  // Count content per region
  const { count: nyArticles } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('editorial_status', 'published');
  const { count: nyBusinesses } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { count: nyThreads } = await supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('status', 'published');

  return (
    <div className="p-6 space-y-8">
      {/* Sites Overview */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">站点配置</h2>
            <p className="text-sm text-gray-500">管理各地区站点、语言和域名配置</p>
          </div>
          <button className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark">+ 添加站点</button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {sites.map((site) => (
            <div key={site.id} className={`bg-white border rounded-xl p-6 ${site.status === 'active' ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{site.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {site.status === 'active' ? '运行中' : '计划中'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{site.name_zh}</p>
                </div>
                <button className="text-sm text-primary hover:underline">编辑</button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">域名</span>
                  <span className="font-mono text-gray-700">{site.domain}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">语言</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    site.locale === 'zh' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {site.locale === 'zh' ? '中文' : 'English'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">覆盖地区</span>
                  <div className="flex gap-1">
                    {site.regions.map(r => {
                      const region = regions.find(rr => rr.slug === r);
                      return (
                        <span key={r} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                          {region?.name_zh || region?.name_en || r}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500">说明</span>
                  <span className="text-gray-700 text-right max-w-[60%]">{site.description}</span>
                </div>
              </div>

              {/* Stats for active sites */}
              {site.status === 'active' && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{nyArticles || 0}</p>
                    <p className="text-xs text-gray-500">文章</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{nyBusinesses || 0}</p>
                    <p className="text-xs text-gray-500">商家</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{nyThreads || 0}</p>
                    <p className="text-xs text-gray-500">帖子</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Regions Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">地区列表</h2>
          <button className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">+ 添加地区</button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>中文名</th>
                <th>英文名</th>
                <th>类型</th>
                <th>上级地区</th>
                <th>时区</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => {
                const parent = regions.find(r => r.id === region.parent_id);
                return (
                  <tr key={region.id}>
                    <td className="font-mono text-xs">{region.slug}</td>
                    <td>{region.name_zh || '—'}</td>
                    <td>{region.name_en}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        region.type === 'city' ? 'bg-blue-100 text-blue-700' :
                        region.type === 'county' ? 'bg-purple-100 text-purple-700' :
                        region.type === 'state' ? 'bg-green-100 text-green-700' :
                        region.type === 'neighborhood' ? 'bg-yellow-100 text-yellow-700' :
                        region.type === 'borough' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {region.type}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">{parent?.name_zh || parent?.name_en || '—'}</td>
                    <td className="text-xs text-gray-500">{region.timezone}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        region.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {region.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Role Assignment */}
      <section>
        <h2 className="text-lg font-bold mb-4">管理员权限分配</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-4">为管理员分配可管理的站点。超级管理员可以访问所有站点和系统设置。</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">A</div>
                <div>
                  <p className="text-sm font-medium">Baam Admin</p>
                  <p className="text-xs text-gray-400">admin@baamplatform.com</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">超级管理员</span>
                <span className="text-xs text-gray-400">所有站点</span>
              </div>
            </div>
          </div>
          <button className="mt-4 text-sm text-primary hover:underline">+ 添加管理员</button>
        </div>
      </section>
    </div>
  );
}
