'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { approveThread, deleteThread, pinThread, lockThread, featureThread } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadgeMap: Record<string, { cls: string; label: string }> = {
  published: { cls: 'badge badge-green', label: '已发布' },
  pending: { cls: 'badge badge-yellow', label: '待审核' },
  removed: { cls: 'badge badge-red', label: '已删除' },
  locked: { cls: 'badge badge-gray', label: '已锁定' },
};

interface PendingQueueProps {
  threads: AnyRow[];
}

export function PendingQueue({ threads }: PendingQueueProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleApprove = (threadId: string) => {
    startTransition(async () => {
      await approveThread(threadId);
      router.refresh();
    });
  };

  const handleDelete = (threadId: string) => {
    if (!confirm('确定要删除这个帖子吗？相关回复也会被删除。')) return;
    startTransition(async () => {
      await deleteThread(threadId);
      router.refresh();
    });
  };

  if (threads.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-text-muted">暂无待审核帖子</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="space-y-3">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{thread.title || '无标题'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-muted">作者: {thread.author_id?.slice(0, 8) || '--'}</span>
                {thread.ai_spam_score != null && (
                  <span
                    className={`badge ${thread.ai_spam_score > 0.7 ? 'badge-red' : 'badge-gray'} text-xs`}
                  >
                    Spam: {(thread.ai_spam_score * 100).toFixed(0)}%
                  </span>
                )}
                <span className={`${statusBadgeMap[thread.status]?.cls || 'badge badge-gray'} text-xs`}>
                  {statusBadgeMap[thread.status]?.label || thread.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleApprove(thread.id)}
                disabled={isPending}
                className="h-7 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                通过
              </button>
              <button
                onClick={() => handleDelete(thread.id)}
                disabled={isPending}
                className="h-7 px-3 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ThreadsTableProps {
  threads: AnyRow[];
  boardNameMap: Record<string, string>;
}

export function ThreadsTable({ threads, boardNameMap }: ThreadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = (threadId: string) => {
    if (!confirm('确定要删除这个帖子吗？相关回复也会被删除。')) return;
    startTransition(async () => {
      await deleteThread(threadId);
      router.refresh();
    });
  };

  const handleTogglePin = (threadId: string, currentPinned: boolean) => {
    startTransition(async () => {
      await pinThread(threadId, !currentPinned);
      router.refresh();
    });
  };

  const handleLock = (threadId: string) => {
    startTransition(async () => {
      await lockThread(threadId);
      router.refresh();
    });
  };

  const handleToggleFeatured = (threadId: string, currentFeatured: boolean) => {
    startTransition(async () => {
      await featureThread(threadId, !currentFeatured);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>板块</th>
            <th>作者</th>
            <th>状态</th>
            <th>回复</th>
            <th>浏览</th>
            <th>置顶</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => {
            const sb = statusBadgeMap[thread.status] || { cls: 'badge badge-gray', label: thread.status || '--' };
            return (
              <tr key={thread.id}>
                <td className="max-w-[240px]">
                  <p className="truncate text-sm font-medium">{thread.title || '无标题'}</p>
                </td>
                <td className="text-sm text-text-muted">
                  {thread.board_id ? (boardNameMap[thread.board_id] || thread.board_id?.slice(0, 8)) : '--'}
                </td>
                <td className="text-sm text-text-muted">
                  {thread.author_id?.slice(0, 8) || '--'}
                </td>
                <td>
                  <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                </td>
                <td className="text-sm">{thread.reply_count ?? 0}</td>
                <td className="text-sm">{thread.view_count ?? 0}</td>
                <td>
                  <button
                    onClick={() => handleTogglePin(thread.id, !!thread.is_pinned)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 rounded ${thread.is_pinned ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'} hover:opacity-80 disabled:opacity-50`}
                  >
                    {thread.is_pinned ? '已置顶' : '置顶'}
                  </button>
                </td>
                <td className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFeatured(thread.id, !!thread.is_featured)}
                    disabled={isPending}
                    className={`text-xs ${thread.is_featured ? 'text-yellow-600' : 'text-text-muted'} hover:underline disabled:opacity-50`}
                  >
                    {thread.is_featured ? '取消精华' : '精华'}
                  </button>
                  {thread.status !== 'locked' && (
                    <button
                      onClick={() => handleLock(thread.id)}
                      disabled={isPending}
                      className="text-xs text-text-muted hover:underline disabled:opacity-50"
                    >
                      锁定
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(thread.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    删除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
