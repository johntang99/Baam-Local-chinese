import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminDashboard({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  const supabase = createAdminClient();


  // Filtered counts for this site
  const [
    { count: articleCount },
    { count: businessCount },
    { count: threadCount },
    { count: leadCount },
    { count: eventCount },
    { count: voiceCount },
    { count: pendingJobCount },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('editorial_status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('businesses').select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('forum_threads').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('voice_posts').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  // Recent articles for this site
  const { data: rawArticles } = await supabase
    .from('articles')
    .select('*')
    .in('region_id', ctx.regionIds)
    .order('created_at', { ascending: false })
    .limit(5);
  const recentArticles = (rawArticles || []) as AnyRow[];

  // Recent leads
  const { data: rawLeads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  const recentLeads = (rawLeads || []) as AnyRow[];

  const stats = [
    { label: '文章', value: articleCount || 0, icon: '📝', color: 'text-blue-600' },
    { label: '商家', value: businessCount || 0, icon: '🏪', color: 'text-primary' },
    { label: '论坛帖数', value: threadCount || 0, icon: '💬', color: 'text-purple-600' },
    { label: '活动', value: eventCount || 0, icon: '📅', color: 'text-green-600' },
    { label: '达人内容', value: voiceCount || 0, icon: '🎙️', color: 'text-pink-600' },
    { label: '待处理线索', value: leadCount || 0, icon: '📥', color: 'text-red-600' },
  ];

  const currentSiteName = ctx.siteName;

  return (
    <div className="p-6 space-y-6">
      {/* Site indicator */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">当前站点</p>
          <p className="text-lg font-bold">{currentSiteName}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>地区：{ctx.regionIds.join(', ')}</span>
          <span>语言：{ctx.locale === 'zh' ? '中文' : 'English'}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Articles */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold mb-4">最近文章（{currentSiteName}）</h2>
          {recentArticles.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">该站点暂无文章</p>
          ) : (
            <div className="space-y-3">
              {recentArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{article.title_zh || article.title_en || '无标题'}</p>
                    <p className="text-xs text-gray-400">{article.content_vertical} · {article.editorial_status}</p>
                  </div>
                  <a href={`/admin/articles/${article.id}/edit?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="text-xs text-primary hover:underline ml-2">编辑</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold mb-4">最新线索</h2>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无线索</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{lead.contact_name || '匿名'}</p>
                    <p className="text-xs text-gray-400">{lead.source_type} · {lead.ai_summary || lead.message?.slice(0, 50)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lead.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-4">快捷操作</h2>
        <div className="flex flex-wrap gap-3">
          <a href={`/admin/articles/new?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark inline-flex items-center">+ 新建文章</a>
          <a href={`/admin/businesses?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">审核商家</a>
          <a href={`/admin/forum?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">审核帖子</a>
          <a href={`/admin/leads?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">处理线索</a>
        </div>
      </div>
    </div>
  );
}
