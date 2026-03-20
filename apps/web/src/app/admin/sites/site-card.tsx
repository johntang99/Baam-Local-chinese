'use client';

import { useState } from 'react';
import { addRegionToSite, removeRegionFromSite, updateSiteStatus } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface SiteCardProps {
  site: AnyRow;
  siteRegions: AnyRow[];
  counts: { articles: number; businesses: number; threads: number };
  allRegions: AnyRow[];
}

export function SiteCard({ site, siteRegions, counts, allRegions }: SiteCardProps) {
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [loading, setLoading] = useState('');

  // Regions not yet in this site
  const currentRegionIds = new Set(siteRegions.map(r => r.id));
  const availableRegions = allRegions.filter(r => !currentRegionIds.has(r.id));

  const handleAddRegion = async (regionId: string) => {
    setLoading(regionId);
    await addRegionToSite(site.id, regionId);
    setLoading('');
    setShowAddRegion(false);
  };

  const handleRemoveRegion = async (regionId: string) => {
    if (!confirm('确定要从此站点移除该地区吗？')) return;
    setLoading(regionId);
    await removeRegionFromSite(site.id, regionId);
    setLoading('');
  };

  const handleStatusToggle = async () => {
    const newStatus = site.status === 'active' ? 'disabled' : 'active';
    await updateSiteStatus(site.id, newStatus);
  };

  return (
    <div className={`bg-white border rounded-xl p-6 ${site.status === 'active' ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">{site.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
              site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`} onClick={handleStatusToggle} title="点击切换状态">
              {site.status === 'active' ? '运行中' : site.status === 'planned' ? '计划中' : '已禁用'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{site.name_zh}</p>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500">域名</span>
          <span className="font-mono text-gray-700">{site.domain || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500">语言</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            site.locale === 'zh' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>{site.locale === 'zh' ? '中文' : 'English'}</span>
        </div>

        {/* Regions — editable */}
        <div className="py-2 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500">覆盖地区</span>
            <button
              onClick={() => setShowAddRegion(!showAddRegion)}
              className="text-xs text-primary hover:underline"
            >
              + 添加地区
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {siteRegions.map(region => (
              <span key={region.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs group">
                {region.name_zh || region.name_en}
                {region.is_primary && <span className="text-primary text-[10px]">★</span>}
                <button
                  onClick={() => handleRemoveRegion(region.id)}
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                  title="移除"
                >
                  ×
                </button>
              </span>
            ))}
            {siteRegions.length === 0 && <span className="text-xs text-gray-400">暂无地区</span>}
          </div>

          {/* Add region dropdown */}
          {showAddRegion && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">选择要添加的地区：</p>
              {availableRegions.length === 0 ? (
                <p className="text-xs text-gray-400">所有地区已添加。可在下方创建新地区。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableRegions.map(region => (
                    <button
                      key={region.id}
                      onClick={() => handleAddRegion(region.id)}
                      disabled={loading === region.id}
                      className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white hover:border-primary transition disabled:opacity-50"
                    >
                      {loading === region.id ? '添加中...' : `+ ${region.name_zh || region.name_en}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {site.description && (
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">说明</span>
            <span className="text-gray-700 text-right max-w-[60%]">{site.description}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {site.status === 'active' && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{counts.articles}</p>
            <p className="text-xs text-gray-500">文章</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{counts.businesses}</p>
            <p className="text-xs text-gray-500">商家</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{counts.threads}</p>
            <p className="text-xs text-gray-500">帖子</p>
          </div>
        </div>
      )}
    </div>
  );
}
