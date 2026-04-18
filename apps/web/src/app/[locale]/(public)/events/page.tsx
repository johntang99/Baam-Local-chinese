import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Pagination } from '@/components/shared/pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 18; // 3 columns × 6 rows

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('events')} · Baam`,
    description: '纽约本地活动、社区聚会、讲座工作坊',
  };
}

const dateTabs = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
];

interface Props {
  searchParams: Promise<{ page?: string; period?: string; price?: string }>;
}

export default async function EventsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const period = sp.period || 'all';
  const priceFilter = sp.price || '';

  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Build base query conditions
  let countQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('site_id', site.id);

  if (period === 'week') {
    countQuery = countQuery.gte('start_at', now.toISOString()).lte('start_at', weekEnd.toISOString());
  } else if (period === 'month') {
    countQuery = countQuery.gte('start_at', now.toISOString()).lte('start_at', monthEnd.toISOString());
  }

  if (priceFilter === 'free') countQuery = countQuery.eq('is_free', true);
  if (priceFilter === 'paid') countQuery = countQuery.eq('is_free', false);

  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('site_id', site.id);

  if (period === 'week') {
    dataQuery = dataQuery.gte('start_at', now.toISOString()).lte('start_at', weekEnd.toISOString());
  } else if (period === 'month') {
    dataQuery = dataQuery.gte('start_at', now.toISOString()).lte('start_at', monthEnd.toISOString());
  }

  if (priceFilter === 'free') dataQuery = dataQuery.eq('is_free', true);
  if (priceFilter === 'paid') dataQuery = dataQuery.eq('is_free', false);

  const { data: rawEvents, error } = await dataQuery
    .order('start_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const events = (rawEvents || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (period !== 'all') preservedParams.period = period;
  if (priceFilter) preservedParams.price = priceFilter;

  return (
    <main>
      <PageContainer className="py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl fw-bold">本地活动</h1>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateTabs.map((tab) => {
              const params = new URLSearchParams();
              if (tab.key !== 'all') params.set('period', tab.key);
              if (priceFilter) params.set('price', priceFilter);
              const href = params.toString() ? `/events?${params}` : '/events';

              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn('chip flex-shrink-0', period === tab.key && 'active')}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex gap-2 ml-auto">
            {[
              { key: '', label: '全部' },
              { key: 'free', label: '免费' },
              { key: 'paid', label: '付费' },
            ].map((opt) => {
              const params = new URLSearchParams();
              if (period !== 'all') params.set('period', period);
              if (opt.key) params.set('price', opt.key);
              const href = params.toString() ? `/events?${params}` : '/events';

              return (
                <Link
                  key={opt.key}
                  href={href}
                  className={cn('chip flex-shrink-0', priceFilter === opt.key && 'active')}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Events Grid */}
        {error ? (
          <p className="text-text-secondary py-8 text-center">加载活动时出错，请稍后重试。</p>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-text-secondary">暂无活动内容</p>
            <p className="text-text-muted text-sm mt-1">活动将在这里显示</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => {
              const startDate = event.start_at ? new Date(event.start_at) : null;
              const month = startDate ? startDate.toLocaleDateString('zh-CN', { month: 'short' }) : '';
              const day = startDate ? startDate.getDate() : '';
              const timeStr = startDate ? startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
              const isFree = event.is_free || event.price === 0;

              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="block">
                  <Card className="overflow-hidden h-full hover:elev-md transition-shadow">
                    <div className="h-32 bg-gradient-to-br from-primary/30 to-primary/5 relative">
                      <div className="absolute top-3 left-3 bg-bg-card r-lg elev-sm px-2 py-1 text-center">
                        <p className="text-xs text-text-muted leading-tight">{month}</p>
                        <p className="text-lg fw-bold leading-tight">{day}</p>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge className={cn('text-xs', isFree ? 'bg-accent-green-light text-accent-green' : 'bg-accent-purple-light text-accent-purple')}>
                          {isFree ? '免费' : '付费'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="fw-semibold text-sm line-clamp-2 mb-2">{event.title_zh || event.title_en || event.title}</h3>
                      <div className="space-y-1 text-xs text-text-muted">
                        {timeStr && <p>{timeStr}</p>}
                        {(event.venue_name || event.venue) && <p>{event.venue_name || event.venue}</p>}
                      </div>
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
          basePath="/events"
          searchParams={preservedParams}
        />
      </PageContainer>
    </main>
  );
}
