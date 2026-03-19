import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusBadge: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  ai_drafted: 'bg-yellow-100 text-yellow-700',
  human_reviewed: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

const verticalLabel: Record<string, string> = {
  news_alert: '快报', news_brief: '简报', news_explainer: '解读', news_roundup: '汇总', news_community: '社区',
  guide_howto: 'How-To', guide_checklist: 'Checklist', guide_bestof: 'Best-of', guide_comparison: '对比',
};

export default async function AdminArticlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = getAdminSiteContext(params);
  const supabase = createAdminClient();

  // Resolve region IDs from site slugs
  const { data: regionRows } = await supabase.from('regions').select('id, slug, name_zh').in('slug', ctx.regionSlugs);
  const regionIds = (regionRows || []).map((r: AnyRow) => r.id);
  const regionNameMap: Record<string, string> = {};
  (regionRows || []).forEach((r: AnyRow) => { regionNameMap[r.id] = r.name_zh || r.slug; });

  // Query articles filtered by region
  const { data: rawArticles } = await supabase
    .from('articles')
    .select('*')
    .in('region_id', regionIds)
    .order('created_at', { ascending: false })
    .limit(50);
  const articles = (rawArticles || []) as AnyRow[];

  const siteName = ctx.siteId === 'ny-zh' ? 'New York Chinese' : 'Middletown OC English';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 mb-1">站点：{siteName} · {ctx.locale === 'zh' ? '中文' : 'English'}</p>
          <p className="text-gray-500">共 {articles.length} 篇文章</p>
        </div>
        <button className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark">+ 新建文章</button>
      </div>

      {articles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-gray-500">该站点暂无文章</p>
          <p className="text-sm text-gray-400 mt-1">切换站点或创建新文章</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>标题</th><th>频道</th><th>状态</th><th>地区</th><th>浏览</th><th>发布时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-[300px]"><p className="font-medium truncate">{a.title_zh || a.title_en || '无标题'}</p></td>
                  <td><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{verticalLabel[a.content_vertical] || a.content_vertical}</span></td>
                  <td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[a.editorial_status] || 'bg-gray-100'}`}>{a.editorial_status}</span></td>
                  <td className="text-sm text-gray-500">{a.region_id ? (regionNameMap[a.region_id] || '—') : '—'}</td>
                  <td className="text-sm text-gray-500">{a.view_count || 0}</td>
                  <td className="text-sm text-gray-500">{a.published_at ? new Date(a.published_at).toLocaleDateString('zh-CN') : '—'}</td>
                  <td><Link href={`/admin/articles?region=${ctx.siteId}&locale=${ctx.locale}`} className="text-sm text-primary hover:underline">编辑</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
