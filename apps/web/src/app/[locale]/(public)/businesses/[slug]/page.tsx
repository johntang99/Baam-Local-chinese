import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { decodeRouteSlug } from '@/lib/slug';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { EditorialContainer } from '@/components/editorial/container';
import { EditorialCard } from '@/components/editorial/card';
import { pickBusinessDisplayName } from '@/lib/business-name';
import { LeadForm } from '@/components/shared/lead-form';
import { NewsletterForm } from '@/components/shared/newsletter-form';
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
    .from('businesses')
    .select('name_zh, name, display_name_zh, display_name, description_zh, short_desc_zh, logo_url, cover_image_url')
    .eq('slug', slug).eq('site_id', site.id).single();

  const biz = data as AnyRow | null;
  if (!biz) return { title: 'Not Found' };
  const name = pickBusinessDisplayName(biz, '');
  const desc = biz.short_desc_zh || biz.description_zh || '';
  return {
    title: `${name} · Baam`,
    description: desc.slice(0, 160),
    openGraph: { title: `${name} · Baam`, description: desc.slice(0, 160), images: biz.cover_image_url ? [biz.cover_image_url] : biz.logo_url ? [biz.logo_url] : [] },
  };
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u2606' : '') + '\u2606'.repeat(empty);
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function BusinessDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const supabase = await createClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('businesses')
    .select('*, business_locations(address_line1, address_line2, city, state, zip_code, latitude, longitude, hours_json), business_categories(categories(name_zh, slug))')
    .eq('slug', slug).eq('site_id', site.id).eq('is_active', true).single();

  const biz = data as AnyRow | null;
  if (error || !biz) notFound();

  const name = pickBusinessDisplayName(biz);
  const fullDesc = biz.full_desc_zh || '';
  const shortDesc = biz.short_desc_zh || biz.ai_summary_zh || biz.short_desc_en || '';
  const description = fullDesc || shortDesc;
  const shortDescPreview = (biz.short_desc_zh || biz.short_desc_en || '').slice(0, 100);
  const aiTags = ((biz.ai_tags || []) as string[]).filter(t => t !== 'GBP已认领');
  const faq = biz.ai_faq as Array<{ q: string; a: string }> | null;

  const loc = Array.isArray(biz.business_locations) ? biz.business_locations[0] : null;
  const fullAddress = loc ? [loc.address_line1, loc.address_line2, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ') : '';
  const encodedAddress = encodeURIComponent(fullAddress);
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  const mapUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodedAddress}` : '';

  const categories = Array.isArray(biz.business_categories) ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean) : [];

  const hoursJson = loc?.hours_json as Record<string, { open: string; close: string }> | null;
  const dayLabels: Record<string, string> = { mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' };
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const adminClient = createAdminClient();
  const storageFolder = `businesses/${slug}`;
  const { data: storageFiles } = await adminClient.storage.from('media').list(storageFolder, { limit: 20, sortBy: { column: 'name', order: 'asc' } });
  const photos = (storageFiles || []).filter((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)).map((f) => {
    const { data: urlData } = adminClient.storage.from('media').getPublicUrl(`${storageFolder}/${f.name}`);
    return { name: f.name, url: urlData.publicUrl };
  });
  const coverPhoto = photos[0] || null;
  const galleryPhotos = photos.slice(1);

  const socialLinks = [
    { url: biz.facebook_url, label: 'Facebook' },
    { url: biz.instagram_url, label: 'Instagram' },
    { url: biz.tiktok_url, label: 'TikTok' },
    { url: biz.youtube_url, label: 'YouTube' },
    { url: biz.twitter_url, label: 'X' },
  ].filter((s) => s.url);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawReviews } = await (supabase as any)
    .from('reviews').select('*, profiles:author_id(display_name)')
    .eq('business_id', biz.id).eq('status', 'approved')
    .order('source', { ascending: true }).order('rating', { ascending: false }).limit(15);
  const reviews = (rawReviews || []) as AnyRow[];
  const googleReviews = reviews.filter(r => r.source === 'google');
  const userReviews = reviews.filter(r => r.source !== 'google');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawArticleLinks } = await (supabase as any)
    .from('guide_business_links')
    .select('relation_type, priority, articles(id, slug, title_zh, title_en, ai_summary_zh, summary_zh, cover_image_url, content_vertical, source_type, source_url, source_name, editorial_status, published_at)')
    .eq('business_id', biz.id).order('priority', { ascending: false });
  const allLinkedArticles = ((rawArticleLinks || []) as AnyRow[]).filter((link) => link.articles?.editorial_status === 'published').map((link) => ({ ...link.articles, relation_type: link.relation_type }));
  const businessArticles = allLinkedArticles.filter((a) => a.source_type === 'business_website' || a.source_type === 'business_post');
  const relatedGuides = allLinkedArticles.filter((a) => a.source_type !== 'business_website' && a.source_type !== 'business_post');

  const videoUrl = biz.video_url as string | null;
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawDiscoverLinks } = await (supabase as any)
    .from('discover_post_businesses')
    .select('post_id, voice_posts(id, slug, title, cover_images, cover_image_url, like_count, profiles:author_id(display_name))')
    .eq('business_id', biz.id).limit(6);
  const discoverPosts = ((rawDiscoverLinks || []) as AnyRow[]).map((link) => link.voice_posts).filter(Boolean);

  return (
    <main>
      <BrowsingTracker title={name} source="商家详情" />
      {/* Hero / Cover */}
      {coverPhoto ? (
        <div className="relative" style={{ height: 'clamp(240px, 35vw, 380px)', overflow: 'hidden' }}>
          <img src={coverPhoto.url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(31,27,22,0.7) 0%, rgba(31,27,22,0.15) 50%, transparent 100%)' }} />
          <div className="absolute -bottom-10 left-0 right-0" style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px' }}>
            <div style={{ width: 80, height: 80, borderRadius: 'var(--ed-radius-lg)', border: '4px solid var(--ed-paper)', background: 'var(--ed-surface-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--ed-accent)' }}>{(name || '').charAt(0) || '🏢'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative" style={{ height: 'clamp(120px, 18vw, 160px)', background: 'var(--ed-paper-warm)' }}>
          <div className="absolute -bottom-10 left-0 right-0" style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '0 16px' }}>
            <div style={{ width: 80, height: 80, borderRadius: 'var(--ed-radius-lg)', border: '4px solid var(--ed-paper)', background: 'var(--ed-surface-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--ed-accent)' }}>{(name || '').charAt(0) || '🏢'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb + Name */}
      <EditorialContainer className="pt-14 pb-6">
        <nav className="flex items-center gap-1.5 flex-wrap mb-3" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ed-accent)] transition-colors">首页</Link>
          <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
          <Link href="/businesses" className="hover:text-[var(--ed-accent)] transition-colors">商家</Link>
          {categories.length > 0 && (
            <>
              <span style={{ color: 'var(--ed-line-strong)' }}>›</span>
              <span>{categories[0]}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 mb-2">
          <h1 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700 }}>{name}</h1>
          {biz.is_verified && (
            <svg width="24" height="24" viewBox="0 0 20 20" fill="var(--ed-accent)" style={{ flexShrink: 0 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 13 }}>
          {categories.map((cat: string) => (
            <span key={cat} style={{ padding: '3px 12px', borderRadius: 'var(--ed-radius-pill)', fontSize: 12, background: 'var(--ed-surface)', border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>{cat}</span>
          ))}
          <span style={{ color: 'var(--ed-amber)' }}>{renderStars(biz.avg_rating || 0)}</span>
          <span style={{ fontWeight: 600 }}>{biz.avg_rating?.toFixed(1) || '—'}</span>
          <span style={{ color: 'var(--ed-ink-muted)' }}>({biz.review_count || 0}评价)</span>
        </div>
        {aiTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {aiTags.map((tag) => (
              <span key={tag} style={{ padding: '3px 10px', borderRadius: 'var(--ed-radius-pill)', fontSize: 12, background: 'rgba(199,62,29,0.08)', color: 'var(--ed-accent)' }}>{tag}</span>
            ))}
          </div>
        )}
      </EditorialContainer>

      {/* CTA Buttons */}
      <EditorialContainer className="pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {biz.phone && (
            <a href={`tel:${biz.phone.replace(/[^+\d]/g, '')}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)' }}>
              📞 {biz.phone}
            </a>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>
              📍 查看地图
            </a>
          )}
          {biz.email && (
            <a href={`mailto:${biz.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>
              📧 发送邮件
            </a>
          )}
          {(biz.website_url || biz.website) && (
            <a href={biz.website_url || biz.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>
              🌐 访问网站
            </a>
          )}
        </div>
      </EditorialContainer>

      {/* Main Content + Sidebar */}
      <EditorialContainer className="pb-16">
        <div className="lg:flex lg:gap-10">
          <div className="flex-1 min-w-0">
            {/* Description */}
            {description && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>关于{name}</SectionTitle>
                <div className="editorial-prose" style={{ fontSize: 14.5, lineHeight: 1.8, color: 'var(--ed-ink-soft)' }}>
                  <style dangerouslySetInnerHTML={{ __html: `.editorial-prose h2{font-family:var(--ed-font-serif);font-size:17px;font-weight:600;margin:24px 0 10px}.editorial-prose p{margin-bottom:14px}.editorial-prose ul{padding-left:20px;margin-bottom:14px}.editorial-prose li{margin-bottom:4px}.editorial-prose a{color:var(--ed-accent);text-decoration:underline}` }} />
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                </div>
              </section>
            )}

            {/* Website link */}
            {(biz.website_url || biz.website) && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>官方网站</SectionTitle>
                <a href={biz.website_url || biz.website} target="_blank" rel="noopener noreferrer" className="group block">
                  <EditorialCard className="flex items-center gap-4 p-4">
                    <div style={{ width: 48, height: 48, borderRadius: 'var(--ed-radius-md)', background: 'rgba(199,62,29,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 20 }}>🌐</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{name} — 官方网站</p>
                      <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(biz.website_url || biz.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--ed-ink-muted)' }}><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </EditorialCard>
                </a>
              </section>
            )}

            {/* Business Articles */}
            {businessArticles.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>商家文章</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {businessArticles.map((article) => (
                    <Link key={article.id} href={`/guides/${article.slug}`} className="block group">
                      <EditorialCard className="flex overflow-hidden">
                        {article.cover_image_url && (
                          <div className="flex-shrink-0" style={{ width: 140 }}>
                            <img src={article.cover_image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div style={{ padding: '12px 16px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-surface)', color: 'var(--ed-ink-muted)', fontWeight: 500 }}>商家供稿</span>
                          <h4 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {article.title_zh || article.title_en}
                          </h4>
                        </div>
                      </EditorialCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Video */}
            {videoUrl && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>商家视频</SectionTitle>
                {youtubeId ? (
                  <div className="relative w-full overflow-hidden" style={{ paddingBottom: '56.25%', borderRadius: 'var(--ed-radius-lg)' }}>
                    <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}`} title="Business video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block" style={{ padding: 32, textAlign: 'center', background: 'var(--ed-surface)', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)' }}>
                    <span style={{ fontSize: 28 }}>🎬</span>
                    <p style={{ fontSize: 13, color: 'var(--ed-accent)', marginTop: 6 }}>观看视频</p>
                  </a>
                )}
              </section>
            )}

            {/* Photo Gallery */}
            {galleryPhotos.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>商家图片 ({photos.length})</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryPhotos.map((photo) => (
                    <div key={photo.name} className="relative group overflow-hidden" style={{ aspectRatio: '4/3', borderRadius: 'var(--ed-radius-md)' }}>
                      <img src={photo.url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section style={{ marginBottom: 40 }}>
              <SectionTitle>评价 ({biz.review_count || reviews.length})</SectionTitle>

              {biz.ai_review_summary && (
                <div style={{ padding: '16px 20px', background: 'var(--ed-surface)', border: '1px solid var(--ed-line)', borderLeft: '3px solid var(--ed-amber)', borderRadius: 'var(--ed-radius-md)', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ed-amber)', marginBottom: 6 }}>AI 评价摘要</div>
                  <p style={{ fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>{biz.ai_review_summary}</p>
                </div>
              )}

              {/* Rating summary */}
              <EditorialCard className="p-5 mb-5">
                <div className="flex items-center gap-4">
                  <div style={{ fontSize: 42, fontWeight: 700 }}>{biz.avg_rating?.toFixed(1) || '—'}</div>
                  <div>
                    <div style={{ color: 'var(--ed-amber)', fontSize: 18 }}>{renderStars(biz.avg_rating || 0)}</div>
                    <div style={{ fontSize: 13, color: 'var(--ed-ink-muted)', marginTop: 2 }}>{biz.review_count || 0} 条评价</div>
                  </div>
                </div>
              </EditorialCard>

              {/* Write review CTA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(199,62,29,0.04)', border: '1px solid rgba(199,62,29,0.12)', borderRadius: 'var(--ed-radius-md)', marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>去过这家店？</p>
                  <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginTop: 2 }}>分享你的真实体验</p>
                </div>
                <a href="#write-review" style={{ padding: '8px 18px', borderRadius: 'var(--ed-radius-md)', fontSize: 13, fontWeight: 500, background: 'var(--ed-accent)', color: 'var(--ed-paper)', flexShrink: 0 }}>写评价</a>
              </div>

              {/* User Reviews */}
              {userReviews.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-ink-muted)', marginBottom: 12 }}>Baam 社区评价 ({userReviews.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {userReviews.map((review) => {
                      const authorName = review.profiles?.display_name || review.title || '匿名用户';
                      return (
                        <EditorialCard key={review.id} className="p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ed-paper-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ed-accent)', flexShrink: 0 }}>
                              {authorName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{authorName}</span>
                                <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>{review.created_at ? new Date(review.created_at).toLocaleDateString('zh-CN') : ''}</span>
                              </div>
                              <div style={{ color: 'var(--ed-amber)', fontSize: 12, marginTop: 2 }}>{renderStars(review.rating || 0)}</div>
                            </div>
                          </div>
                          <p style={{ fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>{review.body || ''}</p>
                        </EditorialCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Google Reviews */}
              {googleReviews.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-ink-muted)', marginBottom: 12 }}>Google 评价 ({googleReviews.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {googleReviews.map((review) => {
                      const authorName = review.google_author_name || review.title || 'Google User';
                      const publishDate = review.google_publish_time || review.created_at;
                      return (
                        <EditorialCard key={review.id} className="p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ed-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ed-ink-soft)', flexShrink: 0 }}>
                              {authorName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{authorName}</span>
                                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-surface)', color: 'var(--ed-ink-muted)' }}>Google</span>
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>{publishDate ? new Date(publishDate).toLocaleDateString('zh-CN') : ''}</span>
                              </div>
                              <div style={{ color: 'var(--ed-amber)', fontSize: 12, marginTop: 2 }}>{renderStars(review.rating || 0)}</div>
                            </div>
                          </div>
                          <p style={{ fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>{review.body || ''}</p>
                        </EditorialCard>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--ed-ink-muted)', textAlign: 'right', marginTop: 8 }}>评价来源：Google Maps</p>
                </div>
              )}

              {reviews.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', background: 'var(--ed-surface)', borderRadius: 'var(--ed-radius-lg)', border: '1px solid var(--ed-line)' }}>
                  <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>暂无评价，成为第一个评价的人吧！</p>
                </div>
              )}

              {/* Write review form */}
              <EditorialCard id="write-review" className="p-6 mt-5">
                <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>写评价</h3>
                <div style={{ display: 'flex', gap: 4, fontSize: 28, color: 'var(--ed-ink-muted)', marginBottom: 12 }}>
                  {[1,2,3,4,5].map(star => (<span key={star} style={{ cursor: 'pointer' }}>&#9733;</span>))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginBottom: 12 }}>请登录后提交评价</p>
                <textarea placeholder="分享你的真实体验..." disabled rows={3} style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-md)', background: 'var(--ed-surface)', resize: 'none', color: 'var(--ed-ink-soft)' }} />
                <button disabled style={{ marginTop: 12, padding: '8px 20px', borderRadius: 'var(--ed-radius-md)', fontSize: 13, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)', opacity: 0.4, cursor: 'not-allowed', border: 'none' }}>
                  登录后提交评价
                </button>
              </EditorialCard>
            </section>

            {/* FAQ */}
            {faq && faq.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>常见问题</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {faq.map((item, idx) => (
                    <details key={idx} className="group" style={{ borderBottom: '1px solid var(--ed-line)' }}>
                      <summary className="flex items-center justify-between" style={{ padding: '14px 0', cursor: 'pointer', fontSize: 14.5, fontWeight: 600, listStyle: 'none' }}>
                        <span>{item.q}</span>
                        <svg className="flex-shrink-0 transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ed-ink-muted)' }}><path d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <div style={{ paddingBottom: 14, fontSize: 14, color: 'var(--ed-ink-soft)', lineHeight: 1.7 }}>{item.a}</div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Contact & Hours */}
            <section style={{ marginBottom: 40 }}>
              <SectionTitle>联系方式</SectionTitle>
              {(lat && lng || fullAddress) && (
                <div style={{ borderRadius: 'var(--ed-radius-lg)', overflow: 'hidden', marginBottom: 20, border: '1px solid var(--ed-line)' }}>
                  <iframe
                    className="w-full" style={{ height: 240 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                    src={lat && lng ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${lat},${lng}&zoom=15` : `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${encodedAddress}&zoom=15`}
                    allowFullScreen title={`${name} 地图位置`}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditorialCard className="p-5">
                  <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>联系信息</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {fullAddress && <ContactRow icon="📍" label="地址"><a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ed-accent)', fontSize: 13 }}>{fullAddress}</a></ContactRow>}
                    {biz.phone && <ContactRow icon="📞" label="电话"><a href={`tel:${biz.phone.replace(/[^+\d]/g, '')}`} style={{ color: 'var(--ed-accent)', fontSize: 13 }}>{biz.phone}</a></ContactRow>}
                    {biz.email && <ContactRow icon="📧" label="邮箱"><a href={`mailto:${biz.email}`} style={{ color: 'var(--ed-accent)', fontSize: 13 }}>{biz.email}</a></ContactRow>}
                    {(biz.website_url || biz.website) && <ContactRow icon="🌐" label="网站"><a href={biz.website_url || biz.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ed-accent)', fontSize: 13, wordBreak: 'break-all' }}>{(biz.website_url || biz.website).replace(/^https?:\/\/(www\.)?/, '')}</a></ContactRow>}
                    {biz.wechat_id && <ContactRow icon="💬" label="微信"><span style={{ fontSize: 13, color: 'var(--ed-ink-soft)' }}>{biz.wechat_id}</span></ContactRow>}
                    {socialLinks.length > 0 && (
                      <div style={{ paddingTop: 10, borderTop: '1px solid var(--ed-line)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {socialLinks.map((s) => (
                          <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 12px', fontSize: 12, border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-pill)', color: 'var(--ed-ink-soft)' }}>{s.label}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </EditorialCard>
                <EditorialCard className="p-5">
                  <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>营业时间</h3>
                  {hoursJson && Object.keys(hoursJson).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dayOrder.map((day) => {
                        const hours = hoursJson[day];
                        return (
                          <div key={day} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 500, color: 'var(--ed-ink-soft)', width: 32 }}>{dayLabels[day]}</span>
                            {hours ? <span>{hours.open} - {hours.close}</span> : <span style={{ color: 'var(--ed-ink-muted)' }}>休息</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>营业时间信息即将更新</p>
                  )}
                </EditorialCard>
              </div>
            </section>

            {/* Discover Posts */}
            <section style={{ marginBottom: 40 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <SectionTitle noMargin>社区笔记</SectionTitle>
                <Link href={`/discover/new-post?business=${biz.slug}`} style={{ fontSize: 13, color: 'var(--ed-accent)', fontWeight: 500 }}>+ 写笔记</Link>
              </div>
              {discoverPosts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {discoverPosts.map((post: AnyRow) => {
                    const coverImage = post.cover_images?.[0] || post.cover_image_url;
                    const authorName = post.profiles?.display_name || '匿名';
                    return (
                      <Link key={post.id} href={`/discover/${post.slug || post.id}`} className="group block">
                        <EditorialCard className="h-full overflow-hidden">
                          <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                            {coverImage ? (
                              <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--ed-paper-warm)' }}><span style={{ fontSize: 20, opacity: 0.4 }}>📝</span></div>
                            )}
                          </div>
                          <div style={{ padding: '10px 12px' }}>
                            <h3 style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 2 }}>{post.title}</h3>
                            <span style={{ fontSize: 11, color: 'var(--ed-ink-muted)' }}>{authorName}</span>
                          </div>
                        </EditorialCard>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', background: 'var(--ed-surface)', borderRadius: 'var(--ed-radius-lg)', border: '1px solid var(--ed-line)', fontSize: 13, color: 'var(--ed-ink-muted)' }}>
                  还没有笔记，来写第一篇吧！
                </div>
              )}
            </section>

            {/* Related Guides */}
            {relatedGuides.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <SectionTitle>相关生活指南</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  {relatedGuides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="block group">
                      <EditorialCard className="p-5 h-full">
                        <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'var(--ed-tag-green-bg)', color: 'var(--ed-tag-green-text)', fontWeight: 500 }}>生活指南</span>
                        <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.45, marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {guide.title_zh || guide.title_en}
                        </h3>
                        {(guide.ai_summary_zh || guide.summary_zh) && (
                          <p style={{ fontSize: 12.5, color: 'var(--ed-ink-soft)', marginTop: 4, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {guide.ai_summary_zh || guide.summary_zh}
                          </p>
                        )}
                      </EditorialCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block flex-shrink-0" style={{ width: 280 }}>
            <div className="sticky" style={{ top: 100 }}>
              <EditorialCard className="p-5 mb-5" id="lead-form">
                <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>咨询这家商家</h3>
                <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginBottom: 16 }}>填写信息，商家将尽快与您联系</p>
                <LeadForm businessId={biz.id} sourceType="business_page" />
              </EditorialCard>
              <div style={{ background: 'var(--ed-surface-elev)', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)', padding: '20px' }}>
                <h3 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>订阅本地周报</h3>
                <p style={{ fontSize: 12, color: 'var(--ed-ink-soft)', marginBottom: 14 }}>每周精选本地新闻、指南、活动</p>
                <NewsletterForm source="business_detail" />
              </div>
            </div>
          </div>
        </div>
      </EditorialContainer>

      {/* Sticky mobile CTA */}
      {(biz.phone || biz.website_url || biz.website) && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40" style={{ background: 'rgba(251,246,236,0.95)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--ed-line)' }}>
          <div className="flex items-center gap-2" style={{ padding: '10px 16px', maxWidth: 768, margin: '0 auto' }}>
            {biz.phone && (
              <a href={`tel:${biz.phone.replace(/[^+\d]/g, '')}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, background: 'var(--ed-ink)', color: 'var(--ed-paper)' }}>
                📞 拨打电话
              </a>
            )}
            {(biz.website_url || biz.website) && (
              <a href={biz.website_url || biz.website} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 'var(--ed-radius-md)', fontSize: 13.5, fontWeight: 500, border: '1px solid var(--ed-line)', color: 'var(--ed-ink-soft)' }}>
                🌐 访问网站
              </a>
            )}
          </div>
        </div>
      )}
      {(biz.phone || biz.website_url || biz.website) && <div className="lg:hidden h-20" aria-hidden="true" />}
    </main>
  );
}

function SectionTitle({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: noMargin ? 0 : 16 }}>
      <div style={{ width: 3, height: 18, background: 'var(--ed-accent)', borderRadius: 2 }} />
      <h2 style={{ fontFamily: 'var(--ed-font-serif)', fontSize: 18, fontWeight: 700 }}>{children}</h2>
    </div>
  );
}

function ContactRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 12, color: 'var(--ed-ink-muted)', marginBottom: 2 }}>{label}</p>
        {children}
      </div>
    </div>
  );
}
