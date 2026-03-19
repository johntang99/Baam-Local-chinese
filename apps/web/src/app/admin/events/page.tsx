import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const { data: rawEvents } = await supabase
    .from('events')
    .select('*')
    .order('start_at', { ascending: false })
    .limit(30);
  const events = (rawEvents || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">活动管理</h1>
            <p className="text-sm text-text-muted">Admin / Events</p>
          </div>
          <Link href="/admin/events/new" className="btn btn-primary h-9 px-4 text-sm">
            添加活动
          </Link>
        </div>
      </div>

      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>开始时间</th>
                  <th>场馆</th>
                  <th>状态</th>
                  <th>推荐</th>
                  <th>浏览量</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-text-muted py-8">暂无活动</td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id}>
                      <td className="font-medium">
                        <Link href={`/admin/events/${event.id}`} className="hover:text-primary">
                          {event.title_zh || event.title_en || '无标题'}
                        </Link>
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
                        <span className={`badge ${
                          event.status === 'published' ? 'badge-green' :
                          event.status === 'draft' ? 'badge-gray' :
                          event.status === 'cancelled' ? 'badge-red' : 'badge-blue'
                        }`}>
                          {event.status || '—'}
                        </span>
                      </td>
                      <td>
                        {event.is_featured ? (
                          <span className="badge badge-purple">推荐</span>
                        ) : (
                          <span className="text-text-muted text-sm">—</span>
                        )}
                      </td>
                      <td className="text-text-muted">{event.view_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
