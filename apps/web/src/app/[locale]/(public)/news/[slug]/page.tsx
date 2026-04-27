import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { decodeRouteSlug } from '@/lib/slug';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { EditorialContainer } from '@/components/editorial/container';
import { EditorialCard } from '@/components/editorial/card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrowsingTracker } from '@/components/shared/browsing-tracker';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const supabase = await createClient();
  const site = await getCurrentSite();
  const { data } = await supabase
    .from('articles')
    .select('title_zh, title_en, ai_summary_zh, summary_zh, cover_image_url')
    .eq('site_id', site.id)
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

const verticalConfig: Record<string, { label: string; bg: string; color: string }> = {
  news_alert: { label: '快报', bg: 'var(--ed-accent)', color: 'var(--ed-paper)' },
  news_brief: { label: '简报', bg: 'var(--ed-ink)', color: 'var(--ed-paper)' },
  news_explainer: { label: '政策解读', bg: 'var(--ed-tag-purple-bg)', color: 'var(--ed-tag-purple-text)' },
  news_roundup: { label: '周度汇总', bg: 'var(--ed-amber)', color: 'var(--ed-ink)' },
  news_community: { label: '社区新闻', bg: 'var(--ed-tag-green-bg)', color: 'var(--ed-tag-green-text)' },
};

export default async function NewsDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
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

  const vertical = verticalConfig[article.content_vertical] || { label: '新闻', bg: 'var(--ed-ink)', color: 'var(--ed-paper)' };
  const title = article.title_zh || article.title_en;
  const body = article.body_zh || article.body_en;
  const summary = article.ai_summary_zh || article.summary_zh;
  const keyFacts = article.ai_key_facts as Record<string, string> | null;
  const faq = article.ai_faq as Array<{ q: string; a: string }> | null;

  // Related guides
  const { data: rawGuides } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison'])
    .eq('editorial_status', 'published')
    .limit(3);
  const relatedGuides = (rawGuides || []) as AnyRow[];

  return (
    <main>
      <BrowsingTracker title={article.title_zh || article.title_en || ''} source="新闻" />
      {/* Hero header with cover image */}
      {article.cover_image_url ? (
        <div className="relative" style={{ height: 'clamp(280px, 40vw, 440px)', overflow: 'hidden' }}>
          <img
            src={article.cover_image_url}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(31,27,22,0.85) 0%, rgba(31,27,22,0.3) 50%, rgba(31,27,22,0.1) 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px 36px' }}>
            {/* Breadcrumb on image */}
            <nav className="flex items-center gap-1.5 flex-wrap mb-4" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <Link href="/" className="transition-colors hover:text-white">首页</Link>
              <span>›</span>
              <Link href="/news" className="transition-colors hover:text-white">新闻</Link>
              <span>›</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{vertical.label}</span>
            </nav>
            <span style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--ed-radius-pill)',
              fontSize: 12, fontWeight: 500, marginBottom: 14,
              background: vertical.bg, color: vertical.color,
            }}>
              {vertical.label}
            </span>
            <h1 style={{
              fontFamily: 'var(--ed-font-serif)',
              fontSize: 'clamp(22px, 3vw, 34px)',
              fontWeight: 700,
              lineHeight: 1.3,
              color: '#fff',
              maxWidth: 760,
            }}>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {article.published_at && (
                <time>{new Date(article.published_at).toLocaleDateString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}</time>
              )}
              {article.source_name && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{article.source_name}</span>
                </>
              )}
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{article.view_count || 0} 浏览</span>
            </div>
          </div>
        </div>
      ) : (
        /* No cover image — text header */
        <div style={{ padding: '40px 0 32px', background: 'var(--ed-paper)' }}>
          <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px' }}>
            <nav className="flex items-center gap-1.5 flex-wrap mb-4" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
              <Link href="/" className="transition-colors hover:text-[var(--ed-accent)]">首页</Link>
              <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
              <Link href="/news" className="transition-colors hover:text-[var(--ed-accent)]">新闻</Link>
              <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
              <span style={{ color: 'var(--ed-ink-soft)' }}>{vertical.label}</span>
            </nav>
            <span style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--ed-radius-pill)',
              fontSize: 12, fontWeight: 500, marginBottom: 14,
              background: vertical.bg, color: vertical.color,
            }}>
              {vertical.label}
            </span>
            <h1 style={{
              fontFamily: 'var(--ed-font-serif)',
              fontSize: 'clamp(22px, 3vw, 34px)',
              fontWeight: 700,
              lineHeight: 1.3,
              maxWidth: 760,
            }}>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
              {article.published_at && (
                <time>{new Date(article.published_at).toLocaleDateString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}</time>
              )}
              {article.source_name && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{article.source_name}</span>
                </>
              )}
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{article.view_count || 0} 浏览</span>
            </div>
          </div>
        </div>
      )}

      <EditorialContainer className="py-10">
        <div className="lg:flex gap-10">
          {/* Main Content */}
          <article className="flex-1 min-w-0" style={{ maxWidth: 760 }}>
            {/* AI Summary */}
            {summary && (
              <div style={{
                padding: '20px 24px',
                background: 'var(--ed-surface)',
                border: '1px solid var(--ed-line)',
                borderLeft: '3px solid var(--ed-accent)',
                borderRadius: 'var(--ed-radius-md)',
                marginBottom: 32,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ed-accent)', marginBottom: 8 }}>
                  AI 摘要
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--ed-ink-soft)', lineHeight: 1.8 }}>{summary}</p>
              </div>
            )}

            {/* Key Facts */}
            {keyFacts && Object.keys(keyFacts).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 32 }}>
                {Object.entries(keyFacts).map(([key, value]) => (
                  <div key={key} style={{
                    background: 'var(--ed-surface-elev)',
                    border: '1px solid var(--ed-line)',
                    borderRadius: 'var(--ed-radius-md)',
                    padding: '14px 16px',
                    textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 11.5, color: 'var(--ed-ink-muted)', marginBottom: 4 }}>{key}</p>
                    <p style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--ed-font-serif)' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Article Body */}
            {body && (
              <div
                className="editorial-prose"
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.85,
                  color: 'var(--ed-ink)',
                  marginBottom: 40,
                }}
              >
                <style dangerouslySetInnerHTML={{ __html: `
                  .editorial-prose h2 {
                    font-family: var(--ed-font-serif);
                    font-size: 20px;
                    font-weight: 700;
                    margin: 36px 0 16px;
                    line-height: 1.3;
                  }
                  .editorial-prose h3 {
                    font-family: var(--ed-font-serif);
                    font-size: 17px;
                    font-weight: 600;
                    margin: 28px 0 12px;
                    line-height: 1.35;
                  }
                  .editorial-prose p {
                    margin-bottom: 18px;
                  }
                  .editorial-prose ul, .editorial-prose ol {
                    padding-left: 24px;
                    margin-bottom: 18px;
                  }
                  .editorial-prose li {
                    margin-bottom: 6px;
                  }
                  .editorial-prose a {
                    color: var(--ed-accent);
                    text-decoration: underline;
                    text-underline-offset: 2px;
                  }
                  .editorial-prose a:hover {
                    color: var(--ed-accent-soft);
                  }
                  .editorial-prose blockquote {
                    border-left: 3px solid var(--ed-amber);
                    padding-left: 20px;
                    margin: 24px 0;
                    color: var(--ed-ink-soft);
                    font-style: italic;
                  }
                  .editorial-prose img {
                    border-radius: var(--ed-radius-md);
                    margin: 24px 0;
                    max-width: 100%;
                  }
                  .editorial-prose hr {
                    border: none;
                    border-top: 1px solid var(--ed-line);
                    margin: 32px 0;
                  }
                  .editorial-prose table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 24px 0;
                    font-size: 14px;
                  }
                  .editorial-prose th, .editorial-prose td {
                    padding: 10px 14px;
                    border: 1px solid var(--ed-line);
                    text-align: left;
                  }
                  .editorial-prose th {
                    background: var(--ed-surface);
                    font-weight: 600;
                  }
                `}} />
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            )}

            {/* FAQ section */}
            {faq && faq.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{
                  fontFamily: 'var(--ed-font-serif)',
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--ed-line)',
                }}>
                  常见问题
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {faq.map((item, i) => (
                    <div key={i}>
                      <p style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>{item.q}</p>
                      <p style={{ fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Attribution */}
            {article.source_url && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 20px',
                background: 'var(--ed-surface)',
                border: '1px solid var(--ed-line)',
                borderRadius: 'var(--ed-radius-md)',
                marginBottom: 32,
              }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div>
                  <p style={{ fontSize: 11.5, color: 'var(--ed-ink-muted)' }}>
                    {article.source_type === 'official_gov' ? 'A类官方来源' : '来源'}
                  </p>
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13.5, color: 'var(--ed-accent)', fontWeight: 500 }}
                  >
                    {article.source_name || article.source_url} ↗
                  </a>
                </div>
              </div>
            )}

            {/* Share bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '16px 0',
              borderTop: '1px solid var(--ed-line)',
              borderBottom: '1px solid var(--ed-line)',
              marginBottom: 40,
            }}>
              <span style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>分享：</span>
              {['微信', 'Facebook', '复制链接'].map(label => (
                <button
                  key={label}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12.5,
                    border: '1px solid var(--ed-line)',
                    borderRadius: 'var(--ed-radius-pill)',
                    background: 'transparent',
                    color: 'var(--ed-ink-soft)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Related Guides */}
            {relatedGuides.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{
                    width: 3, height: 18,
                    background: 'var(--ed-accent)',
                    borderRadius: 2,
                  }} />
                  <h2 style={{
                    fontFamily: 'var(--ed-font-serif)',
                    fontSize: 17,
                    fontWeight: 600,
                  }}>
                    相关生活指南
                  </h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedGuides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="block group">
                      <EditorialCard className="p-5 h-full flex flex-col">
                        <h3 style={{
                          fontFamily: 'var(--ed-font-serif)',
                          fontSize: 14,
                          fontWeight: 600,
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: 8,
                        }}>
                          {guide.title_zh || guide.title_en}
                        </h3>
                        <span style={{
                          marginTop: 'auto',
                          fontSize: 12,
                          color: 'var(--ed-accent)',
                          fontWeight: 500,
                        }}>
                          阅读指南 →
                        </span>
                      </EditorialCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block flex-shrink-0" style={{ width: 280 }}>
            <div className="sticky" style={{ top: 100 }}>
              {/* Article meta */}
              <div style={{
                background: 'var(--ed-surface-elev)',
                border: '1px solid var(--ed-line)',
                borderRadius: 'var(--ed-radius-lg)',
                padding: '20px',
                marginBottom: 20,
              }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ed-ink-muted)', marginBottom: 14 }}>
                  文章信息
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {article.published_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--ed-ink-muted)' }}>发布</span>
                      <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>
                        {new Date(article.published_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  )}
                  {article.last_reviewed_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--ed-ink-muted)' }}>审核</span>
                      <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>
                        {new Date(article.last_reviewed_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--ed-ink-muted)' }}>浏览</span>
                    <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>{article.view_count || 0}</span>
                  </div>
                  {article.source_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--ed-ink-muted)' }}>来源</span>
                      <span style={{ color: 'var(--ed-ink-soft)', fontWeight: 500 }}>{article.source_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Back to news */}
              <Link
                href="/news"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 20px',
                  background: 'var(--ed-surface-elev)',
                  border: '1px solid var(--ed-line)',
                  borderRadius: 'var(--ed-radius-lg)',
                  fontSize: 13.5,
                  color: 'var(--ed-ink-soft)',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                className="hover:text-[var(--ed-accent)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                返回新闻列表
              </Link>
            </div>
          </aside>
        </div>
      </EditorialContainer>
    </main>
  );
}
