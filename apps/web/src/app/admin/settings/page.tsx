import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const [{ data: rawRegions }, { data: rawCategories }] = await Promise.all([
    supabase.from('regions').select('*').order('slug'),
    supabase.from('categories').select('*').order('type').order('sort_order'),
  ]);
  const regions = (rawRegions || []) as AnyRow[];
  const categories = (rawCategories || []) as AnyRow[];

  // Group categories by type
  const categoryGroups: Record<string, AnyRow[]> = {};
  for (const cat of categories) {
    const type = cat.type || 'other';
    if (!categoryGroups[type]) categoryGroups[type] = [];
    categoryGroups[type].push(cat);
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">系统设置</h1>
          <p className="text-sm text-text-muted">Admin / Settings</p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: Regions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">地区管理</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>中文名</th>
                    <th>英文名</th>
                    <th>类型</th>
                    <th>启用</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-text-muted py-8">暂无地区</td>
                    </tr>
                  ) : (
                    regions.map((region) => (
                      <tr key={region.id}>
                        <td className="font-medium font-mono text-sm">{region.slug}</td>
                        <td>{region.name_zh || '—'}</td>
                        <td className="text-text-secondary">{region.name_en || '—'}</td>
                        <td>{region.type || '—'}</td>
                        <td>
                          <span className={`badge ${region.is_active ? 'badge-green' : 'badge-gray'}`}>
                            {region.is_active ? '启用' : '停用'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 2: Categories */}
        <section>
          <h2 className="text-lg font-semibold mb-4">分类管理</h2>
          {Object.keys(categoryGroups).length === 0 ? (
            <div className="card p-6 text-center text-text-muted">暂无分类</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(categoryGroups).map(([type, cats]) => (
                <div key={type} className="card overflow-hidden">
                  <div className="px-4 py-3 bg-bg-page border-b border-border">
                    <h3 className="text-sm font-semibold text-text-secondary uppercase">{type}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>中文名</th>
                          <th>英文名</th>
                          <th>类型</th>
                          <th>排序</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cats.map((cat) => (
                          <tr key={cat.id}>
                            <td className="font-medium">{cat.name_zh || '—'}</td>
                            <td className="text-text-secondary">{cat.name_en || '—'}</td>
                            <td>{cat.type || '—'}</td>
                            <td>{cat.sort_order ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: System Parameters */}
        <section>
          <h2 className="text-lg font-semibold mb-4">系统参数</h2>
          <div className="card p-6">
            <div className="grid gap-6 max-w-xl">
              <div>
                <label className="block text-sm font-medium mb-1">默认地区</label>
                <select className="w-full border border-border rounded-lg px-3 py-2 bg-bg-card text-text-primary" disabled>
                  <option>melbourne</option>
                </select>
                <p className="text-xs text-text-muted mt-1">新用户注册时的默认地区</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">默认语言</label>
                <select className="w-full border border-border rounded-lg px-3 py-2 bg-bg-card text-text-primary" disabled>
                  <option>zh-CN</option>
                  <option>en</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI模型</label>
                <input
                  type="text"
                  className="w-full border border-border rounded-lg px-3 py-2 bg-bg-card text-text-primary"
                  defaultValue="gpt-4o-mini"
                  disabled
                />
                <p className="text-xs text-text-muted mt-1">当前用于内容生成的AI模型</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">维护模式</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" disabled className="rounded" />
                  <span className="text-sm text-text-secondary">启用维护模式（前端将显示维护页面）</span>
                </div>
              </div>
              <div>
                <button className="btn btn-primary h-9 px-6 text-sm" disabled>
                  保存设置
                </button>
                <p className="text-xs text-text-muted mt-2">设置功能即将上线</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
