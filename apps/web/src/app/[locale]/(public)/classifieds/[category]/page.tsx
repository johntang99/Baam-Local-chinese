import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { EditorialPageHeader } from '@/components/editorial/page-header';
import { EditorialContainer } from '@/components/editorial/container';
import { pickBusinessDisplayName } from '@/lib/business-name';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const categoryMap: Record<string, { dbFilter: string[]; emoji: string; title: string }> = {
  housing: { dbFilter: ['housing_rent', 'housing_buy'], emoji: '🏠', title: '房屋出租' },
  jobs: { dbFilter: ['jobs'], emoji: '💼', title: '诚聘招工' },
  secondhand: { dbFilter: ['secondhand'], emoji: '📦', title: '二手商品' },
  help: { dbFilter: ['services', 'general'], emoji: '🙋', title: '寻求帮助' },
};

interface Props {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface SidebarConfig {
  title: string;
  viewAllHref: string;
  rootCategorySlugs: string[];
  icon: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = categoryMap[category];
  if (!cat) return { title: 'Not Found' };
  return { title: `${cat.title} · 分类信息 · Baam` };
}

const PAGE_SIZE = 50;
type PaginationToken = number | 'ellipsis';

function formatPostedAt(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function buildPaginationTokens(totalPages: number, currentPage: number): PaginationToken[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const out: PaginationToken[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function parseStructuredSections(text: string): { sections: Record<string, string>; remainder: string } {
  if (!text) return { sections: {}, remainder: '' };
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: Record<string, string> = {};
  const remainderLines: string[] = [];
  let currentKey = '';

  for (const line of lines) {
    const m = line.match(/^【([^】]+)】\s*(.*)$/);
    if (m) {
      currentKey = m[1].trim();
      const initial = m[2]?.trim() || '';
      if (!sections[currentKey]) sections[currentKey] = '';
      if (initial) sections[currentKey] = initial;
      continue;
    }

    if (currentKey) {
      sections[currentKey] = sections[currentKey] ? `${sections[currentKey]}\n${line}` : line;
    } else {
      remainderLines.push(line);
    }
  }

  return {
    sections,
    remainder: remainderLines.join('\n').trim(),
  };
}

function replaceProtectedEmailPlaceholder(text: string, email: string): string {
  if (!text) return '';
  if (!email) return text;
  return text.replace(/\[email(?:\s|&nbsp;|&#160;|\u00a0)*protected\]/gi, email);
}

function getCardDescription(item: AnyRow): string {
  const body = typeof item.body === 'string' ? item.body.trim() : '';
  if (!body) return '';
  const contactEmail = String(item.contact_email || '').trim();
  const safeEmail = contactEmail && contactEmail.toLowerCase() !== 'guest-sam1@gmail.com' ? contactEmail : '';

  // For rent/jobs/secondhand imports, prioritize the readable supplemental section.
  if (item.category === 'housing_rent' || item.category === 'jobs' || item.category === 'secondhand') {
    const { sections, remainder } = parseStructuredSections(body);
    const supplement = (sections['补充说明'] || '').trim();
    if (supplement) return replaceProtectedEmailPlaceholder(supplement, safeEmail);
    if (remainder) return replaceProtectedEmailPlaceholder(remainder, safeEmail);
  }

  return replaceProtectedEmailPlaceholder(body, safeEmail);
}

export default async function ClassifiedCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const cat = categoryMap[category];
  if (!cat) notFound();

  const supabase = await createClient();
  const site = await getCurrentSite();
  const requestedPage = typeof sp.page === 'string' ? Number(sp.page) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const { count } = await supabase
    .from('classifieds')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .in('category', cat.dbFilter)
    .eq('status', 'active');

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rawListings } = await supabase
    .from('classifieds')
    .select('*, profiles:author_id(display_name)')
    .eq('site_id', site.id)
    .in('category', cat.dbFilter)
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const listings = (rawListings || []) as AnyRow[];
  const isHelp = category === 'help';
  const sidebarConfig: SidebarConfig | null =
    category === 'housing'
      ? {
          title: '精选地产商家',
          viewAllHref: '/businesses?cat=real-estate',
          rootCategorySlugs: ['real-estate', 'realestate'],
          icon: '🏠',
        }
      : category === 'secondhand'
        ? {
            title: '精选零售商家',
            viewAllHref: '/businesses?cat=shopping-retail',
            rootCategorySlugs: ['shopping-retail'],
            icon: '🛍️',
          }
        : category === 'jobs'
          ? {
              title: '精选餐厅商家',
              viewAllHref: '/businesses?cat=food-dining',
              rootCategorySlugs: ['food-dining'],
              icon: '🍽️',
            }
          : null;
  const hasSidebar = Boolean(sidebarConfig);
  const buildPageHref = (targetPage: number) => `/classifieds/${category}${targetPage > 1 ? `?page=${targetPage}` : ''}`;
  const paginationTokens = buildPaginationTokens(totalPages, currentPage);

  let sidebarBusinesses: AnyRow[] = [];
  let sidebarCoverMap: Record<string, string> = {};
  if (sidebarConfig) {
    const { data: rawBusinessCategories } = await supabase
      .from('categories')
      .select('id, parent_id, slug')
      .eq('type', 'business')
      .eq('site_scope', 'zh');

    const bizCategories = (rawBusinessCategories || []) as AnyRow[];
    const rootCategory = bizCategories.find((c) => sidebarConfig.rootCategorySlugs.includes(c.slug));
    if (rootCategory) {
      const sidebarCatIds = bizCategories
        .filter((c) => c.id === rootCategory.id || c.parent_id === rootCategory.id)
        .map((c) => c.id);

      if (sidebarCatIds.length > 0) {
        const { data: rawFeaturedSidebar } = await supabase
          .from('businesses')
          .select('id, slug, display_name, display_name_zh, avg_rating, review_count, address_full, phone, website_url, total_score, is_featured, business_categories!inner(category_id, is_primary)')
          .eq('site_id', site.id)
          .eq('status', 'active')
          .eq('is_active', true)
          .eq('is_featured', true)
          .eq('business_categories.is_primary', true)
          .in('business_categories.category_id', sidebarCatIds)
          .order('total_score', { ascending: false, nullsFirst: false })
          .limit(10);

        sidebarBusinesses = (rawFeaturedSidebar || []) as AnyRow[];

        // Keep sidebar populated with 10 cards even when featured is sparse.
        if (sidebarBusinesses.length < 10) {
          const pickedIds = new Set(sidebarBusinesses.map((b) => b.id));
          const { data: rawFallbackSidebar } = await supabase
            .from('businesses')
            .select('id, slug, display_name, display_name_zh, avg_rating, review_count, address_full, phone, website_url, total_score, is_featured, business_categories!inner(category_id, is_primary)')
            .eq('site_id', site.id)
            .eq('status', 'active')
            .eq('is_active', true)
            .eq('business_categories.is_primary', true)
            .in('business_categories.category_id', sidebarCatIds)
            .order('is_featured', { ascending: false })
            .order('total_score', { ascending: false, nullsFirst: false })
            .limit(30);

          const fallbackRows = ((rawFallbackSidebar || []) as AnyRow[]).filter((b) => !pickedIds.has(b.id));
          sidebarBusinesses = [...sidebarBusinesses, ...fallbackRows].slice(0, 10);
        }

        if (sidebarBusinesses.length > 0) {
          const adminSupa = createAdminClient();
          await Promise.all(
            sidebarBusinesses.map(async (biz) => {
              const folder = `businesses/${biz.slug}`;
              const { data: files } = await adminSupa.storage.from('media').list(folder, {
                limit: 1,
                sortBy: { column: 'name', order: 'desc' },
              });
              const first = (files || []).find((f) => f.name && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name));
              if (first) {
                const { data: urlData } = adminSupa.storage.from('media').getPublicUrl(`${folder}/${first.name}`);
                sidebarCoverMap[biz.id] = urlData.publicUrl;
              }
            }),
          );
        }
      }
    }
  }

  return (
    <main>
      <EditorialPageHeader
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '分类信息', href: '/classifieds' },
          { label: cat.title },
        ]}
        title={`${cat.emoji} ${cat.title}`}
        subtitle={`${totalCount} 条信息`}
        right={
          <Link href="/classifieds/new" style={{
            padding: '8px 20px', borderRadius: 'var(--ed-radius-md)',
            fontSize: 13.5, fontWeight: 500,
            background: 'var(--ed-ink)', color: 'var(--ed-paper)',
          }}>
            + 发布信息
          </Link>
        }
      />

      <EditorialContainer className="py-6 pb-16">
        <div className={hasSidebar ? 'flex flex-col lg:flex-row gap-6 items-start' : ''}>
          <div className={hasSidebar ? 'w-full lg:w-2/3' : 'w-full lg:w-2/3 mx-auto'}>
            <div className="flex items-center justify-between mb-6">
              <Link href="/classifieds" style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>← 返回分类</Link>
              <span style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>
                第 {currentPage} / {totalPages} 页
              </span>
            </div>

            {listings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <p style={{ fontSize: 48, marginBottom: 16 }}>{cat.emoji}</p>
                <p style={{ color: 'var(--ed-ink-soft)', fontSize: 15 }}>暂无{cat.title}信息</p>
                <Link href="/classifieds/new" style={{
                  display: 'inline-block', marginTop: 16,
                  padding: '8px 20px', borderRadius: 'var(--ed-radius-md)',
                  fontSize: 14, fontWeight: 500,
                  background: 'var(--ed-ink)', color: 'var(--ed-paper)',
                }}>
                  发布第一条信息
                </Link>
              </div>
            ) : (
              <>
                <div style={{ border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)', overflow: 'hidden' }}>
                  {listings.map((item, i) => {
                    const authorName = item.profiles?.display_name || '匿名';
                    const meta = item.metadata || {};
                    const cardDescription = getCardDescription(item);
                    return (
                      <Link
                        key={item.id}
                        href={`/classifieds/${category}/${item.slug}`}
                        className="grid items-start gap-4 transition-colors hover:!bg-[var(--ed-surface)]"
                        style={{
                          gridTemplateColumns: 'minmax(0,3fr) minmax(110px,1fr)',
                          padding: '16px 20px',
                          borderTop: i > 0 ? '1px solid var(--ed-line)' : 'none',
                          background: i % 2 === 0 ? '#ffffff' : 'transparent',
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.is_featured && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', background: 'rgba(212,160,23,0.12)', color: 'var(--ed-amber)', fontWeight: 500 }}>精选</span>}
                            <h3 style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h3>
                          </div>
                          {cardDescription && (
                            <p style={{ fontSize: 13, color: 'var(--ed-ink-soft)', lineHeight: 1.6, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cardDescription}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>
                            {meta.neighborhood && <span>{meta.neighborhood}</span>}
                            {meta.job_type && <span>{meta.job_type === 'full_time' ? '全职' : meta.job_type === 'part_time' ? '兼职' : meta.job_type === 'remote' ? '远程' : meta.job_type}</span>}
                            {meta.condition && <span>{meta.condition === 'new' ? '全新' : meta.condition === 'like_new' ? '9成新' : meta.condition === 'good' ? '8成新' : meta.condition}</span>}
                            <span>·</span>
                            <span>by {authorName}</span>
                            <span>·</span>
                            <span>{formatPostedAt(item.created_at)}</span>
                            {(item.reply_count || 0) > 0 && <span>· 💬 {item.reply_count}</span>}
                            {isHelp && (
                              <a
                                href={`/zh/helper-2?q=${encodeURIComponent(item.title)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '2px 8px', borderRadius: 'var(--ed-radius-pill)', fontSize: 10.5, fontWeight: 500, background: 'rgba(199,62,29,0.06)', color: 'var(--ed-accent)', border: '1px solid rgba(199,62,29,0.12)', marginLeft: 4 }}
                              >
                                问小帮手
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-right" style={{ color: 'var(--ed-ink)' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatPostedAt(item.created_at)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="mt-6">
                    <nav className="flex items-center justify-center gap-1" aria-label="分页">
                      <Link
                        href={currentPage > 1 ? buildPageHref(currentPage - 1) : '#'}
                        aria-disabled={currentPage <= 1}
                        style={{
                          minWidth: 44,
                          height: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12.5,
                          borderRadius: 8,
                          border: '1px solid var(--ed-line)',
                          color: currentPage > 1 ? 'var(--ed-ink)' : 'var(--ed-ink-muted)',
                          pointerEvents: currentPage > 1 ? 'auto' : 'none',
                          padding: '0 10px',
                        }}
                      >
                        上一页
                      </Link>

                      {paginationTokens.map((token, idx) => {
                        if (token === 'ellipsis') {
                          return <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: 'var(--ed-ink-muted)' }}>...</span>;
                        }
                        return (
                          <Link
                            key={token}
                            href={buildPageHref(token)}
                            style={{
                              width: 36,
                              height: 36,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              borderRadius: 8,
                              border: token === currentPage ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)',
                              background: token === currentPage ? 'var(--ed-ink)' : 'transparent',
                              color: token === currentPage ? 'var(--ed-paper)' : 'var(--ed-ink-soft)',
                              fontWeight: token === currentPage ? 600 : 400,
                            }}
                          >
                            {token}
                          </Link>
                        );
                      })}

                      <Link
                        href={currentPage < totalPages ? buildPageHref(currentPage + 1) : '#'}
                        aria-disabled={currentPage >= totalPages}
                        style={{
                          minWidth: 44,
                          height: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12.5,
                          borderRadius: 8,
                          border: '1px solid var(--ed-line)',
                          color: currentPage < totalPages ? 'var(--ed-ink)' : 'var(--ed-ink-muted)',
                          pointerEvents: currentPage < totalPages ? 'auto' : 'none',
                          padding: '0 10px',
                        }}
                      >
                        下一页
                      </Link>
                    </nav>
                    <p className="text-center mt-2" style={{ fontSize: 12, color: 'var(--ed-ink-muted)' }}>
                      每页 {PAGE_SIZE} 条，共 {totalCount} 条
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {sidebarConfig && (
            <aside className="w-full lg:w-1/3 lg:sticky lg:top-24 self-start">
              <div style={{ border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-lg)', background: '#fff', padding: 14 }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{sidebarConfig.title}</h3>
                  <Link href={sidebarConfig.viewAllHref} style={{ fontSize: 12, color: 'var(--ed-accent)', fontWeight: 500 }}>
                    查看全部 →
                  </Link>
                </div>

                {sidebarBusinesses.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--ed-ink-muted)' }}>暂无精选商家</p>
                ) : (
                  <div className="space-y-3">
                    {sidebarBusinesses.map((biz) => {
                      const displayName = pickBusinessDisplayName(biz, '');
                      const cover = sidebarCoverMap[biz.id];
                      const rating = Number(biz.avg_rating || 0);
                      const reviews = Number(biz.review_count || 0);
                      const website = biz.website_url || '';
                      return (
                        <Link
                          key={biz.id}
                          href={`/businesses/${biz.slug}`}
                          className="block transition-colors hover:!bg-[var(--ed-surface)]"
                          style={{ border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius-md)', overflow: 'hidden', background: '#fff' }}
                        >
                          {cover ? (
                            <img src={cover} alt={displayName} className="w-full object-cover" style={{ aspectRatio: '16/9' }} />
                          ) : (
                            <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'var(--ed-paper-warm)' }}>
                              <span style={{ fontSize: 24, opacity: 0.35 }}>{sidebarConfig.icon}</span>
                            </div>
                          )}
                          <div style={{ padding: '10px 11px' }}>
                            <h4 style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{displayName}</h4>
                            {reviews > 0 && (
                              <div style={{ fontSize: 11.5, color: 'var(--ed-ink-soft)', marginTop: 4 }}>
                                <span style={{ color: 'var(--ed-amber)' }}>★</span> {rating.toFixed(1)} ({reviews.toLocaleString()})
                              </div>
                            )}
                            {biz.address_full && (
                              <p style={{ fontSize: 11.5, color: 'var(--ed-ink-soft)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📍 {biz.address_full}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2" style={{ fontSize: 11.5, color: 'var(--ed-ink-soft)' }}>
                              <span>{biz.phone ? `📞 ${biz.phone}` : '电话 —'}</span>
                              {website ? <span style={{ color: 'var(--ed-accent)' }}>{extractDomain(website)}</span> : null}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </EditorialContainer>
    </main>
  );
}
