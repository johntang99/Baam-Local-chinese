import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('articles')
    .select('title_zh, title_en, ai_summary_zh, summary_zh, cover_image_url')
    .eq('slug', slug)
    .single();

  const article = data as AnyRow | null;
  if (!article) return { title: 'Not Found' };

  return {
    title: `${article.title_zh || article.title_en} · Baam`,
    description: article.ai_summary_zh || article.summary_zh || '',
    openGraph: {
      title: article.title_zh || article.title_en || '',
      description: article.ai_summary_zh || article.summary_zh || '',
      images: article.cover_image_url ? [article.cover_image_url] : [],
    },
  };
}

const verticalConfig: Record<string, { label: string; className: string }> = {
  news_alert: { label: '快报', className: 'badge-red' },
  news_brief: { label: '简报', className: 'badge-blue' },
  news_explainer: { label: '政策解读', className: 'badge-purple' },
  news_roundup: { label: '周度汇总', className: 'badge-primary' },
  news_community: { label: '社区新闻', className: 'badge-green' },
};

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch article
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('editorial_status', 'published')
    .single();

  const article = data as AnyRow | null;
  if (error || !article) notFound();

  // TODO: Increment view count via API route or server action

  const vertical = verticalConfig[article.content_vertical] || { label: '新闻', className: 'badge-gray' };
  const title = article.title_zh || article.title_en;
  const body = article.body_zh || article.body_en;
  const summary = article.ai_summary_zh || article.summary_zh;
  const keyFacts = article.ai_key_facts as Record<string, string> | null;
  const faq = article.ai_faq as Array<{ q: string; a: string }> | null;

  // Fetch related guides
  const { data: rawGuides } = await supabase
    .from('articles')
    .select('*')
    .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison'])
    .eq('editorial_status', 'published')
    .limit(3);

  const relatedGuides = (rawGuides || []) as AnyRow[];

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:flex gap-8">
          {/* Main Content */}
          <article className="flex-1 max-w-[var(--content-max)]">
            {/* Breadcrumb */}
            <nav className="text-sm text-text-muted mb-4">
              <Link href="/" className="hover:text-primary">首页</Link>
              <span className="mx-2">›</span>
              <Link href="/news" className="hover:text-primary">新闻</Link>
              <span className="mx-2">›</span>
              <span className="text-text-secondary">{title}</span>
            </nav>

            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge ${vertical.className}`}>{vertical.label}</span>
                {article.source_type && (
                  <span className="text-xs text-text-muted bg-border-light px-2 py-0.5 rounded">
                    {article.source_type === 'official_gov' ? 'A类来源' : '来源'} · {article.source_name}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">{title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                {article.published_at && (
                  <time>{new Date(article.published_at).toLocaleDateString('zh-CN', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}</time>
                )}
                {article.last_reviewed_at && (
                  <span>最后审核：{new Date(article.last_reviewed_at).toLocaleDateString('zh-CN')}</span>
                )}
                {article.region_id && (
                  <span className="bg-border-light px-2 py-0.5 rounded">
                    纽约
                  </span>
                )}
                <span>{article.view_count || 0} 浏览</span>
              </div>
            </header>

            {/* AI Summary */}
            {summary && (
              <div className="ai-summary-card mb-6">
                <p className="text-sm text-secondary-dark leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Key Facts (for alerts/explainers) */}
            {keyFacts && Object.keys(keyFacts).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {Object.entries(keyFacts).map(([key, value]) => (
                  <div key={key} className="bg-bg-page border border-border rounded-lg p-3 text-center">
                    <p className="text-xs text-text-muted mb-1">{key}</p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Article Body */}
            {body && (
              <div className="prose prose-sm max-w-none mb-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-text-primary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            )}

            {/* Source Attribution */}
            {article.source_url && (
              <div className="flex items-center gap-2 p-4 bg-accent-green-light/30 border border-accent-green/20 rounded-lg mb-8">
                <span className="text-accent-green text-lg">🛡️</span>
                <div>
                  <p className="text-xs text-text-muted">
                    {article.source_type === 'official_gov' ? 'A类官方来源' : '来源'}
                  </p>
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    {article.source_name || article.source_url} ↗
                  </a>
                </div>
              </div>
            )}

            {/* Share */}
            <div className="flex items-center gap-3 py-4 border-t border-border">
              <span className="text-sm text-text-secondary">分享：</span>
              <button className="btn btn-outline h-8 px-3 text-xs">微信</button>
              <button className="btn btn-outline h-8 px-3 text-xs">Facebook</button>
              <button className="btn btn-outline h-8 px-3 text-xs">复制链接</button>
            </div>

            {/* Related Guides */}
            {relatedGuides && relatedGuides.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4">📚 相关生活指南</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedGuides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="card p-4 block">
                      <h3 className="font-medium text-sm line-clamp-2">{guide.title_zh}</h3>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            {/* Newsletter */}
            <div className="bg-bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">📬 订阅本地周报</h3>
              <p className="text-xs text-text-secondary mb-3">每周精选本地新闻、指南、活动</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="输入邮箱"
                  className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <button className="btn btn-primary h-9 px-4 text-sm">订阅</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
