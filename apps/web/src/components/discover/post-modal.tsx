'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImageCarousel } from './image-carousel';
import { LikeButton, CommentForm } from '@/components/shared/social-actions';
import { formatTimeAgo } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface PostModalData {
  post: AnyRow;
  profile: AnyRow | null;
  comments: AnyRow[];
  linkedBusinesses: AnyRow[];
  morePosts: AnyRow[];
}

interface PostModalProps {
  slug: string;
  /** Minimal data from the card for instant preview while loading */
  preview?: {
    title?: string;
    coverImage?: string;
    authorName?: string;
  };
  isLoggedIn: boolean;
  currentUserId?: string | null;
  onClose: () => void;
}

const avatarGradients = [
  'from-pink-200 to-rose-300',
  'from-blue-200 to-cyan-300',
  'from-amber-200 to-orange-300',
  'from-emerald-200 to-teal-300',
];
const avatarTextColors = ['text-rose-600', 'text-cyan-600', 'text-orange-600', 'text-emerald-600'];

export function PostModal({ slug, preview, isLoggedIn: serverIsLoggedIn, currentUserId: serverUserId, onClose }: PostModalProps) {
  const [data, setData] = useState<PostModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [authState, setAuthState] = useState<{ isLoggedIn: boolean; userId: string | null }>({
    isLoggedIn: serverIsLoggedIn,
    userId: serverUserId || null,
  });
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Check auth state client-side (more reliable than server prop)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthState({ isLoggedIn: true, userId: user.id });
      }
    });
  }, []);

  const isLoggedIn = authState.isLoggedIn;
  const currentUserId = authState.userId;

  // Fetch post data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/discover/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [slug]);

  // Push URL state — use native history API to avoid triggering Next.js router
  useEffect(() => {
    const originalUrl = window.location.pathname + window.location.search;
    let closedViaPopstate = false;

    // Use replaceState first, then pushState with a hash to prevent Next.js
    // from treating this as a route change and navigating away from the modal
    const modalUrl = `${window.location.pathname}${window.location.search}#post=${encodeURIComponent(slug)}`;
    window.history.pushState({ modal: true, slug }, '', modalUrl);

    const handlePop = () => {
      closedViaPopstate = true;
      onClose();
    };
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
      // If closed via close button / Escape (not back button), restore URL
      if (!closedViaPopstate) {
        window.history.replaceState(null, '', originalUrl);
      }
    };
  }, [slug, onClose]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Click overlay to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const post = data?.post;
  const profile = data?.profile;
  const comments = data?.comments || [];
  const linkedBusinesses = data?.linkedBusinesses || [];
  const morePosts = data?.morePosts || [];

  const coverImages = post
    ? ((post.cover_images as string[] | null) || (post.cover_image_url ? [post.cover_image_url] : []))
    : preview?.coverImage ? [preview.coverImage] : [];

  const isVideo = post?.post_type === 'video';
  const authorName = profile?.display_name || profile?.username || preview?.authorName || '匿名';

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 backdrop-blur-sm"
    >
      <div className="relative w-[90vw] max-w-[1100px] h-[90vh] max-h-[720px] bg-white rounded-2xl overflow-hidden flex shadow-[0_24px_80px_rgba(0,0,0,0.3)]">


        {/* ═══ LEFT: Media Area (55%) ═══ */}
        <div className="w-[55%] bg-black flex items-center justify-center relative flex-shrink-0">
          {isVideo && post?.video_url ? (
            <video
              src={post.video_url}
              poster={post.video_thumbnail_url || undefined}
              controls
              className="w-full h-full object-contain"
            />
          ) : coverImages.length > 0 ? (
            <ImageCarousel images={coverImages} title={post?.title || preview?.title || ''} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              <span className="text-6xl text-gray-300">{post?.title?.[0] || preview?.title?.[0] || '📝'}</span>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Content Area (45%) ═══ */}
        <div className="w-[45%] flex flex-col overflow-hidden">

          {/* Author Header (fixed) */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
            {loading ? (
              <>
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <a href={profile?.username ? `/zh/discover/voices/${profile.username}` : '#'}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradients[0]} flex items-center justify-center text-sm font-bold ${avatarTextColors[0]} flex-shrink-0`}>
                  {authorName[0]}
                </a>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <a href={profile?.username ? `/zh/discover/voices/${profile.username}` : '#'}
                      className="font-semibold text-[15px] text-gray-900 hover:text-primary transition">
                      {authorName}
                    </a>
                    {profile?.is_verified && (
                      <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {post?.published_at ? formatTimeAgo(post.published_at) : ''}
                    {post?.location_text && ` · ${post.location_text}`}
                  </span>
                </div>
                {currentUserId !== post?.author_id && profile?.id && (
                  <button className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-full hover:bg-primary/90 transition flex-shrink-0">
                    + 关注
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition flex-shrink-0"
                  title="关闭"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 w-3/4 bg-gray-200 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-5/6 bg-gray-100 rounded" />
                  <div className="h-4 w-4/6 bg-gray-100 rounded" />
                </div>
              </div>
            ) : error ? (
              <div className="py-8 text-center text-gray-400">加载失败，请稍后重试</div>
            ) : (
              <>
                {/* Title */}
                {post?.title && (
                  <h1 className="text-xl font-bold text-gray-900 leading-snug mb-3">{post.title}</h1>
                )}

                {/* Body */}
                {(post?.body || post?.content) && (
                  <div className="text-[14px] text-gray-600 leading-[1.9] whitespace-pre-wrap break-words mb-4">
                    {post.body || post.content}
                  </div>
                )}

                {/* Tags */}
                {post?.topic_tags && post.topic_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {post.topic_tags.map((tag: string) => (
                      <a
                        key={tag}
                        href={`/zh/discover?topic=${encodeURIComponent(tag)}`}
                        className="px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-medium hover:bg-primary/10 transition"
                      >
                        #{tag}
                      </a>
                    ))}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center gap-6 py-4 border-t border-b border-gray-100 mb-5">
                  <LikeButton postId={post!.id} isLiked={false} likeCount={post?.like_count || 0} isLoggedIn={isLoggedIn} />
                  <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    收藏
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    分享
                  </button>
                </div>

                {/* Linked Businesses */}
                {linkedBusinesses.length > 0 && (
                  <div className="mb-5">
                    {linkedBusinesses.map((link) => {
                      const biz = link.businesses as AnyRow;
                      if (!biz) return null;
                      return (
                        <a key={link.id} href={`/zh/businesses/${biz.slug}`}
                          className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition mb-2">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-amber-100 flex items-center justify-center text-lg flex-shrink-0">
                            {biz.display_name_zh?.[0] || biz.display_name?.[0] || '🏪'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{biz.display_name_zh || biz.display_name}</div>
                            {biz.address_full && <div className="text-xs text-gray-400 mt-0.5 truncate">{biz.address_full}</div>}
                            {biz.avg_rating && (
                              <div className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                {biz.avg_rating}
                              </div>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Comments */}
                <div className="mb-5">
                  <h3 className="text-[15px] font-bold text-gray-900 mb-4">评论 ({comments.length})</h3>
                  {comments.length > 0 ? (
                    <div className="space-y-4">
                      {comments.map((comment, ci) => {
                        const commentAuthor = comment.profiles?.display_name || '匿名用户';
                        const isPostAuthor = comment.author_id === post?.author_id;
                        const grad = avatarGradients[(ci + 1) % avatarGradients.length];
                        const textCol = avatarTextColors[(ci + 1) % avatarTextColors.length];
                        return (
                          <div key={comment.id} className="flex gap-2.5">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-[10px] font-bold ${textCol} flex-shrink-0`}>
                              {commentAuthor[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[13px] font-semibold text-gray-900">{commentAuthor}</span>
                                {isPostAuthor && (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">作者</span>
                                )}
                              </div>
                              <p className="text-[13px] text-gray-600 leading-relaxed">{comment.content}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                <span>{formatTimeAgo(comment.created_at)}</span>
                                <button className="hover:text-primary transition">回复</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-3">暂无评论，快来抢沙发</p>
                  )}
                </div>

                {/* More from Author */}
                {morePosts.length > 0 && (
                  <div className="pt-5 border-t border-gray-100">
                    <h3 className="text-[15px] font-bold text-gray-900 mb-3">更多来自 {authorName}</h3>
                    <div className="flex gap-2">
                      {morePosts.map((p) => {
                        const img = p.cover_images?.[0] || p.cover_image_url;
                        return (
                          <a key={p.id} href={`/zh/discover/${p.slug || p.id}`}
                            className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            {img ? (
                              <img src={img} alt={p.title || ''} className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-300 text-sm font-bold">
                                {p.title?.[0] || '📝'}
                              </div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Comment Input Bar (fixed at bottom) */}
          <div className="px-6 py-3.5 border-t border-gray-100 flex items-center gap-3 flex-shrink-0 bg-white">
            {post ? (
              <div className="flex-1 flex items-center gap-3">
                <CommentForm postId={post.id} isLoggedIn={isLoggedIn} />
              </div>
            ) : (
              <div className="flex-1 h-10 bg-gray-50 rounded-full animate-pulse" />
            )}
            {post && (
              <div className="flex items-center gap-4 flex-shrink-0">
                <LikeButton postId={post.id} isLiked={false} likeCount={post.like_count || 0} isLoggedIn={isLoggedIn} />
                <button className="text-gray-400 hover:text-primary transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
