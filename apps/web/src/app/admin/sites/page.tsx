import { createAdminClient } from '@/lib/supabase/admin';
import { SiteCard } from './site-card';
import { AddRegionForm } from './add-region-form';
import { AddSiteForm } from './add-site-form';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminSitesPage() {
  const supabase = createAdminClient();

  // Fetch sites with their regions
  const { data: rawSites } = await supabase
    .from('sites')
    .select('*')
    .order('sort_order');
  const sites = (rawSites || []) as AnyRow[];

  // Fetch site_regions with region details
  const { data: rawSiteRegions } = await supabase
    .from('site_regions')
    .select('site_id, region_id, is_primary');
  const siteRegions = (rawSiteRegions || []) as AnyRow[];

  // Fetch all regions
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('*')
    .order('sort_order');
  const regions = (rawRegions || []) as AnyRow[];

  // Build region map
  const regionMap: Record<string, AnyRow> = {};
  regions.forEach(r => { regionMap[r.id] = r; });

  // Build site -> regions map
  const siteRegionMap: Record<string, AnyRow[]> = {};
  siteRegions.forEach(sr => {
    if (!siteRegionMap[sr.site_id]) siteRegionMap[sr.site_id] = [];
    const region = regionMap[sr.region_id];
    if (region) siteRegionMap[sr.site_id].push({ ...region, is_primary: sr.is_primary });
  });

  // Content counts per site
  const siteCounts: Record<string, { articles: number; businesses: number; threads: number }> = {};
  for (const site of sites) {
    const regionIds = (siteRegionMap[site.id] || []).map((r: AnyRow) => r.id);
    if (regionIds.length === 0) {
      siteCounts[site.id] = { articles: 0, businesses: 0, threads: 0 };
      continue;
    }
    const [a, b, t] = await Promise.all([
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('editorial_status', 'published').in('region_id', regionIds),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('status', 'published').in('region_id', regionIds),
    ]);
    siteCounts[site.id] = { articles: a.count || 0, businesses: b.count || 0, threads: t.count || 0 };
  }

  // Regions not yet assigned to any site (for "add to site" dropdown)
  const assignedRegionIds = new Set(siteRegions.map((sr: AnyRow) => sr.region_id));
  const unassignedRegions = regions.filter(r => !assignedRegionIds.has(r.id));

  return (
    <div className="p-6 space-y-8">
      {/* Sites */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">站点配置</h2>
            <p className="text-sm text-gray-500">管理站点、覆盖地区和语言配置</p>
          </div>
          <AddSiteForm />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              siteRegions={siteRegionMap[site.id] || []}
              counts={siteCounts[site.id] || { articles: 0, businesses: 0, threads: 0 }}
              allRegions={regions}
            />
          ))}
        </div>
      </section>

      {/* Regions Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">地区列表</h2>
          <AddRegionForm parentRegions={regions} />
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
                <th>所属站点</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => {
                const parent = regions.find((r: AnyRow) => r.id === region.parent_id);
                const belongsToSites = siteRegions
                  .filter((sr: AnyRow) => sr.region_id === region.id)
                  .map((sr: AnyRow) => sites.find((s: AnyRow) => s.id === sr.site_id)?.name)
                  .filter(Boolean);

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
                      }`}>{region.type}</span>
                    </td>
                    <td className="text-sm text-gray-500">{parent?.name_zh || parent?.name_en || '—'}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {belongsToSites.length > 0 ? belongsToSites.map((name, i) => (
                          <span key={i} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{name}</span>
                        )) : <span className="text-xs text-gray-400">未分配</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${region.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
    </div>
  );
}
