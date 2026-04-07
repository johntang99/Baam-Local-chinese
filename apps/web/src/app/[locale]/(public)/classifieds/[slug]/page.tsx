import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const categoryLabels: Record<string, string> = {
  housing_rent: '租房', housing_buy: '房产', jobs: '招聘求职',
  secondhand: '二手转让', services: '生活服务', events: '活动', general: '其他',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('classifieds').select('title').eq('slug', slug).eq('site_id', site.id).single();
  return { title: data ? `${data.title} · 分类信息 · Baam` : 'Not Found' };
}

export default async function ClassifiedDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('classifieds').select('*').eq('slug', slug).eq('site_id', site.id).single();

  const item = data as AnyRow | null;
  if (error || !item) notFound();

  const catLabel = categoryLabels[item.category] || '其他';
  const postedDate = new Date(item.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const expiresDate = item.expires_at
    ? new Date(item.expires_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : null;

  return (
    <main>
      <PageContainer className="max-w-3xl py-6">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/classifieds" className="hover:text-primary">分类信息</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">{catLabel}</span>
        </nav>

        <Card className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="muted">{catLabel}</Badge>
            {item.is_featured && <Badge className="bg-red-100 text-red-700">置顶</Badge>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-4">{item.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-text-muted mb-6 pb-6 border-b border-border">
            <span>发布于 {postedDate}</span>
            {expiresDate && <span>有效期至 {expiresDate}</span>}
            <span>浏览 {item.view_count || 0} 次</span>
          </div>

          {/* Price */}
          {item.price_text && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <span className="text-sm text-text-muted">价格：</span>
              <span className="text-lg font-bold text-primary ml-1">{item.price_text}</span>
            </div>
          )}

          {/* Body */}
          {item.body && (
            <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap mb-8">
              {item.body}
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-bg-page rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">联系方式</h3>
            <div className="space-y-2 text-sm">
              {item.contact_name && <p><span className="text-text-muted">联系人：</span>{item.contact_name}</p>}
              {item.contact_phone && (
                <p>
                  <span className="text-text-muted">电话：</span>
                  <a href={`tel:${item.contact_phone}`} className="text-primary hover:underline">{item.contact_phone}</a>
                </p>
              )}
              {item.contact_email && (
                <p>
                  <span className="text-text-muted">邮箱：</span>
                  <a href={`mailto:${item.contact_email}`} className="text-primary hover:underline">{item.contact_email}</a>
                </p>
              )}
              {item.contact_wechat && <p><span className="text-text-muted">微信：</span>{item.contact_wechat}</p>}
            </div>
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}
