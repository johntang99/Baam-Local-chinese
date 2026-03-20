'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteEvent, toggleFeatured } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadge: Record<string, { cls: string; label: string }> = {
  published: { cls: 'badge badge-green', label: '已发布' },
  draft: { cls: 'badge badge-gray', label: '草稿' },
  cancelled: { cls: 'badge badge-red', label: '已取消' },
};

interface EventsTableProps {
  events: AnyRow[];
  siteParams: string;
}

export default function EventsTable({ events, siteParams }: EventsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这个活动吗？')) return;
    startTransition(async () => {
      await deleteEvent(id);
      router.refresh();
    });
  };

  const handleToggleFeatured = (id: string, featured: boolean) => {
    startTransition(async () => {
      await toggleFeatured(id, featured);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>开始时间</th>
            <th>场馆</th>
            <th>状态</th>
            <th>推荐</th>
            <th>浏览量</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center text-text-muted py-8">该站点暂无活动</td>
            </tr>
          ) : (
            events.map((event) => {
              const sb = statusBadge[event.status] || { cls: 'badge badge-blue', label: event.status || '—' };
              return (
                <tr key={event.id}>
                  <td className="max-w-xs">
                    <p className="font-medium truncate">{event.title_zh || event.title_en || '无标题'}</p>
                  </td>
                  <td className="text-text-secondary text-sm">
                    {event.start_at
                      ? new Date(event.start_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="text-text-secondary">{event.venue_name || '—'}</td>
                  <td>
                    <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleFeatured(event.id, !event.is_featured)}
                      disabled={isPending}
                      className={`badge ${event.is_featured ? 'badge-purple' : 'badge-gray'} text-xs cursor-pointer hover:opacity-80 disabled:opacity-50`}
                    >
                      {event.is_featured ? '推荐' : '—'}
                    </button>
                  </td>
                  <td className="text-text-muted">{event.view_count ?? 0}</td>
                  <td className="flex items-center gap-2">
                    <Link
                      href={`/admin/events/${event.id}/edit${siteParams ? `?${siteParams}` : ''}`}
                      className="text-xs text-primary hover:underline"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
