import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import { PendingQueue, ThreadsTable } from './ForumTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const mainTabs = [
  { key: 'pending', label: '审核队列' },
  { key: 'all', label: '全部帖子' },
  { key: 'boards', label: '版块管理' },
];

export default async function AdminForumPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Resolve tab
  const tab = typeof params.tab === 'string' ? params.tab : 'pending';

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

  // Build base URL for filter links
  const baseParams = new URLSearchParams();
  if (params.region) baseParams.set('region', String(params.region));
  if (params.locale) baseParams.set('locale', String(params.locale));

  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams(baseParams);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!('tab' in overrides) && tab !== 'pending') p.set('tab', tab);
    return `/admin/forum?${p.toString()}`;
  }

  // Fetch pending count for badge
  const { count: pendingCount } = await supabase
    .from('forum_threads')
    .select('*', { count: 'exact', head: true })
    .in('region_id', ctx.regionIds)
    .or('status.eq.pending,ai_spam_score.gt.0.7');

  // Fetch board/category names for display
  const { data: rawBoards } = await supabase
    .from('categories')
    .select('id, name_zh, name, slug, description, type')
    .eq('type', 'forum')
    .order('sort_order', { ascending: true });
  const boards = (rawBoards || []) as AnyRow[];
  const boardNameMap: Record<string, string> = {};
  boards.forEach((b: AnyRow) => {
    boardNameMap[b.id] = b.name_zh || b.name || b.slug;
  });

  // Fetch data based on tab
  let pendingThreads: AnyRow[] = [];
  let allThreads: AnyRow[] = [];
  let totalCount = 0;

  if (tab === 'pending') {
    const { data: rawPending } = await supabase
      .from('forum_threads')
      .select('*')
      .in('region_id', ctx.regionIds)
      .or('status.eq.pending,ai_spam_score.gt.0.7')
      .order('created_at', { ascending: false })
      .limit(50);
    pendingThreads = (rawPending || []) as AnyRow[];
  } else if (tab === 'all') {
    const from = (page - 1) * pageSize;

    const { data: rawAll, count } = await supabase
      .from('forum_threads')
      .select('*', { count: 'exact' })
      .in('region_id', ctx.regionIds)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    allThreads = (rawAll || []) as AnyRow[];
    totalCount = count ?? allThreads.length;
  }
  // For 'boards' tab, we use the boards array fetched above

  // Get post counts per board for boards tab
  let boardPostCounts: Record<string, number> = {};
  if (tab === 'boards' && boards.length > 0) {
    // Get counts by querying threads grouped by board_id
    for (const board of boards) {
      const { count } = await supabase
        .from('forum_threads')
        .select('*', { count: 'exact', head: true })
        .eq('board_id', board.id)
        .in('region_id', ctx.regionIds);
      boardPostCounts[board.id] = count ?? 0;
    }
  }

  const from = (page - 1) * pageSize;

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
          {mainTabs.map((t) => (
            <Link
              key={t.key}
              href={filterUrl({ tab: t.key === 'pending' ? '' : t.key, page: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.key === 'pending' && (pendingCount || 0) > 0 && (
                <span className="ml-1 badge badge-red text-xs">{pendingCount}</span>
              )}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'pending' && (
          <PendingQueue threads={pendingThreads} />
        )}

        {tab === 'all' && (
          <>
            {allThreads.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-text-muted">该站点暂无帖子</p>
              </div>
            ) : (
              <ThreadsTable threads={allThreads} boardNameMap={boardNameMap} />
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>
                显示 {from + 1}-{Math.min(from + allThreads.length, totalCount)} / 共 {totalCount} 条
              </span>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={filterUrl({ page: String(page - 1) })}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
                  >
                    上一页
                  </Link>
                )}
                {from + pageSize < totalCount && (
                  <Link
                    href={filterUrl({ page: String(page + 1) })}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
                  >
                    下一页
                  </Link>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'boards' && (
          <div className="space-y-4">
            {boards.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-text-muted">暂无论坛版块</p>
                <p className="text-sm text-text-muted mt-1">在分类管理中添加type为forum的分类作为版块</p>
              </div>
            ) : (
              <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>版块名称</th>
                      <th>描述</th>
                      <th>帖子数</th>
                      <th>Slug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((board) => (
                      <tr key={board.id}>
                        <td className="text-sm font-medium">{board.name_zh || board.name || board.slug}</td>
                        <td className="text-sm text-text-muted max-w-xs truncate">{board.description || '--'}</td>
                        <td className="text-sm">{boardPostCounts[board.id] ?? 0}</td>
                        <td className="text-xs text-text-muted">{board.slug || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
