import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { LeadForm } from '@/components/shared/lead-form';
import { NewsletterForm } from '@/components/shared/newsletter-form';
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
    .from('businesses')
    .select('name_zh, name, display_name_zh, display_name, description_zh, short_desc_zh, logo_url, cover_image_url')
    .eq('slug', slug)
    .single();

  const biz = data as AnyRow | null;
  if (!biz) return { title: 'Not Found' };

  const name = biz.display_name_zh || biz.name_zh || biz.display_name || biz.name || '';
  const desc = biz.short_desc_zh || biz.description_zh || '';

  return {
    title: `${name} · Baam`,
    description: desc.slice(0, 160),
    openGraph: {
      title: `${name} · Baam`,
      description: desc.slice(0, 160),
      images: biz.cover_image_url
        ? [biz.cover_image_url]
        : biz.logo_url
          ? [biz.logo_url]
          : [],
    },
  };
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u2606' : '') + '\u2606'.repeat(empty);
}

/** Extract YouTube video ID for embedding */
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function BusinessDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch business with location and categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('businesses')
    .select('*, business_locations(address_line1, address_line2, city, state, zip_code, latitude, longitude, hours_json), business_categories(categories(name_zh, slug))')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  const biz = data as AnyRow | null;
  if (error || !biz) notFound();

  const name = biz.display_name_zh || biz.name_zh || biz.display_name || biz.name;
  // Prefer full description, fallback to short, then AI summary
  const fullDesc = biz.full_desc_zh || '';
  const shortDesc = biz.short_desc_zh || biz.ai_summary_zh || biz.short_desc_en || '';
  const description = fullDesc || shortDesc;
  const shortDescPreview = (biz.short_desc_zh || biz.short_desc_en || '').slice(0, 100);
  const aiTags = ((biz.ai_tags || []) as string[]).filter(t => t !== 'GBP已认领');
  const faq = biz.ai_faq as Array<{ q: string; a: string }> | null;

  // Get location from joined data
  const loc = Array.isArray(biz.business_locations) ? biz.business_locations[0] : null;
  const fullAddress = loc
    ? [loc.address_line1, loc.address_line2, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ')
    : '';
  const encodedAddress = encodeURIComponent(fullAddress);
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  const mapUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodedAddress}` : '';

  // Get categories from joined data
  const categories = Array.isArray(biz.business_categories)
    ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_zh).filter(Boolean)
    : [];

  // Get business hours from location
  const hoursJson = loc?.hours_json as Record<string, { open: string; close: string }> | null;
  const dayLabels: Record<string, string> = {
    mon: '周一', tue: '周二', wed: '周三', thu: '周四',
    fri: '周五', sat: '周六', sun: '周日',
  };
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // Get photos from Supabase Storage (images uploaded via admin)
  const adminClient = createAdminClient();
  const storageFolder = `businesses/${slug}`;
  const { data: storageFiles } = await adminClient.storage.from('media').list(storageFolder, { limit: 20, sortBy: { column: 'name', order: 'asc' } });
  const photos = (storageFiles || [])
    .filter((f) => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
    .map((f) => {
      const { data: urlData } = adminClient.storage.from('media').getPublicUrl(`${storageFolder}/${f.name}`);
      return { name: f.name, url: urlData.publicUrl };
    });
  const coverPhoto = photos[0] || null;
  const galleryPhotos = photos.slice(1);

  // Social media links
  const socialLinks = [
    { url: biz.facebook_url, label: 'Facebook', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    )},
    { url: biz.instagram_url, label: 'Instagram', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
    )},
    { url: biz.tiktok_url, label: 'TikTok', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
    )},
    { url: biz.youtube_url, label: 'YouTube', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    )},
    { url: biz.twitter_url, label: 'Twitter / X', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    )},
  ].filter((s) => s.url);

  // Fetch reviews for this business
  const { data: rawReviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const reviews = (rawReviews || []) as AnyRow[];

  // Fetch articles linked to this business via guide_business_links
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawArticleLinks } = await (supabase as any)
    .from('guide_business_links')
    .select('relation_type, priority, articles(id, slug, title_zh, title_en, ai_summary_zh, summary_zh, cover_image_url, content_vertical, source_type, source_url, source_name, editorial_status, published_at)')
    .eq('business_id', biz.id)
    .order('priority', { ascending: false });

  const allLinkedArticles = ((rawArticleLinks || []) as AnyRow[])
    .filter((link) => link.articles?.editorial_status === 'published')
    .map((link) => ({ ...link.articles, relation_type: link.relation_type }));

  // Split into business articles vs editorial guides
  const businessArticles = allLinkedArticles.filter((a) =>
    a.source_type === 'business_website' || a.source_type === 'business_post'
  );
  const relatedGuides = allLinkedArticles.filter((a) =>
    a.source_type !== 'business_website' && a.source_type !== 'business_post'
  );

  // Video embed
  const videoUrl = biz.video_url as string | null;
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;

  return (
    <main>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-text-muted">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <Link href="/businesses" className="hover:text-primary">商家</Link>
          {categories.length > 0 && (
            <>
              <span>/</span>
              <span className="hover:text-primary">{categories[0]}</span>
            </>
          )}
          <span>/</span>
          <span className="text-text-secondary">{name}</span>
        </nav>
      </div>

      {/* Hero / Cover Image */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="relative rounded-xl overflow-hidden">
          {coverPhoto ? (
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <img
                src={coverPhoto.url}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="relative w-full bg-gradient-to-br from-blue-200 via-blue-100 to-teal-100" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-blue-300">
                  <svg className="w-16 h-16 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm opacity-40">商家图片</p>
                </div>
              </div>
            </div>
          )}
          {/* Logo overlay */}
          <div className="absolute -bottom-10 left-6 w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-4 border-white bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg flex items-center justify-center">
            <span className="text-3xl sm:text-4xl text-white font-bold">
              {(name || '').charAt(0)}
            </span>
          </div>
        </div>
      </section>

      {/* Business Header */}
      <section className="max-w-7xl mx-auto px-4 pt-14 sm:pt-16 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {/* Name + Verified */}
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{name}</h1>
              {biz.is_verified && (
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {/* Core info row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
              {categories.map((cat: string) => (
                <span key={cat} className="badge badge-blue">{cat}</span>
              ))}
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">{renderStars(biz.avg_rating || 0)}</span>
                <span className="font-semibold">{biz.avg_rating?.toFixed(1) || '—'}</span>
                <span className="text-text-muted">({biz.review_count || 0}评价)</span>
              </div>
              {biz.region && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary">{biz.region}</span>
                </>
              )}
              {biz.is_open !== undefined && (
                biz.is_open ? (
                  <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    现在营业
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    已关门
                  </span>
                )
              )}
            </div>
            {/* AI Recommendation Tags */}
            {aiTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {aiTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Buttons — click-to-action */}
      <section className="max-w-7xl mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {biz.phone && (
            <a
              href={`tel:${biz.phone.replace(/[^+\d]/g, '')}`}
              className="flex items-center justify-center gap-2 h-11 bg-primary text-text-inverse text-sm font-medium rounded-lg hover:opacity-90 transition"
            >
              <span>📞</span> {biz.phone}
            </a>
          )}
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-11 bg-bg-card border border-border text-sm font-medium rounded-lg hover:bg-border-light transition"
            >
              <span>📍</span> 查看地图
            </a>
          )}
          {biz.email && (
            <a
              href={`mailto:${biz.email}`}
              className="flex items-center justify-center gap-2 h-11 bg-bg-card border border-border text-sm font-medium rounded-lg hover:bg-border-light transition"
            >
              <span>📧</span> 发送邮件
            </a>
          )}
          {(biz.website_url || biz.website) && (
            <a
              href={biz.website_url || biz.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-11 bg-bg-card border border-border text-sm font-medium rounded-lg hover:bg-border-light transition"
            >
              <span>🌐</span> 访问网站
            </a>
          )}
        </div>
      </section>

      {/* Social Media Links */}
      {socialLinks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-4">
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 bg-bg-card border border-border text-sm rounded-lg hover:bg-border-light transition text-text-secondary hover:text-text-primary"
                title={social.label}
              >
                {social.icon}
                <span className="hidden sm:inline">{social.label}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Main Content + Sidebar */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="lg:flex lg:gap-8">

          {/* Main Content Column */}
          <div className="flex-1 min-w-0">

            {/* ===== Overview Section ===== */}
            <h2 className="text-lg font-bold mb-4 mt-6 flex items-center gap-2" id="overview">
              概述
            </h2>

            {/* AI Description */}
            {description && (
              <div className="ai-summary-card mb-6">
                <h3 className="font-semibold text-sm mb-2">关于{name}</h3>
                <div className="text-sm leading-relaxed prose prose-sm max-w-none [&_p]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Website Link Preview — FB-style card */}
            {(biz.website_url || biz.website) && (
              <div className="mb-6">
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  官方网站
                </h3>
                <a
                  href={biz.website_url || biz.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block card overflow-hidden hover:border-primary/30 transition-colors group"
                >
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {name} — 官方网站
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {(biz.website_url || biz.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                      </p>
                      {shortDescPreview && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{shortDescPreview}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-text-muted flex-shrink-0 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              </div>
            )}

            {/* Business Articles (from business website) */}
            {businessArticles.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  商家文章
                </h3>
                <div className="space-y-3">
                  {businessArticles.map((article) => {
                    const domain = (article.source_url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
                    return (
                      <Link
                        key={article.id}
                        href={`/guides/${article.slug}`}
                        className="card overflow-hidden block hover:border-primary/30 transition-colors group"
                      >
                        <div className="flex">
                          {article.cover_image_url && (
                            <div className="w-28 sm:w-36 flex-shrink-0">
                              <img src={article.cover_image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-3 sm:p-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">商家供稿</span>
                              {domain && <span className="text-xs text-text-muted">{domain}</span>}
                            </div>
                            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {article.title_zh || article.title_en}
                            </h4>
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                              {article.ai_summary_zh || article.summary_zh || ''}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Video Section */}
            {videoUrl && (
              <div className="mb-6">
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  商家视频
                </h3>
                {youtubeId ? (
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title="Business video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block card p-5 text-center hover:bg-border-light transition"
                  >
                    <span className="text-2xl">🎬</span>
                    <p className="text-sm text-primary mt-1">观看视频</p>
                  </a>
                )}
              </div>
            )}

            {/* Photo Gallery */}
            {galleryPhotos.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  商家图片 ({photos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryPhotos.map((photo) => (
                    <div key={photo.name} className="relative aspect-[4/3] rounded-lg overflow-hidden group">
                      <img
                        src={photo.url}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== Reviews Section ===== */}
            <h2 className="text-lg font-bold mb-4 mt-8 flex items-center gap-2" id="reviews">
              评价 ({biz.review_count || reviews.length})
            </h2>

            {/* AI Sentiment Summary */}
            {biz.ai_review_summary && (
              <div className="ai-summary-card mb-6">
                <h3 className="font-semibold text-sm mb-2">AI评价摘要</h3>
                <p className="text-sm text-text-secondary">{biz.ai_review_summary}</p>
              </div>
            )}

            {/* Rating Distribution */}
            <div className="card p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="text-center sm:text-left flex-shrink-0">
                  <div className="text-5xl font-bold">{biz.avg_rating?.toFixed(1) || '—'}</div>
                  <div className="text-yellow-500 text-lg mt-1">{renderStars(biz.avg_rating || 0)}</div>
                  <div className="text-sm text-text-muted mt-1">{biz.review_count || 0} 条评价</div>
                </div>
              </div>
            </div>

            {/* Individual Review Cards */}
            {reviews.length > 0 ? (
              <div className="space-y-4 mb-6">
                {reviews.map((review) => (
                  <div key={review.id} className="card p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                        {(review.author_name || '匿').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{review.author_name || '匿名用户'}</span>
                          <span className="text-xs text-text-muted">
                            {review.created_at
                              ? new Date(review.created_at).toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : ''}
                          </span>
                        </div>
                        <div className="text-yellow-500 text-xs mt-0.5">
                          {renderStars(review.rating || 0)}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {review.body_zh || review.body || review.content || ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center mb-6">
                <p className="text-text-muted text-sm">暂无评价</p>
              </div>
            )}

            {/* ===== FAQ Section ===== */}
            {faq && faq.length > 0 && (
              <>
                <h2 className="text-lg font-bold mb-4 mt-8 flex items-center gap-2" id="faq">
                  常见问题
                </h2>

                <div className="ai-summary-card mb-4">
                  <h3 className="font-semibold text-sm mb-1">AI 智能问答</h3>
                  <p className="text-xs text-text-muted">以下常见问题由 AI 根据商家信息和用户评价自动生成</p>
                </div>

                <div className="space-y-3 mb-6">
                  {faq.map((item, idx) => (
                    <details key={idx} className="card overflow-hidden group">
                      <summary className="flex items-center justify-between p-5 text-left cursor-pointer hover:bg-border-light/50 transition list-none [&::-webkit-details-marker]:hidden">
                        <span className="font-medium text-sm pr-4">{item.q}</span>
                        <svg className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-5 pb-5">
                        <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}

            {/* ===== Contact & Hours Section ===== */}
            <h2 className="text-lg font-bold mb-4 mt-8 flex items-center gap-2" id="contact">
              联系方式
            </h2>

            {/* Google Map Embed */}
            {(lat && lng || fullAddress) && (
              <div className="rounded-xl overflow-hidden mb-6 border border-border">
                <iframe
                  className="w-full h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={lat && lng
                    ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${lat},${lng}&zoom=15`
                    : `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${encodedAddress}&zoom=15`
                  }
                  allowFullScreen
                  title={`${name} 地图位置`}
                />
              </div>
            )}

            {/* Two-column: Contact Info (left) + Hours (right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Left: Contact Details */}
              <div className="card p-5">
                <h3 className="font-semibold text-base mb-4">联系信息</h3>
                <div className="space-y-4">
                  {fullAddress && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">地址</p>
                        <a
                          href={mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {fullAddress}
                        </a>
                      </div>
                    </div>
                  )}
                  {biz.phone && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">电话</p>
                        <a href={`tel:${biz.phone.replace(/[^+\d]/g, '')}`} className="text-sm text-primary hover:underline">{biz.phone}</a>
                      </div>
                    </div>
                  )}
                  {biz.email && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">邮箱</p>
                        <a href={`mailto:${biz.email}`} className="text-sm text-primary hover:underline">{biz.email}</a>
                      </div>
                    </div>
                  )}
                  {(biz.website_url || biz.website) && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">网站</p>
                        <a href={biz.website_url || biz.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{biz.website_url || biz.website}</a>
                      </div>
                    </div>
                  )}
                  {biz.wechat_id && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">微信</p>
                        <p className="text-sm text-text-secondary">{biz.wechat_id}</p>
                      </div>
                    </div>
                  )}
                  {/* Social Media */}
                  {socialLinks.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm font-medium mb-2">社交媒体</p>
                      <div className="flex flex-wrap gap-2">
                        {socialLinks.map((social) => (
                          <a
                            key={social.label}
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-3 bg-bg-page border border-border text-xs rounded-lg hover:bg-border-light transition text-text-secondary hover:text-text-primary"
                            title={social.label}
                          >
                            {social.icon}
                            <span className="hidden sm:inline">{social.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Business Hours */}
              <div className="card p-5">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  营业时间
                </h3>
                {hoursJson && Object.keys(hoursJson).length > 0 ? (
                  <div className="space-y-3">
                    {dayOrder.map((day) => {
                      const hours = hoursJson[day];
                      return (
                        <div key={day} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-text-secondary w-10">{dayLabels[day]}</span>
                          {hours ? (
                            <span className="text-text-primary">{hours.open} - {hours.close}</span>
                          ) : (
                            <span className="text-text-muted">休息</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">营业时间信息即将更新</p>
                )}
              </div>
            </div>

            {/* Related Guides (editorial) */}
            {relatedGuides.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4">📚 相关生活指南</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {relatedGuides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="card p-4 block hover:border-primary/30 transition-colors group">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">生活指南</span>
                      <h3 className="font-medium text-sm line-clamp-2 mt-1 group-hover:text-primary transition-colors">{guide.title_zh || guide.title_en}</h3>
                      {(guide.ai_summary_zh || guide.summary_zh) && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{guide.ai_summary_zh || guide.summary_zh}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0 space-y-6 mt-6 lg:mt-0">

            {/* Lead Capture Form */}
            <div className="lead-capture" id="lead-form">
              <h3 className="font-bold text-base mb-1">咨询这家商家</h3>
              <p className="text-xs text-text-muted mb-4">填写信息，商家将尽快与您联系</p>
              <LeadForm businessId={biz.id} sourceType="business_page" />
            </div>

            {/* Newsletter */}
            <div className="bg-bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">📬 订阅本地周报</h3>
              <p className="text-xs text-text-secondary mb-3">每周精选本地新闻、指南、活动</p>
              <NewsletterForm source="business_detail" />
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
