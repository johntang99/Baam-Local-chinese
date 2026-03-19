import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    published: 'badge-green',
    pending: 'badge-yellow',
    removed: 'badge-red',
    locked: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

export default async function AdminForumPage() {
  const supabase = await createClient();

  const [
    { data: rawPendingThreads },
    { data: rawAllThreads },
  ] = await Promise.all([
    supabase
      .from('forum_threads')
      .select('*')
      .or('status.eq.pending,ai_spam_score.gt.0.7')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('forum_threads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const pendingThreads = (rawPendingThreads || []) as AnyRow[];
  const allThreads = (rawAllThreads || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">论坛管理</h1>
            <p className="text-sm text-text-muted">Admin / Forum</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Pending Review Section */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">
            待审核
            {pendingThreads.length > 0 && (
              <span className="badge badge-red text-xs ml-2">{pendingThreads.length}</span>
            )}
          </h2>

          {pendingThreads.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">暂无待审核帖子</p>
          ) : (
            <div className="space-y-3">
              {pendingThreads.map((thread) => (
                <div
                  key={thread.id}
                  className="flex items-center justify-between py-3 border-b border-border-light last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{thread.title || '无标题'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">作者: {thread.author_id?.slice(0, 8) || '—'}</span>
                      {thread.ai_spam_score != null && (
                        <span
                          className={`badge ${thread.ai_spam_score > 0.7 ? 'badge-red' : 'badge-gray'} text-xs`}
                        >
                          Spam: {(thread.ai_spam_score * 100).toFixed(0)}%
                        </span>
                      )}
                      <span className={`badge ${statusBadge(thread.status)} text-xs`}>
                        {thread.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/admin/forum?approve=${thread.id}`}
                      className="btn btn-primary h-7 px-3 text-xs"
                    >
                      通过
                    </Link>
                    <Link
                      href={`/admin/forum?delete=${thread.id}`}
                      className="btn btn-outline h-7 px-3 text-xs text-accent-red border-accent-red"
                    >
                      删除
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Threads Section */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">全部帖子</h2>
          </div>

          {allThreads.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">暂无帖子</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>板块</th>
                  <th>状态</th>
                  <th>回复</th>
                  <th>浏览</th>
                  <th>置顶</th>
                </tr>
              </thead>
              <tbody>
                {allThreads.map((thread) => (
                  <tr key={thread.id}>
                    <td className="max-w-[240px]">
                      <p className="truncate text-sm font-medium">{thread.title || '无标题'}</p>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">{thread.board_id?.slice(0, 8) || '—'}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(thread.status)} text-xs`}>
                        {thread.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{thread.reply_count ?? 0}</span>
                    </td>
                    <td>
                      <span className="text-sm">{thread.view_count ?? 0}</span>
                    </td>
                    <td>
                      <span className={`badge ${thread.is_pinned ? 'badge-blue' : 'badge-gray'} text-xs`}>
                        {thread.is_pinned ? '已置顶' : '—'}
                      </span>
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
