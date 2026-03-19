import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Fetch counts for stat cards
  const [
    { count: userCount },
    { count: articleCount },
    { count: businessCount },
    { count: threadCount },
    { count: leadCount },
    { count: pendingJobCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('editorial_status', 'published'),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  // Recent articles
  const { data: rawArticles } = await supabase
    .from('articles')
    .select('*')
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
    { label: '总用户', value: userCount || 0, icon: '👥', trend: '+12%', color: 'text-accent-blue' },
    { label: '已发布文章', value: articleCount || 0, icon: '📝', trend: '+8%', color: 'text-accent-green' },
    { label: '入驻商家', value: businessCount || 0, icon: '🏪', trend: '+15%', color: 'text-primary' },
    { label: '论坛帖数', value: threadCount || 0, icon: '💬', trend: '+22%', color: 'text-accent-purple' },
    { label: '待处理线索', value: leadCount || 0, icon: '📥', trend: '', color: 'text-accent-red' },
    { label: 'AI任务队列', value: pendingJobCount || 0, icon: '🤖', trend: '', color: 'text-accent-yellow' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-sm text-text-muted">Admin / Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-text-secondary hover:text-text-primary">
              <span className="text-lg">🔔</span>
              {(leadCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-red text-white text-xs rounded-full flex items-center justify-center">
                  {leadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                {stat.trend && (
                  <span className="text-xs font-medium text-accent-green">{stat.trend}</span>
                )}
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Articles */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">最近文章</h2>
            {recentArticles.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">暂无文章</p>
            ) : (
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{article.title_zh || article.title_en || '无标题'}</p>
                      <p className="text-xs text-text-muted">{article.content_vertical} · {article.editorial_status}</p>
                    </div>
                    <a href={`/admin/articles?edit=${article.id}`} className="text-xs text-primary hover:underline ml-2">编辑</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Leads */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">最新线索</h2>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">暂无线索</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{lead.contact_name || '匿名'}</p>
                      <p className="text-xs text-text-muted">{lead.source_type} · {lead.ai_summary || lead.message?.slice(0, 50) || '无描述'}</p>
                    </div>
                    <span className={`badge ${lead.status === 'new' ? 'badge-red' : 'badge-gray'} text-xs`}>
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">快捷操作</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/admin/articles?new=true" className="btn btn-primary h-9 px-4 text-sm">+ 新建文章</a>
            <a href="/admin/businesses" className="btn btn-outline h-9 px-4 text-sm">审核商家</a>
            <a href="/admin/forum" className="btn btn-outline h-9 px-4 text-sm">审核帖子</a>
            <a href="/admin/leads" className="btn btn-outline h-9 px-4 text-sm">处理线索</a>
            <a href="/admin/ai-jobs" className="btn btn-outline h-9 px-4 text-sm">AI任务队列</a>
          </div>
        </div>
      </div>
    </div>
  );
}
