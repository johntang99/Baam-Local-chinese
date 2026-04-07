import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import { PageContainer } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: '分类信息 · Baam',
  description: '纽约华人社区分类信息 — 租房、求职、二手、服务',
};

const categoryTabs = [
  { key: '', label: '全部' },
  { key: 'housing_rent', label: '租房' },
  { key: 'housing_buy', label: '房产' },
  { key: 'jobs', label: '招聘求职' },
  { key: 'secondhand', label: '二手转让' },
  { key: 'services', label: '生活服务' },
  { key: 'events', label: '活动' },
  { key: 'general', label: '其他' },
];

const categoryLabels: Record<string, string> = {
  housing_rent: '租房', housing_buy: '房产', jobs: '招聘求职',
  secondhand: '二手转让', services: '生活服务', events: '活动', general: '其他',
};

interface Props {
  searchParams: Promise<{ page?: string; cat?: string }>;
}

export default async function ClassifiedsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeCat = sp.cat || '';

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Count
  let countQuery = (supabase as any)
    .from('classifieds')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('site_id', site.id);
  if (activeCat) countQuery = countQuery.eq('category', activeCat);

  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch
  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = (supabase as any)
    .from('classifieds')
    .select('*')
    .eq('status', 'active')
    .eq('site_id', site.id);
  if (activeCat) dataQuery = dataQuery.eq('category', activeCat);

  const { data: rawItems } = await dataQuery
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const items = (rawItems || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (activeCat) preservedParams.cat = activeCat;

  return (
    <main>
      <PageContainer className="py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">分类信息</h1>
          <Link href="/classifieds/new" className={cn(buttonVariants({ size: 'sm' }), 'h-9 px-4 text-sm')}>发布信息</Link>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {categoryTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key ? `/classifieds?cat=${tab.key}` : '/classifieds'}
              className={cn(buttonVariants({ size: 'sm' }), 'rounded-full whitespace-nowrap', `${
                activeCat === tab.key
                  ? 'bg-primary text-text-inverse'
                  : 'bg-border-light text-text-secondary hover:bg-gray-200'
              }`)}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-text-secondary">暂无分类信息</p>
            <p className="text-text-muted text-sm mt-1">发布第一条信息吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const timeAgo = formatTimeAgo(item.created_at);
              const catLabel = categoryLabels[item.category] || '其他';
              return (
                <Link key={item.id} href={`/classifieds/${item.slug}`} className="block">
                  <Card className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.is_featured && <Badge className="text-xs bg-red-100 text-red-700">置顶</Badge>}
                        <Badge variant="muted" className="text-xs">{catLabel}</Badge>
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-1 mb-1">{item.title}</h3>
                      {item.body && (
                        <p className="text-xs text-text-secondary line-clamp-2">{item.body}</p>
                      )}
                    </div>
                    {item.price_text && (
                      <span className="text-sm font-bold text-primary flex-shrink-0">{item.price_text}</span>
                    )}
                  </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/classifieds"
          searchParams={preservedParams}
        />
      </PageContainer>
    </main>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
