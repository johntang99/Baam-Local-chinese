import { Link } from '@/lib/i18n/routing';
import { SectionHeader } from './section-header';
import { HeartButton } from '@/components/discover/heart-button';
import { ShareVideoMedia } from './share-video-media';
import { ShareSectionClient, ShareCardLink } from './share-section-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ShareSectionProps {
  posts: AnyRow[];
  categories?: AnyRow[];
  isLoggedIn?: boolean;
  currentUserId?: string | null;
}

const gradients = [
  'linear-gradient(135deg, #8E7D6A 0%, #3D342A 100%)',
  'linear-gradient(135deg, #C9B599 0%, #7A6850 100%)',
  'linear-gradient(135deg, #D9A89A 0%, #7D3F2E 100%)',
  'linear-gradient(135deg, #A8C4A2 0%, #4D6B48 100%)',
  'linear-gradient(135deg, #E8B87A 0%, #A06B2E 100%)',
  'linear-gradient(135deg, #7FA8B8 0%, #3D5A6B 100%)',
  'linear-gradient(135deg, #E8C0C7 0%, #A86A76 100%)',
];

// Fallback if no categories passed from DB
const defaultCategoryTabs = [
  { label: '推荐', slug: '' },
  { label: '美食', slug: 'food' },
  { label: '健康', slug: 'health' },
  { label: '爱美', slug: 'beauty' },
  { label: '穿搭', slug: 'fashion' },
];

export function ShareSection({ posts, categories = [], isLoggedIn = false, currentUserId }: ShareSectionProps) {
  if (posts.length === 0) return null;

  // Build category tabs from DB categories, with "推荐" as first tab
  const categoryTabs = categories.length > 0
    ? [{ label: '推荐', slug: '' }, ...categories.map((c: AnyRow) => ({ label: String(c.name_zh), slug: String(c.slug) }))]
    : defaultCategoryTabs;

  const feature = posts[0];
  const smalls = posts.slice(1, 7);

  return (
    <section className="py-12 sm:py-[72px]">
      <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px' }} className="sm:!px-8">
        <SectionHeader
          number="01"
          english="Community"
          title="逛逛晒晒"
          titleEm="discover daily"
          right={
            <div className="flex items-center gap-4">
              <Link
                href="/discover/new-post"
                className="inline-flex items-center gap-2 transition-all hover:-translate-y-px"
                style={{
                  padding: '10px 18px', background: 'var(--ed-accent)', color: 'var(--ed-paper)',
                  borderRadius: 'var(--ed-radius-pill)', fontSize: 14, fontWeight: 500,
                }}
              >
                <span style={{
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(251, 246, 236, 0.25)', borderRadius: '50%', fontSize: 13, lineHeight: 1,
                }}>+</span>
                发个晒晒
              </Link>
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 transition-colors"
                style={{ fontSize: 14, color: 'var(--ed-ink-soft)' }}
              >
                查看全部
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
          }
        />

        {/* Category Tabs — link to Discover with category filter */}
        <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 28 }}>
          {categoryTabs.map((tab, i) => (
            <Link
              key={tab.slug || 'recommend'}
              href={tab.slug ? `/discover?category=${tab.slug}` : '/discover'}
              className="transition-all hover:-translate-y-px"
              style={{
                padding: '8px 16px', borderRadius: 'var(--ed-radius-pill)', fontSize: 13.5,
                background: i === 0 ? 'var(--ed-ink)' : 'transparent',
                color: i === 0 ? 'var(--ed-paper)' : 'var(--ed-ink-soft)',
                border: i === 0 ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Bento Grid wrapped in modal-enabled client */}
        <ShareSectionClient isLoggedIn={isLoggedIn} currentUserId={currentUserId}>
          <div
            className="grid gap-2.5 sm:gap-7 grid-cols-2 sm:grid-cols-[1.8fr_repeat(3,1fr)] sm:[grid-auto-rows:1fr]"
          >
            {/* Feature Card */}
            <FeatureCard post={feature} />

            {/* Small Cards */}
            {smalls.map((post, i) => (
              <SmallCard key={post.id} post={post} index={i + 1} />
            ))}
          </div>
        </ShareSectionClient>
      </div>
    </section>
  );
}

function FeatureCard({ post }: { post: AnyRow }) {
  const coverImage = post.cover_images?.[0] || post.cover_image_url || post.video_thumbnail_url;
  const isVideo = post.post_type === 'video';
  const authorName = post.profiles?.display_name || '匿名';
  const slug = post.slug || post.id;
  const href = `/zh/discover/${slug}`;

  return (
    <ShareCardLink
      href={href}
      slug={slug}
      title={post.title}
      coverImage={coverImage}
      authorName={authorName}
      className="block transition-transform hover:-translate-y-0.5 col-span-2 sm:col-span-1 sm:row-span-2"
      style={{ borderRadius: 'var(--ed-radius-lg)', overflow: 'hidden', background: 'var(--ed-surface)' }}
    >
      <div className="flex flex-col h-full">
        {/* Media */}
        <div className="relative flex-shrink-0" style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
          {isVideo && post.video_url ? (
            <ShareVideoMedia
              thumbnailUrl={coverImage}
              videoUrl={post.video_url}
              durationSeconds={post.video_duration_seconds}
              alt={post.title || ''}
            />
          ) : coverImage ? (
            <img src={coverImage} alt={post.title || ''} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: gradients[0] }}>
              <div className="absolute inset-0" style={{ opacity: 0.12, background: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0%, transparent 30%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 30%)' }} />
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 25%)' }} />

          {/* Badge */}
          <div
            className="absolute flex items-center gap-1 pointer-events-none"
            style={{
              top: 14, left: 14, padding: '4px 10px',
              background: 'var(--ed-accent)', color: 'var(--ed-paper)',
              borderRadius: 'var(--ed-radius-pill)', fontSize: 11.5, fontWeight: 500, zIndex: 2,
            }}
          >
            🔥 今日精选
          </div>
        </div>

        {/* Info bar (dark) */}
        <div
          className="flex-1 flex flex-col justify-center gap-2.5"
          style={{ background: 'var(--ed-ink)', padding: '16px 18px', color: 'var(--ed-paper)' }}
        >
          <div style={{
            fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 600,
            lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.title}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 12, color: 'rgba(251, 246, 236, 0.88)' }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--ed-amber)', color: 'var(--ed-ink)', fontSize: 10.5, fontWeight: 500 }}>
                {authorName[0]}
              </div>
              <span className="truncate">{authorName}</span>
            </div>
            <HeartButton postId={post.id} initialCount={post.like_count || 0} />
          </div>
        </div>
      </div>
    </ShareCardLink>
  );
}

function SmallCard({ post, index }: { post: AnyRow; index: number }) {
  const coverImage = post.cover_images?.[0] || post.cover_image_url || post.video_thumbnail_url;
  const isVideo = post.post_type === 'video';
  const authorName = post.profiles?.display_name || '匿名';
  const slug = post.slug || post.id;
  const href = `/zh/discover/${slug}`;
  const gradient = gradients[index % gradients.length];

  return (
    <ShareCardLink
      href={href}
      slug={slug}
      title={post.title}
      coverImage={coverImage}
      authorName={authorName}
      className="block relative transition-transform hover:-translate-y-0.5"
      style={{ aspectRatio: '3/4', borderRadius: 'var(--ed-radius-lg)', overflow: 'hidden', background: 'var(--ed-surface)' }}
    >
      {/* Media fills card */}
      {isVideo && post.video_url ? (
        <ShareVideoMedia
          thumbnailUrl={coverImage}
          videoUrl={post.video_url}
          durationSeconds={post.video_duration_seconds}
          alt={post.title || ''}
        />
      ) : coverImage ? (
        <img src={coverImage} alt={post.title || ''} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: gradient }}>
          <div className="absolute inset-0" style={{ opacity: 0.12, background: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0%, transparent 30%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 30%)' }} />
        </div>
      )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.78) 100%)' }} />

      {/* Info overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3" style={{ zIndex: 2, color: 'var(--ed-paper)' }}>
        <div style={{
          fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600,
          lineHeight: 1.4, marginBottom: 10, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          {post.title}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 12, color: 'rgba(251, 246, 236, 0.88)' }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--ed-amber)', color: 'var(--ed-ink)', fontSize: 10.5, fontWeight: 500 }}>
              {authorName[0]}
            </div>
            <span className="truncate">{authorName}</span>
          </div>
          <HeartButton postId={post.id} initialCount={post.like_count || 0} />
        </div>
      </div>
    </ShareCardLink>
  );
}
