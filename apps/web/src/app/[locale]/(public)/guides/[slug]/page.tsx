import { createClient } from '@/lib/supabase/server';
import { decodeRouteSlug } from '@/lib/slug';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { LeadForm } from '@/components/shared/lead-form';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { pickBusinessDisplayName } from '@/lib/business-name';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const supabase = await createClient();
  const site = await getCurrentSite();
  const { data } = await supabase
    .from('articles')
    .select('title_zh, title_en, ai_summary_zh, summary_zh, seo_title_zh, seo_desc_zh, cover_image_url')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .single();

  const article = data as AnyRow | null;
  if (!article) return { title: 'Not Found' };

  const title = article.seo_title_zh || article.title_zh || article.title_en || '';
  const description = article.seo_desc_zh || article.ai_summary_zh || article.summary_zh || '';
  return {
    title: `${title} · Baam`,
    description,
    alternates: {
      canonical: `/${locale}/guides/${encodeURIComponent(slug)}`,
    },
    openGraph: {
      title,
      description,
      images: article.cover_image_url ? [article.cover_image_url] : [],
    },
    twitter: {
      title,
      description,
      images: article.cover_image_url ? [article.cover_image_url] : [],
      card: 'summary_large_image',
    },
  };
}

// Badge color mapping for guide content verticals
const verticalConfig: Record<string, { label: string; className: string }> = {
  guide_howto: { label: 'How-To', className: 'bg-blue-100 text-blue-700' },
  guide_checklist: { label: 'Checklist', className: 'bg-green-100 text-green-700' },
  guide_bestof: { label: 'Best-of', className: 'bg-green-100 text-green-700' },
  guide_comparison: { label: '对比', className: 'bg-purple-100 text-purple-700' },
  guide_neighborhood: { label: '社区', className: 'bg-primary-100 text-primary-700' },
  guide_seasonal: { label: '时令', className: 'bg-red-100 text-red-700' },
  guide_resource: { label: '资源', className: 'bg-blue-100 text-blue-700' },
  guide_scenario: { label: '场景', className: 'bg-purple-100 text-purple-700' },
};

export default async function GuideDetailPage({ params }: Props) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch guide article
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .eq('editorial_status', 'published')
    .single();

  const article = data as AnyRow | null;
  if (error || !article) notFound();

  const vertical = verticalConfig[article.content_vertical] || { label: '指南', className: 'bg-gray-100 text-gray-700' };
  const title = article.title_zh || article.title_en;
  const body = article.body_zh || article.body_en;
  const summary = article.ai_summary_zh || article.summary_zh;
  const faq = article.ai_faq as Array<{ q: string; a: string }> | null;
  const audienceTags = (article.audience_tags || []) as string[];
  const { data: rawCategory } = await supabase
    .from('categories_guide')
    .select('id, name_zh, name_en, slug, icon')
    .eq('id', article.category_id)
    .single();
  const category = (rawCategory || null) as AnyRow | null;

  // Fetch linked businesses via guide_business_links join table
  const { data: rawLinks } = await supabase
    .from('guide_business_links')
    .select('*, businesses(*)')
    .eq('article_id', article.id);

  const businessLinks = (rawLinks || []) as AnyRow[];

  // Fetch related news articles (same category, limit 3)
  const { data: rawRelated } = await supabase
    .from('articles')
    .select('id, slug, title_zh, title_en, content_vertical, published_at')
    .eq('site_id', site.id)
    .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
    .eq('editorial_status', 'published')
    .neq('id', article.id)
    .order('published_at', { ascending: false })
    .limit(3);

  const relatedNews = (rawRelated || []) as AnyRow[];

  // Fetch related forum threads (experience sharing)
  let relatedThreads: AnyRow[] = [];
  if (audienceTags.length > 0) {
    const { data: rawThreads } = await supabase
      .from('forum_threads')
      .select('id, slug, title_zh, title, reply_count, ai_summary_zh, board_id')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .overlaps('ai_tags', audienceTags)
      .order('reply_count', { ascending: false })
      .limit(3);
    relatedThreads = (rawThreads || []) as AnyRow[];
  }
  const threadBoardIds = Array.from(new Set(relatedThreads.map((t) => t.board_id).filter(Boolean)));
  let boardSlugMap: Record<string, string> = {};
  if (threadBoardIds.length > 0) {
    const { data: rawBoards } = await supabase
      .from('categories_forum')
      .select('id, slug')
      .in('id', threadBoardIds);
    boardSlugMap = Object.fromEntries(((rawBoards || []) as AnyRow[]).map((b) => [String(b.id), String(b.slug)]));
  }

  // Fetch related discover posts (matching audience_tags or topic_tags)
  let discoverPosts: AnyRow[] = [];
  if (audienceTags.length > 0) {
    const { data: rawDiscover } = await supabase
      .from('voice_posts')
      .select('id, slug, title, cover_images, cover_image_url, like_count, profiles!voice_posts_author_id_fkey(display_name)')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .overlaps('topic_tags', audienceTags)
      .order('like_count', { ascending: false })
      .limit(6);
    discoverPosts = (rawDiscover || []) as AnyRow[];
  }

  // Check if this is medical/legal content that needs update timestamp
  const isSensitiveContent = article.content_vertical === 'guide_howto' && (
    (article.title_zh && (article.title_zh.includes('医') || article.title_zh.includes('法律') || article.title_zh.includes('保险') || article.title_zh.includes('白卡'))) ||
    (article.title_en && (article.title_en.toLowerCase().includes('medical') || article.title_en.toLowerCase().includes('legal') || article.title_en.toLowerCase().includes('insurance')))
  );
  const headings = body ? extractHeadings(body) : [];
  const headingUsedCount = new Map<string, number>();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://baam.us';
  const canonicalUrl = `${baseUrl}/${locale}/guides/${encodeURIComponent(slug)}`;
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary || '',
    datePublished: article.published_at || article.created_at || undefined,
    dateModified: article.updated_at || article.published_at || article.created_at || undefined,
    author: {
      '@type': 'Organization',
      name: 'Baam Editorial Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Baam',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/icon.png`,
      },
    },
    mainEntityOfPage: canonicalUrl,
    image: article.cover_image_url ? [article.cover_image_url] : undefined,
  };
  const faqJsonLd = faq && faq.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq
          .filter((item) => item?.q && item?.a)
          .map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
      }
    : null;
  const markdownHeadingComponents: Components = {
    h2: ({ children, ...props }) => {
      const text = String(children ?? '');
      const base = slugifyHeading(text) || 'section';
      const count = headingUsedCount.get(base) || 0;
      headingUsedCount.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      return <h2 {...props} id={id} className="text-lg font-bold mt-8 mb-3 scroll-mt-24">{children}</h2>;
    },
    h3: ({ children, ...props }) => {
      const text = String(children ?? '');
      const base = slugifyHeading(text) || 'section';
      const count = headingUsedCount.get(base) || 0;
      headingUsedCount.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      return <h3 {...props} id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-24">{children}</h3>;
    },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && faqJsonLd.mainEntity.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <PageContainer className="py-3">
        <nav className="flex items-center gap-1.5 text-sm text-text-muted overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-primary transition">首页</Link>
          <span>›</span>
          <Link href="/guides" className="hover:text-primary transition">生活资讯</Link>
          {category && (
            <>
              <span>›</span>
              <Link href={`/guides?cat=${category.slug}`} className="hover:text-primary transition">
                {category.name_zh || category.name_en}
              </Link>
            </>
          )}
          <span>›</span>
          <span className="text-text-primary font-medium truncate">{title}</span>
        </nav>
      </PageContainer>

      <PageContainer className="pb-16">
        <div className="lg:flex gap-8">

          {/* Main Content */}
          <article className="flex-1 max-w-[var(--content-max)]">
            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={vertical.className}>{vertical.label}</Badge>
                {category && <Badge variant="muted">{category.name_zh || category.name_en}</Badge>}
                {audienceTags.map((tag) => (
                  <span key={tag} className="text-xs text-text-muted bg-border-light px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">{title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                {article.published_at && (
                  <time>{new Date(article.published_at).toLocaleDateString('zh-CN', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}</time>
                )}
                <span>约 {Math.max(3, Math.ceil(String(body || '').length / 700))} 分钟阅读</span>
                {article.region_id && (
                  <span className="bg-border-light px-2 py-0.5 rounded">纽约</span>
                )}
                <span>{article.view_count || 0} 浏览</span>
              </div>
            </header>

            {/* Cover Image */}
            {article.cover_image_url && (
              <div className="mb-6 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img
                  src={article.cover_image_url}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Source Attribution (for business_website articles) */}
            {(article.source_type === 'business_website' || article.source_type === 'business_post') && (article.source_name || article.source_url) && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800">
                    本文来源：{article.source_name || '商家供稿'}
                  </p>
                  {article.source_url && (
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate block"
                    >
                      查看原文 →{' '}
                      {article.source_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Medical/Legal Content Update Notice */}
            {isSensitiveContent && article.last_reviewed_at && (
              <div className="flex items-center gap-2 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg mb-6">
                <span className="text-lg">⚠️</span>
                <p className="text-xs text-text-secondary">
                  本文涉及医疗/法律信息，最后审核更新于{' '}
                  <strong>{new Date(article.last_reviewed_at).toLocaleDateString('zh-CN')}</strong>。
                  请注意政策可能已变更，建议咨询专业人士。
                </p>
              </div>
            )}

            {/* AI Summary */}
            {summary && (
              <div className="mb-8">
                <div className="relative bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 bg-blue-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      AI摘要
                    </span>
                    <span className="text-xs text-blue-400">由 Baam AI 自动生成</span>
                  </div>
                  <p className="text-sm text-blue-900 leading-relaxed">{summary}</p>
                </div>
              </div>
            )}

            {/* Article Body */}
            {body && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8 mb-8">
                <div className="prose prose-sm max-w-none [&_p]:text-text-primary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_table]:w-full [&_table]:border-collapse [&_th]:bg-bg-page [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownHeadingComponents}>
                    {body}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* FAQ Section */}
            {faq && faq.length > 0 && (
              <section className="mb-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>❓</span> 常见问题
                </h2>
                <div className="divide-y divide-gray-100">
                  {faq.map((item, idx) => (
                    <details
                      key={idx}
                      className="group"
                    >
                      <summary className="py-4 cursor-pointer text-sm font-semibold text-text-primary hover:text-primary transition list-none flex items-center justify-between">
                        <span>{item.q}</span>
                        <svg className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="pb-4 text-sm text-text-secondary leading-relaxed">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
                </div>
              </section>
            )}

            {/* Business Recommendations */}
            {businessLinks.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>🏪</span> 推荐商家
                </h2>
                <div className="space-y-3">
                  {businessLinks.map((link) => {
                    const biz = link.businesses as AnyRow | null;
                    if (!biz) return null;
                    return (
                      <Card key={link.id} className="flex items-start gap-4 p-5">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex-shrink-0 flex items-center justify-center text-xl">
                          🏪
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base truncate">{pickBusinessDisplayName(biz)}</h4>
                            {biz.is_verified && (
                              <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          {biz.avg_rating && (
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-yellow-500 text-xs">{'★'.repeat(Math.round(biz.avg_rating))}</span>
                              <span className="text-xs text-gray-400">{biz.avg_rating} ({biz.review_count || 0}评价)</span>
                            </div>
                          )}
                          {biz.tags && Array.isArray(biz.tags) && (
                            <div className="flex flex-wrap gap-1.5">
                              {biz.tags.slice(0, 3).map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="px-2 py-0.5">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 self-center">
                          <Link
                            href={`/businesses/${biz.slug || biz.id}`}
                            className={cn(buttonVariants({ size: 'lg' }), 'h-auto py-2')}
                          >
                            联系咨询
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lead Capture Form */}
            <section id="lead-form" className="mb-8">
              <div className="bg-gradient-to-br from-primary to-orange-600 rounded-xl p-6 sm:p-8 text-white">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">告诉我们你的需求，为你匹配服务</h2>
                <p className="text-orange-100 text-sm mb-6">
                  填写以下信息，我们会优先为你匹配合适的本地服务资源。
                </p>
                <LeadForm sourceType="guide" sourceArticleId={article.id} />
              </div>
            </section>

            {/* Forum Threads */}
            {relatedThreads.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>💬</span> 其他人的真实经验
                </h2>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {relatedThreads.map((thread) => (
                    <Link
                      key={thread.id}
                      href={`/forum/${boardSlugMap[String(thread.board_id)] || 'general'}/${thread.slug}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium truncate mb-1">{thread.title_zh || thread.title}</h3>
                        {thread.ai_summary_zh && (
                          <p className="text-xs text-gray-400 line-clamp-1">AI摘要：{thread.ai_summary_zh}</p>
                        )}
                      </div>
                      <div className="text-center flex-shrink-0">
                        <p className="text-sm font-bold text-primary">{thread.reply_count || 0}</p>
                        <p className="text-xs text-gray-400">回复</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Separator className="my-4" />

            {/* Share */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
              <div className="text-xs text-text-muted">内容由编辑团队持续更新，政策信息请以官方发布为准。</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted mr-1">分享：</span>
                <button className="text-xs text-text-secondary bg-border-light px-3 py-1.5 rounded-full hover:bg-gray-200">微信</button>
                <button className="text-xs text-text-secondary bg-border-light px-3 py-1.5 rounded-full hover:bg-gray-200">Facebook</button>
                <button className="text-xs text-text-secondary bg-border-light px-3 py-1.5 rounded-full hover:bg-gray-200">复制链接</button>
              </div>
            </div>

            {/* Related News */}
            {relatedNews.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📰</span> 相关新闻
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {relatedNews.map((news) => (
                    <Link key={news.id} href={`/news/${news.slug}`} className="block cursor-pointer">
                      <Card className="p-5 h-full hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">资讯</Badge>
                        {news.published_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(news.published_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold mb-1 line-clamp-2 leading-relaxed">{news.title_zh || news.title_en}</h3>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related Discover Posts (相关笔记) */}
            {discoverPosts.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📝</span> 相关笔记
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                  {discoverPosts.map((post, i) => {
                    const coverImage = post.cover_images?.[0] || post.cover_image_url;
                    const authorName = post.profiles?.display_name || '匿名';
                    const gradients = ['from-rose-200 to-pink-100', 'from-emerald-200 to-teal-100', 'from-violet-200 to-purple-100', 'from-sky-200 to-blue-100'];
                    return (
                      <Link key={post.id} href={`/discover/${post.slug || post.id}`} className="group">
                        <Card className="overflow-hidden hover:shadow-md transition-shadow">
                          <div className="aspect-[4/3] overflow-hidden">
                            {coverImage ? (
                              <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                                <span className="text-white/50 text-xl font-bold">{post.title?.[0] || '📝'}</span>
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 leading-relaxed">{post.title}</h3>
                            <span className="text-xs text-gray-400">{authorName}</span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </article>

          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">

            {/* Sticky TOC (placeholder) */}
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                  </svg>
                  目录
                </h3>
                <nav className="space-y-2">
                  {headings.length > 0 ? headings.map((heading, idx) => (
                    <a
                      key={idx}
                      href={`#${heading.id}`}
                      className={`block text-sm hover:text-primary transition ${
                        heading.level === 2 ? 'text-text-primary font-medium' : 'text-text-muted pl-3'
                      }`}
                    >
                      {heading.text}
                    </a>
                  )) : (
                    <p className="text-xs text-text-muted">暂无目录</p>
                  )}
                </nav>
              </div>

              <div className="bg-gradient-to-br from-primary-50 to-orange-50 border border-primary-200 rounded-xl p-5">
                <p className="text-sm font-bold text-text-primary mb-2">需要帮忙匹配服务？</p>
                <p className="text-xs text-text-secondary mb-3">提交你的需求，我们会优先帮你匹配适合的本地资源。</p>
                <a href="#lead-form" className="block text-center bg-primary text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition">
                  提交匹配需求
                </a>
              </div>
            </div>
          </aside>

        </div>
      </PageContainer>
    </main>
  );
}

/** Extract h2/h3 headings from markdown text for TOC */
function extractHeadings(markdown: string): Array<{ level: number; text: string; id: string }> {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const lines = markdown.split('\n');
  const idCount = new Map<string, number>();
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const text = match[2].replace(/[*_`#]/g, '').trim();
      const base = slugifyHeading(text) || 'section';
      const count = idCount.get(base) || 0;
      idCount.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      headings.push({
        level: match[1].length,
        text,
        id,
      });
    }
  }
  return headings.slice(0, 10); // Limit to 10 headings
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
