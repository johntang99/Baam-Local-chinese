import { createClient } from '@/lib/supabase/server';
import { decodeRouteSlug } from '@/lib/slug';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { EditorialContainer } from '@/components/editorial/container';
import { EditorialCard } from '@/components/editorial/card';
import { LeadForm } from '@/components/shared/lead-form';
import { pickBusinessDisplayName } from '@/lib/business-name';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrowsingTracker } from '@/components/shared/browsing-tracker';
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
    alternates: { canonical: `/${locale}/guides/${encodeURIComponent(slug)}` },
    openGraph: { title, description, images: article.cover_image_url ? [article.cover_image_url] : [] },
    twitter: { title, description, images: article.cover_image_url ? [article.cover_image_url] : [], card: 'summary_large_image' },
  };
}

const verticalConfig: Record<string, { label: string; bg: string; color: string }> = {
  guide_howto: { label: 'How-To', bg: 'var(--ed-ink)', color: 'var(--ed-paper)' },
  guide_checklist: { label: 'Checklist', bg: 'var(--ed-tag-green-bg)', color: 'var(--ed-tag-green-text)' },
  guide_bestof: { label: 'Best-of', bg: 'var(--ed-tag-green-bg)', color: 'var(--ed-tag-green-text)' },
  guide_comparison: { label: '对比', bg: 'var(--ed-tag-purple-bg)', color: 'var(--ed-tag-purple-text)' },
  guide_neighborhood: { label: '社区', bg: 'var(--ed-amber)', color: 'var(--ed-ink)' },
  guide_seasonal: { label: '时令', bg: 'var(--ed-accent)', color: 'var(--ed-paper)' },
  guide_resource: { label: '资源', bg: 'var(--ed-ink)', color: 'var(--ed-paper)' },
  guide_scenario: { label: '场景', bg: 'var(--ed-tag-purple-bg)', color: 'var(--ed-tag-purple-text)' },
};

export default async function GuideDetailPage({ params }: Props) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const supabase = await createClient();
  const site = await getCurrentSite();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .eq('editorial_status', 'published')
    .single();

  const article = data as AnyRow | null;
  if (error || !article) notFound();

  const vertical = verticalConfig[article.content_vertical] || verticalConfig.guide_howto;
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

  // Business links
  const { data: rawLinks } = await supabase
    .from('guide_business_links')
    .select('*, businesses(*)')
    .eq('article_id', article.id);
  const businessLinks = (rawLinks || []) as AnyRow[];

  // Related news
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

  // Forum threads
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
    const { data: rawBoards } = await supabase.from('categories_forum').select('id, slug').in('id', threadBoardIds);
    boardSlugMap = Object.fromEntries(((rawBoards || []) as AnyRow[]).map((b) => [String(b.id), String(b.slug)]));
  }

  // Discover posts
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

  const isSensitiveContent = article.content_vertical === 'guide_howto' && (
    (article.title_zh && (article.title_zh.includes('医') || article.title_zh.includes('法律') || article.title_zh.includes('保险') || article.title_zh.includes('白卡'))) ||
    (article.title_en && (article.title_en.toLowerCase().includes('medical') || article.title_en.toLowerCase().includes('legal') || article.title_en.toLowerCase().includes('insurance')))
  );

  const headings = body ? extractHeadings(body) : [];
  const headingUsedCount = new Map<string, number>();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://baam.us';
  const canonicalUrl = `${baseUrl}/${locale}/guides/${encodeURIComponent(slug)}`;

  const articleJsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: title, description: summary || '',
    datePublished: article.published_at || article.created_at || undefined,
    dateModified: article.updated_at || article.published_at || article.created_at || undefined,
    author: { '@type': 'Organization', name: 'Baam Editorial Team' },
    publisher: { '@type': 'Organization', name: 'Baam', logo: { '@type': 'ImageObject', url: `${baseUrl}/icon.png` } },
    mainEntityOfPage: canonicalUrl,
    image: article.cover_image_url ? [article.cover_image_url] : undefined,
  };
  const faqJsonLd = faq && faq.length > 0
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.filter((item) => item?.q && item?.a).map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }
    : null;

  const markdownHeadingComponents: Components = {
    h2: ({ children, ...props }) => {
      const text = String(children ?? '');
      const base = slugifyHeading(text) || 'section';
      const count = headingUsedCount.get(base) || 0;
      headingUsedCount.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      return <h2 {...props} id={id}>{children}</h2>;
    },
    h3: ({ children, ...props }) => {
      const text = String(children ?? '');
      const base = slugifyHeading(text) || 'section';
      const count = headingUsedCount.get(base) || 0;
      headingUsedCount.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      return <h3 {...props} id={id}>{children}</h3>;
    },
  };

  return (
    <main>
      <BrowsingTracker title={article.title_zh || article.title_en || ''} source="生活资讯" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && faqJsonLd.mainEntity.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      {/* Hero header */}
      {article.cover_image_url ? (
        <div className="relative" style={{ height: 'clamp(260px, 35vw, 400px)', overflow: 'hidden' }}>
          <img src={article.cover_image_url} alt={title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(31,27,22,0.85) 0%, rgba(31,27,22,0.3) 50%, rgba(31,27,22,0.1) 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 32px' }}>
            <nav className="flex items-center gap-1.5 flex-wrap mb-3" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <Link href="/" className="hover:text-white transition-colors">首页</Link>
              <span>›</span>
              <Link href="/guides" className="hover:text-white transition-colors">生活资讯</Link>
              {category && (
                <>
                  <span>›</span>
                  <Link href={`/guides?cat=${category.slug}`} className="hover:text-white transition-colors">{category.name_zh || category.name_en}</Link>
                </>
              )}
            </nav>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ padding: '3px 12px', borderRadius: 'var(--ed-radius-pill)', fontSize: 11.5, fontWeight: 500, background: vertical.bg, color: vertical.color }}>
                {vertical.label}
              </span>
              {category && (
                <span style={{ padding: '3px 12px', borderRadius: 'var(--ed-radius-pill)', fontSize: 11.5, fontWeight: 500, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  {category.icon} {category.name_zh || category.name_en}
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 700, lineHeight: 1.3, color: '#fff', maxWidth: 720 }}>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {article.published_at && (
                <time>{new Date(article.published_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
              )}
              <span>约 {Math.max(3, Math.ceil(String(body || '').length / 700))} 分钟阅读</span>
              <span>{article.view_count || 0} 浏览</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '36px 0 28px', background: 'var(--ed-paper)' }}>
          <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px' }}>
            <nav className="flex items-center gap-1.5 flex-wrap mb-4" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
              <Link href="/" className="hover:text-[var(--ed-accent)] transition-colors">首页</Link>
              <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
              <Link href="/guides" className="hover:text-[var(--ed-accent)] transition-colors">生活资讯</Link>
              {category && (
                <>
                  <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
                  <Link href={`/guides?cat=${category.slug}`} className="hover:text-[var(--ed-accent)] transition-colors">{category.name_zh || category.name_en}</Link>
                </>
              )}
            </nav>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ padding: '4px 14px', borderRadius: 'var(--ed-radius-pill)', fontSize: 12, fontWeight: 500, background: vertical.bg, color: vertical.color }}>
                {vertical.label}
              </span>
              {category && (
                <span style={{ padding: '4px 14px', borderRadius: 'var(--ed-radius-pill)', fontSize: 12, fontWeight: 500, border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>
                  {category.icon} {category.name_zh || category.name_en}
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 700, lineHeight: 1.3, maxWidth: 720 }}>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
              {article.published_at && (
                <time>{new Date(article.published_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
              )}
              <span>约 {Math.max(3, Math.ceil(String(body || '').length / 700))} 分钟阅读</span>
              <span>{article.view_count || 0} 浏览</span>
            </div>
          </div>
        </div>
      )}

      <EditorialContainer className="py-10">
        <div className="lg:flex gap-10">
          {/* Main Content */}
          <article className="flex-1 min-w-0" style={{ maxWidth: 760 }}>
            {/* Source Attribution */}
            {(article.source_type === 'business_website' || article.source_type === 'business_post') && (article.source_name || article.source_url) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                background: 'var(--ed-surface)', border: '1px solid var(--ed-line)',
                borderRadius: 'var(--ed-radius-md)', marginBottom: 24,
              }}>
                <span style={{ fontSize: 18 }}>📰</span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 500 }}>本文来源：{article.source_name || '商家供稿'}</p>
                  {article.source_url && (
                    <a href={article.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--ed-accent)' }}>
                      查看原文 → {article.source_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Medical/Legal Notice */}
            {isSensitiveContent && article.last_reviewed_at && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.2)',
                borderRadius: 'var(--ed-radius-md)', marginBottom: 24, fontSize: 12.5,
                color: 'var(--ed-ink-soft)',
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <p>本文涉及医疗/法律信息，最后审核更新于 <strong>{new Date(article.last_reviewed_at).toLocaleDateString('zh-CN')}</strong>。请注意政策可能已变更。</p>
              </div>
            )}

            {/* AI Summary */}
            {summary && (
              <div style={{
                padding: '20px 24px', marginBottom: 32,
                background: 'var(--ed-surface)',
                border: '1px solid var(--ed-line)',
                borderLeft: '3px solid var(--ed-amber)',
                borderRadius: 'var(--ed-radius-md)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ed-amber)', marginBottom: 8 }}>
                  AI 摘要
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--ed-ink-soft)', lineHeight: 1.8 }}>{summary}</p>
              </div>
            )}

            {/* Article Body */}
            {body && (
              <div className="editorial-prose" style={{ fontSize: 15.5, lineHeight: 1.85, color: 'var(--ed-ink)', marginBottom: 40 }}>
                <style dangerouslySetInnerHTML={{ __html: `
                  .editorial-prose h2 { font-family: var(--ed-font-serif); font-size: 20px; font-weight: 700; margin: 36px 0 16px; line-height: 1.3; scroll-margin-top: 96px; }
                  .editorial-prose h3 { font-family: var(--ed-font-serif); font-size: 17px; font-weight: 600; margin: 28px 0 12px; line-height: 1.35; scroll-margin-top: 96px; }
                  .editorial-prose p { margin-bottom: 18px; }
                  .editorial-prose ul, .editorial-prose ol { padding-left: 24px; margin-bottom: 18px; }
                  .editorial-prose li { margin-bottom: 6px; }
                  .editorial-prose a { color: var(--ed-accent); text-decoration: underline; text-underline-offset: 2px; }
                  .editorial-prose a:hover { color: var(--ed-accent-soft); }
                  .editorial-prose blockquote { border-left: 3px solid var(--ed-amber); padding-left: 20px; margin: 24px 0; color: var(--ed-ink-soft); font-style: italic; }
                  .editorial-prose img { border-radius: var(--ed-radius-md); margin: 24px 0; max-width: 100%; }
                  .editorial-prose hr { border: none; border-top: 1px solid var(--ed-line); margin: 32px 0; }
                  .editorial-prose table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
                  .editorial-prose th, .editorial-prose td { padding: 10px 14px; border: 1px solid var(--ed-line); text-align: left; }
                  .editorial-prose th { background: var(--ed-surface); font-weight: 600; }
                `}} />
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownHeadingComponents}>
                  {body}
                </ReactMarkdown>
              </div>
            )}

            {/* FAQ Section */}
            {faq && faq.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--ed-line)' }}>
                  常见问题
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {faq.map((item, idx) => (
                    <details key={idx} className="group" style={{ borderBottom: '1px solid var(--ed-line)' }}>
                      <summary className="flex items-center justify-between" style={{ padding: '14px 0', cursor: 'pointer', fontSize: 14.5, fontWeight: 600, listStyle: 'none' }}>
                        <span>{item.q}</span>
                        <svg className="flex-shrink-0 transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ed-ink-muted)' }}>
                          <path d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div style={{ paddingBottom: 14, fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Business Recommendations */}
            {businessLinks.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: 'var(--ed-accent)', borderRadius: 2 }} />
                  <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 17, fontWeight: 600 }}>推荐商家</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {businessLinks.map((link) => {
                    const biz = link.businesses as AnyRow | null;
                    if (!biz) return null;
                    return (
                      <EditorialCard key={link.id} className="flex items-start gap-4 p-5">
                        <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center" style={{ borderRadius: 'var(--ed-radius-md)', background: 'var(--ed-paper-warm)' }}>
                          <span style={{ fontSize: 24 }}>🏪</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 style={{ fontSize: 15, fontWeight: 600 }}>{pickBusinessDisplayName(biz)}</h4>
                            {biz.is_verified && (
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--ed-accent)" style={{ flexShrink: 0 }}>
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          {biz.avg_rating && (
                            <div className="flex items-center gap-1 mb-1">
                              <span style={{ color: 'var(--ed-amber)', fontSize: 12 }}>{'★'.repeat(Math.round(biz.avg_rating))}</span>
                              <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>{biz.avg_rating} ({biz.review_count || 0}评价)</span>
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/businesses/${biz.slug || biz.id}`}
                          style={{ padding: '8px 18px', borderRadius: 'var(--ed-radius-md)', fontSize: 13, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)', flexShrink: 0, alignSelf: 'center' }}
                        >
                          联系咨询
                        </Link>
                      </EditorialCard>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lead Capture Form */}
            <section id="lead-form" style={{ marginBottom: 40 }}>
              <div style={{
                background: 'var(--ed-ink)', color: 'var(--ed-paper)',
                borderRadius: 'var(--ed-radius-xl)', padding: '32px',
              }}>
                <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                  告诉我们你的需求，为你匹配服务
                </h2>
                <p style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 24 }}>
                  填写以下信息，我们会优先为你匹配合适的本地服务资源。
                </p>
                <LeadForm sourceType="guide" sourceArticleId={article.id} />
              </div>
            </section>

            {/* Forum Threads */}
            {relatedThreads.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: 'var(--ed-amber)', borderRadius: 2 }} />
                  <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 17, fontWeight: 600 }}>其他人的真实经验</h2>
                </div>
                <div style={{ border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)', overflow: 'hidden' }}>
                  {relatedThreads.map((thread, i) => (
                    <Link
                      key={thread.id}
                      href={`/forum/${boardSlugMap[String(thread.board_id)] || 'general'}/${thread.slug}`}
                      className="flex items-center gap-4 transition-colors hover:bg-[var(--ed-surface)]"
                      style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none' }}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {thread.title_zh || thread.title}
                        </h3>
                        {thread.ai_summary_zh && (
                          <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            AI摘要：{thread.ai_summary_zh}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ed-accent)' }}>{thread.reply_count || 0}</p>
                        <p style={{ fontSize: 11, color: 'var(--ed-ink-muted)' }}>回复</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Share bar */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '16px 0', borderTop: '1px solid var(--ed-line)', borderBottom: '1px solid var(--ed-line)',
              marginBottom: 40,
            }}>
              <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>内容由编辑团队持续更新，政策信息请以官方发布为准。</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>分享：</span>
                {['微信', 'Facebook', '复制链接'].map(label => (
                  <button key={label} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-pill)', background: 'transparent', color: 'var(--ed-ink-soft)', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Related News */}
            {relatedNews.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: 'var(--ed-accent)', borderRadius: 2 }} />
                  <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 17, fontWeight: 600 }}>相关新闻</h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedNews.map((news) => (
                    <Link key={news.id} href={`/news/${news.slug}`} className="block group">
                      <EditorialCard className="p-5 h-full">
                        <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>
                          {news.title_zh || news.title_en}
                        </h3>
                        {news.published_at && (
                          <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>
                            {new Date(news.published_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </EditorialCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Discover Posts */}
            {discoverPosts.length > 0 && (
              <section>
                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: 'var(--ed-amber)', borderRadius: 2 }} />
                  <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 17, fontWeight: 600 }}>相关笔记</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {discoverPosts.map((post) => {
                    const coverImage = post.cover_images?.[0] || post.cover_image_url;
                    const authorName = post.profiles?.display_name || '匿名';
                    return (
                      <Link key={post.id} href={`/discover/${post.slug || post.id}`} className="group block">
                        <EditorialCard className="h-full overflow-hidden">
                          <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                            {coverImage ? (
                              <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--ed-paper-warm)' }}>
                                <span style={{ fontSize: 24, opacity: 0.4 }}>📝</span>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '12px 14px' }}>
                            <h3 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>
                              {post.title}
                            </h3>
                            <span style={{ fontSize: 11.5, color: 'var(--ed-ink-muted)' }}>{authorName}</span>
                          </div>
                        </EditorialCard>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block flex-shrink-0" style={{ width: 280 }}>
            <div className="sticky" style={{ top: 100 }}>
              {/* TOC */}
              <div style={{
                background: 'var(--ed-surface-elev)', border: '1px solid var(--ed-line)',
                borderRadius: 'var(--ed-radius-lg)', padding: '20px', marginBottom: 20,
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ed-ink-muted)' }}>
                    <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                  </svg>
                  目录
                </h3>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {headings.length > 0 ? headings.map((heading, idx) => (
                    <a
                      key={idx}
                      href={`#${heading.id}`}
                      style={{
                        fontSize: 13,
                        color: heading.level === 2 ? 'var(--ed-ink-soft)' : 'var(--ed-ink-muted)',
                        fontWeight: heading.level === 2 ? 500 : 400,
                        paddingLeft: heading.level === 3 ? 12 : 0,
                        transition: 'color 0.2s',
                      }}
                      className="hover:text-[var(--ed-accent)]"
                    >
                      {heading.text}
                    </a>
                  )) : (
                    <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>暂无目录</p>
                  )}
                </nav>
              </div>

              {/* Article meta */}
              <div style={{
                background: 'var(--ed-surface-elev)', border: '1px solid var(--ed-line)',
                borderRadius: 'var(--ed-radius-lg)', padding: '20px', marginBottom: 20,
              }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ed-ink-muted)', marginBottom: 14 }}>
                  文章信息
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {article.published_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--ed-ink-muted)' }}>发布</span>
                      <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>{new Date(article.published_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--ed-ink-muted)' }}>浏览</span>
                    <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>{article.view_count || 0}</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <a href="#lead-form" style={{
                display: 'block', textAlign: 'center',
                padding: '14px 20px', borderRadius: 'var(--ed-radius-lg)',
                background: 'var(--ed-accent)', color: 'var(--ed-paper)',
                fontSize: 13.5, fontWeight: 500, transition: 'all 0.2s',
                marginBottom: 20,
              }}>
                提交匹配需求
              </a>

              {/* Back to guides */}
              <Link
                href="/guides"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 20px', background: 'var(--ed-surface-elev)',
                  border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)',
                  fontSize: 13.5, color: 'var(--ed-ink-soft)', fontWeight: 500,
                }}
                className="hover:text-[var(--ed-accent)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                返回生活资讯
              </Link>
            </div>
          </aside>
        </div>
      </EditorialContainer>
    </main>
  );
}

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
      headings.push({ level: match[1].length, text, id });
    }
  }
  return headings.slice(0, 10);
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().trim().replace(/[`*_~]/g, '').replace(/[^\w\u4e00-\u9fa5\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
