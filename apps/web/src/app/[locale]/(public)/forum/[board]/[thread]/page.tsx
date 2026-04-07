import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { ForumReplyForm } from '@/components/shared/forum-reply-form';
import { Card } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

interface Props {
  params: Promise<{ locale: string; board: string; thread: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { thread } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const { data } = await supabase
    .from('forum_threads')
    .select('title_zh, title, ai_summary_zh, cover_image_url')
    .eq('slug', thread)
    .eq('site_id', site.id)
    .single();

  const threadData = data as AnyRow | null;
  if (!threadData) return { title: 'Not Found' };

  const title = threadData.title_zh || threadData.title;
  return {
    title: `${title} · 社区论坛 · Baam`,
    description: threadData.ai_summary_zh || '',
    openGraph: {
      title: `${title} · Baam 论坛`,
      description: threadData.ai_summary_zh || '',
      images: threadData.cover_image_url ? [threadData.cover_image_url] : [],
    },
  };
}

export default async function ForumThreadPage({ params }: Props) {
  const { board, thread, locale } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const user = await getCurrentUser();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch thread
  const { data: rawThread, error: threadError } = await supabase
    .from('forum_threads')
    .select('*')
    .eq('slug', thread)
    .eq('site_id', site.id)
    .single();

  const threadData = rawThread as AnyRow | null;
  if (threadError || !threadData) notFound();

  // Fetch board info for breadcrumb
  const { data: rawScopedBoard } = await supabase
    .from('categories_forum')
    .select('name_zh, name_en, slug')
    .eq('slug', board)
    .eq('site_scope', siteScope)
    .single();
  let boardData = rawScopedBoard as AnyRow | null;
  if (!boardData && siteScope === 'en') {
    const { data: rawZhBoard } = await supabase
      .from('categories_forum')
      .select('name_zh, name_en, slug')
      .eq('slug', board)
      .eq('site_scope', 'zh')
      .single();
    boardData = rawZhBoard as AnyRow | null;
  }

  // Fetch replies
  const { data: rawReplies } = await supabase
    .from('forum_replies')
    .select('*')
    .eq('thread_id', threadData.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: true });

  const replies = (rawReplies || []) as AnyRow[];

  // Fetch related threads from same board
  const { data: rawRelated } = await supabase
    .from('forum_threads')
    .select('id, slug, title_zh, title, reply_count')
    .eq('board_id', threadData.board_id)
    .eq('status', 'published')
    .eq('site_id', site.id)
    .neq('id', threadData.id)
    .order('reply_count', { ascending: false })
    .limit(3);

  const relatedThreads = (rawRelated || []) as AnyRow[];

  const title = threadData.title_zh || threadData.title;
  const body = threadData.body_zh || threadData.body;
  const boardName = boardData?.name_zh || boardData?.name || boardData?.name_en || '论坛';
  const showAiSummary = (threadData.reply_count || 0) > 10 && threadData.ai_summary_zh;
  const aiMerchantIds = threadData.ai_merchant_ids as string[] | null;
  const hasAiMerchant = threadData.ai_intent === 'recommendation_request' && aiMerchantIds && aiMerchantIds.length > 0;

  return (
    <main>
      <PageContainer className="py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/forum" className="hover:text-primary">论坛</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/forum/${board}`} className="hover:text-primary">{boardName}</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary line-clamp-1">{title}</span>
        </nav>

        <div className="lg:flex gap-8">
          {/* Main Content */}
          <article className="flex-1 max-w-[var(--content-max)]">
            {/* AI Summary */}
            {showAiSummary && (
              <div className="ai-summary-card mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">🤖</span>
                  <span className="text-xs font-semibold text-text-secondary">AI 讨论摘要</span>
                </div>
                <p className="text-sm text-secondary-dark leading-relaxed">{threadData.ai_summary_zh}</p>
              </div>
            )}

            {/* Thread Header */}
            <header className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">{title}</h1>

              {/* Author Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-border-light flex items-center justify-center text-text-muted">
                  👤
                </div>
                <div>
                  <p className="text-sm font-medium">{threadData.author_name || '匿名用户'}</p>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    {threadData.created_at && (
                      <time>{new Date(threadData.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}</time>
                    )}
                    <span>{threadData.view_count || 0} 浏览</span>
                    <span>{threadData.reply_count || 0} 回复</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Thread Body */}
            {body && (
              <div className="prose prose-sm max-w-none mb-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-text-primary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            )}

            {/* AI Merchant Injection */}
            {hasAiMerchant && (
              <div className="bg-accent-orange-light/20 border border-accent-orange/20 rounded-lg p-4 mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span>🤖</span>
                  <span className="text-sm font-semibold">AI 推荐商家</span>
                </div>
                <p className="text-xs text-text-muted">根据帖子内容，AI 为您匹配了以下商家（加载中...）</p>
                {/* TODO: Render business cards from ai_merchant_ids */}
              </div>
            )}

            {/* Replies Section */}
            <section className="border-t border-border pt-6">
              <h2 className="text-lg font-bold mb-4">
                回复 ({replies.length})
              </h2>

              {replies.length === 0 ? (
                <p className="text-sm text-text-muted py-4">暂无回复，来说两句吧</p>
              ) : (
                <div className="space-y-4">
                  {replies.map((reply, index) => (
                    <Card key={reply.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center text-text-muted text-sm flex-shrink-0">
                          👤
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">{reply.author_name || '匿名用户'}</span>
                            <span className="text-xs text-text-muted">#{index + 1}</span>
                            {reply.created_at && (
                              <span className="text-xs text-text-muted">
                                {formatTimeAgo(reply.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                            {reply.body_zh || reply.body}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                            <button className="hover:text-primary">👍 {reply.upvote_count || 0}</button>
                            <button className="hover:text-primary">👎 {reply.downvote_count || 0}</button>
                            <button className="hover:text-primary">回复</button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Reply Form */}
            <section className="mt-6">
              <ForumReplyForm threadId={threadData.id} isLoggedIn={!!user} />
            </section>

            {/* Related Threads */}
            {relatedThreads.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4">📌 相关帖子</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedThreads.map((related) => (
                    <Link key={related.id} href={`/forum/${board}/${related.slug}`} className="block">
                      <Card className="p-4 h-full hover:shadow-md transition-shadow">
                        <h3 className="font-medium text-sm line-clamp-2">{related.title_zh || related.title}</h3>
                        <span className="text-xs text-text-muted mt-1 block">💬 {related.reply_count || 0}</span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            {/* Thread Stats */}
            <Card className="bg-bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">帖子信息</h3>
              <div className="space-y-2 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span>浏览</span>
                  <span className="font-medium">{threadData.view_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>回复</span>
                  <span className="font-medium">{threadData.reply_count || 0}</span>
                </div>
                {threadData.created_at && (
                  <div className="flex justify-between">
                    <span>发布时间</span>
                    <span className="font-medium">
                      {new Date(threadData.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
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
