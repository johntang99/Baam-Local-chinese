import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { FollowButton, LikeButton, CommentForm } from '@/components/shared/social-actions';
import { ImageCarousel } from '@/components/discover/image-carousel';
import { RelatedDiscoverPosts } from '@/components/discover/related-posts';
import { DiscoverCard } from '@/components/discover/discover-card';
import { PostActions } from '@/components/discover/post-actions';
import { formatTimeAgo } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const supabase = await createClient();

  const { data: postData } = await supabase
    .from('voice_posts')
    .select('title, content, author_id')
    .eq('slug', decodedSlug)
    .eq('status', 'published')
    .single();

  const post = postData as AnyRow | null;
  if (!post) return { title: 'Not Found' };

  const { data: authorData } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', post.author_id)
    .single();

  const authorName = (authorData as AnyRow | null)?.display_name || '';

  return {
    title: `${post.title} · ${authorName} · Baam`,
    description: post.content?.slice(0, 160) || '',
    openGraph: {
      title: post.title || '',
      description: post.content?.slice(0, 160) || '',
    },
  };
}

export default async function DiscoverPostDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const currentUser = await getCurrentUser().catch(() => null);

  // Decode slug — Next.js passes URL-encoded params, but DB stores decoded Chinese chars
  const decodedSlug = decodeURIComponent(slug);

  // Fetch post
  const { data: postData, error: postError } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('status', 'published')
    .single();

  const post = postData as AnyRow | null;
  if (postError || !post) notFound();

  // Fetch author profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', post.author_id)
    .single();

  const profile = (profileData || {}) as AnyRow;
  const username = profile.username || '';

  // Fetch comments with author profiles
  const { data: rawComments } = await supabase
    .from('voice_post_comments')
    .select('*, profiles:author_id(display_name, username, avatar_url)')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true });

  const comments = (rawComments || []) as AnyRow[];

  // Fetch linked businesses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLinkedBiz } = await (supabase as any)
    .from('discover_post_businesses')
    .select('*, businesses(*)')
    .eq('post_id', post.id)
    .order('sort_order', { ascending: true });

  const linkedBusinesses = (rawLinkedBiz || []) as AnyRow[];

  // Fetch more posts from same author
  const { data: rawMorePosts } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('author_id', post.author_id)
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(4);

  const morePosts = (rawMorePosts || []) as AnyRow[];

  // Fetch related posts by matching topic_tags
  let relatedPosts: AnyRow[] = [];
  const postTags = post.topic_tags as string[] | null;
  if (postTags && postTags.length > 0) {
    const { data: rawRelated } = await supabase
      .from('voice_posts')
      .select('*, profiles!voice_posts_author_id_fkey(display_name)')
      .eq('status', 'published')
      .neq('id', post.id)
      .neq('author_id', post.author_id)
      .overlaps('topic_tags', postTags)
      .order('like_count', { ascending: false })
      .limit(6);
    relatedPosts = (rawRelated || []) as AnyRow[];
  }

  const coverImages = (post.cover_images as string[] | null) || (post.cover_image_url ? [post.cover_image_url] : []);
  const isVideo = post.post_type === 'video';

  return (
    <main>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-4">
          <Link href="/discover" className="hover:text-primary">发现</Link>
          <span className="mx-2">›</span>
          {username && (
            <>
              <Link href={`/discover/voices/${username}`} className="hover:text-primary">
                {profile.display_name || username}
              </Link>
              <span className="mx-2">›</span>
            </>
          )}
          <span className="text-gray-600">{post.title}</span>
        </nav>

        {/* Author Card */}
        <div className="flex items-center gap-3 mb-6">
          {username ? (
            <Link href={`/discover/voices/${username}`}>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                {profile.display_name?.[0] || '?'}
              </div>
            </Link>
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">?</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {username ? (
                <Link href={`/discover/voices/${username}`} className="font-semibold text-sm hover:text-primary">
                  {profile.display_name || username}
                </Link>
              ) : (
                <span className="font-semibold text-sm">匿名</span>
              )}
              {profile.is_verified && (
                <span className="badge badge-blue text-xs">已认证</span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {formatTimeAgo(post.published_at)} · {post.view_count || 0} 浏览
            </p>
          </div>
          {currentUser?.id === post.author_id ? (
            <PostActions postId={post.id} postSlug={post.slug} />
          ) : profile.id ? (
            <FollowButton profileId={profile.id} isFollowing={false} isLoggedIn={!!currentUser} className="h-8 px-4 text-xs rounded-lg" />
          ) : null}
        </div>

        {/* Image Carousel / Video Player */}
        {isVideo && post.video_url ? (
          <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
            <video
              src={post.video_url}
              poster={post.video_thumbnail_url || undefined}
              controls
              className="w-full h-full object-contain"
            />
          </div>
        ) : coverImages.length > 0 ? (
          <ImageCarousel images={coverImages} title={post.title} />
        ) : null}

        {/* Post Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {post.post_type && (
              <span className="badge badge-purple text-xs">{post.post_type}</span>
            )}
            {post.location_text && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                {post.location_text}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{post.title}</h1>
        </header>

        {/* Post Body — 小红书 style plain text with preserved line breaks */}
        {(post.body || post.content) && (
          <div className="mb-8 text-[15px] text-gray-800 leading-[1.8] whitespace-pre-wrap break-words">
            {post.body || post.content}
          </div>
        )}

        {/* Tags */}
        {post.topic_tags && post.topic_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.topic_tags.map((tag: string) => (
              <Link
                key={tag}
                href={`/discover?topic=${encodeURIComponent(tag)}`}
                className="text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full hover:bg-orange-100"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 py-4 border-t border-b border-gray-200 mb-8">
          <LikeButton postId={post.id} isLiked={false} likeCount={post.like_count || 0} isLoggedIn={!!currentUser} />
          <span className="text-sm text-gray-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            {post.save_count || 0} 收藏
          </span>
          <span className="text-sm text-gray-400">💬 {comments.length} 评论</span>
        </div>

        {/* Linked Businesses */}
        {linkedBusinesses.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-3">相关商家</h2>
            <div className="space-y-3">
              {linkedBusinesses.map((link) => {
                const biz = link.businesses as AnyRow;
                if (!biz) return null;
                return (
                  <Link key={link.id} href={`/businesses/${biz.slug}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center text-xl">
                      {biz.display_name_zh?.[0] || biz.display_name?.[0] || '🏪'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{biz.display_name_zh || biz.display_name}</h3>
                      {biz.short_desc_zh && <p className="text-xs text-gray-400 truncate">{biz.short_desc_zh}</p>}
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Comments */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">评论 ({comments.length})</h2>
          {comments.length > 0 && (
            <div className="space-y-4 mb-4">
              {comments.map((comment) => {
                const commentAuthor = comment.profiles?.display_name || '匿名用户';
                return (
                <div key={comment.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs flex-shrink-0">
                      {commentAuthor[0]}
                    </div>
                    <span className="text-sm font-medium">{commentAuthor}</span>
                    {comment.created_at && (
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(comment.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 pl-9">{comment.content}</p>
                </div>
                );
              })}
            </div>
          )}
          <CommentForm postId={post.id} isLoggedIn={!!currentUser} />
        </section>

        {/* Related Posts (by matching tags) */}
        <RelatedDiscoverPosts posts={relatedPosts} title="相关笔记" />

        {/* More from Author */}
        {morePosts.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4">更多来自 {profile.display_name || username || '作者'}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {morePosts.map((p, i) => (
                <DiscoverCard key={p.id} post={p} author={profile} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
