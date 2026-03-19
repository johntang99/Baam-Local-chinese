import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'badge-gray',
    published: 'badge-green',
    archived: 'badge-red',
  };
  return map[status] || 'badge-gray';
}

export default async function AdminArticlesPage() {
  const supabase = await createClient();

  const { data: rawArticles, count } = await supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50);

  const articles = (rawArticles || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">内容管理</h1>
            <p className="text-sm text-text-muted">Admin / Articles</p>
          </div>
          <Link href="/admin/articles?new=true" className="btn btn-primary h-9 px-4 text-sm">
            + 新建文章
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Count */}
        <p className="text-sm text-text-muted">共 {count ?? articles.length} 篇文章</p>

        {articles.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-text-muted">暂无文章</p>
            <Link href="/admin/articles?new=true" className="btn btn-primary h-9 px-4 text-sm mt-4 inline-block">
              + 新建文章
            </Link>
          </div>
        ) : (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>频道</th>
                  <th>状态</th>
                  <th>地区</th>
                  <th>发布时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td className="max-w-[240px]">
                      <p className="truncate text-sm font-medium">
                        {article.title_zh || article.title_en || '无标题'}
                      </p>
                    </td>
                    <td>
                      {article.content_vertical && (
                        <span className="badge badge-blue text-xs">{article.content_vertical}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(article.editorial_status)} text-xs`}>
                        {article.editorial_status}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">—</span>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">
                        {article.published_at
                          ? new Date(article.published_at).toLocaleDateString('zh-CN')
                          : '未发布'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/articles?edit=${article.id}`}
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
