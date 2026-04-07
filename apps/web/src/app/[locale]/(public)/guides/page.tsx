import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('guides')} · Baam`,
    description: '纽约华人必备实用指南，AI整理，编辑审核，持续更新',
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

const GUIDE_VERTICALS = [
  'guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison',
  'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario',
];

const GUIDE_CATEGORY_ORDER = [
  'guide-new-immigrant',
  'guide-medical',
  'guide-education',
  'guide-housing',
  'guide-tax-business',
  'guide-dmv-transport',
  'guide-family',
  'guide-food-weekend',
  'guide-legal-docs',
  'guide-chinese-resources',
  'guide-new-in-town',
  'guide-government-howto',
  'guide-best-of',
];

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cat?: string }>;
}

export default async function GuidesListPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();
  const activeCategorySlug = (sp.cat || '').trim();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch all article categories for submenu.
  const { data: rawGuideCategories } = await supabase
    .from('categories_guide')
    .select('id, slug, name_zh, name_en, icon, sort_order, site_scope')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  const categories = (rawGuideCategories || []) as AnyRow[];
  const categoriesBySlug = new Map(categories.map((cat) => [String(cat.slug), cat]));
  const orderedCategories = GUIDE_CATEGORY_ORDER
    .map((slug) => categoriesBySlug.get(slug))
    .filter(Boolean) as AnyRow[];
  const visibleCategories = orderedCategories.length > 0 ? orderedCategories : categories;

  const activeCategoryId =
    activeCategorySlug && categoriesBySlug.get(activeCategorySlug)
      ? String(categoriesBySlug.get(activeCategorySlug)!.id)
      : '';

  // Fetch guide articles, newest first.
  let dataQuery = supabase
    .from('articles')
    .select('id, slug, title_zh, title_en, ai_summary_zh, summary_zh, content_vertical, published_at, category_id, audience_types, body_zh, view_count, cover_image_url')
    .eq('site_id', site.id)
    .in('content_vertical', GUIDE_VERTICALS)
    .eq('editorial_status', 'published')
    .order('published_at', { ascending: false })
    .limit(120);
  if (activeCategoryId) {
    dataQuery = dataQuery.eq('category_id', activeCategoryId);
  }
  const { data: rawArticles, error } = await dataQuery;
  const articles = (rawArticles || []) as AnyRow[];

  const featuredGuide = !activeCategoryId ? (articles[0] || null) : null;
  const recentGuides = !activeCategoryId ? articles.slice(1, 5) : [];
  const categoryGroups: { category: AnyRow; guides: AnyRow[] }[] = [];
  if (!activeCategoryId) {
    for (const cat of visibleCategories) {
      const catGuides = articles.filter((a) => String(a.category_id) === String(cat.id));
      if (catGuides.length > 0) {
        categoryGroups.push({ category: cat, guides: catGuides.slice(0, 4) });
      }
    }
  }

  return (
    <main>
      {/* Page Header */}
      <section className="bg-bg-card border-b border-border">
        <PageContainer className="py-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t('nav.guides', { defaultValue: '生活资讯' })}
          </h1>
          <p className="text-sm text-text-secondary">纽约华人必备实用指南，AI整理，编辑审核，持续更新</p>
        </PageContainer>
      </section>

      {/* Category Tab Bar */}
      <div className="bg-bg-card border-b border-border sticky top-16 z-40">
        <PageContainer>
          <div className="flex gap-1 overflow-x-auto py-3" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <Link
              href="/guides"
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full ${
                !activeCategoryId
                  ? 'bg-primary text-text-inverse'
                  : 'text-text-secondary bg-border-light hover:bg-primary-50 hover:text-primary transition'
              }`}
            >
              全部
            </Link>
            {visibleCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/guides?cat=${cat.slug}`}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full ${
                  activeCategoryId === String(cat.id)
                    ? 'bg-primary text-text-inverse'
                    : 'text-text-secondary bg-border-light hover:bg-primary-50 hover:text-primary transition'
                }`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name_zh || cat.name_en}
              </Link>
            ))}
          </div>
        </PageContainer>
      </div>

      <PageContainer className="py-6">
        {error ? (
          <p className="text-text-secondary py-8 text-center">加载指南时出错，请稍后重试。</p>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">📚</p>
            <p className="text-text-secondary">当前分类暂无文章</p>
            <p className="text-text-muted text-sm mt-1">请切换分类或稍后再看</p>
          </div>
        ) : (
          <div className="lg:flex lg:gap-8">
            <div className="flex-1 min-w-0 space-y-10">
              {!activeCategoryId && featuredGuide && (
                <section>
                  <div className="grid lg:grid-cols-5 gap-5">
                    <Link href={`/guides/${featuredGuide.slug}`} className="lg:col-span-3 block">
                      <Card className="cursor-pointer group overflow-hidden">
                        <div className={`relative h-56 sm:h-72 ${featuredGuide.cover_image_url ? '' : `bg-gradient-to-br ${getGradient(0)}`} flex items-end`}>
                          {featuredGuide.cover_image_url && (
                            <img
                              src={featuredGuide.cover_image_url}
                              alt={featuredGuide.title_zh || featuredGuide.title_en || 'Guide cover'}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                          <div className="relative p-5 sm:p-6 w-full">
                            <div className="flex items-center gap-2 mb-2">
                              {verticalConfig[featuredGuide.content_vertical] && (
                                <Badge className="bg-green-500 text-white hover:bg-green-500">
                                  {verticalConfig[featuredGuide.content_vertical].label}
                                </Badge>
                              )}
                              <Badge className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/20">编辑精选</Badge>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:underline decoration-2 underline-offset-4">
                              {featuredGuide.title_zh || featuredGuide.title_en}
                            </h2>
                          </div>
                        </div>
                        <div className="p-5">
                          {(featuredGuide.ai_summary_zh || featuredGuide.summary_zh) && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                              <p className="text-xs text-blue-800 leading-relaxed line-clamp-2">
                                {featuredGuide.ai_summary_zh || featuredGuide.summary_zh}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>

                    <div className="lg:col-span-2 space-y-4">
                      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">最近发布</h3>
                      {recentGuides.map((guide, idx) => {
                        const vertical = verticalConfig[guide.content_vertical] || { label: '指南', className: 'bg-gray-100 text-gray-700' };
                        return (
                          <Link key={guide.id} href={`/guides/${guide.slug}`} className="group block">
                            <Card className="p-4 flex gap-4 cursor-pointer hover:shadow-md transition-shadow">
                              {guide.cover_image_url ? (
                                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                                  <img
                                    src={guide.cover_image_url}
                                    alt={guide.title_zh || guide.title_en || 'Guide cover'}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <div className={`w-20 h-20 flex-shrink-0 rounded-lg bg-gradient-to-br ${getGradient(idx + 1)} flex items-center justify-center text-2xl`}>
                                  {getEmoji(guide.title_zh || guide.title_en || '', idx)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Badge variant="secondary">{vertical.label}</Badge>
                                  <span className="text-xs text-text-muted">{formatTimeAgo(guide.published_at)}</span>
                                </div>
                                <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition">
                                  {guide.title_zh || guide.title_en}
                                </h4>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {activeCategoryId ? (
                <section className="space-y-6">
                  <nav className="text-sm text-text-muted">
                    <Link href="/" className="hover:text-primary">首页</Link>
                    <span className="mx-2">&gt;</span>
                    <Link href="/guides" className="hover:text-primary">生活资讯</Link>
                    <span className="mx-2">&gt;</span>
                    <span className="text-text-primary font-medium">
                      {categoriesBySlug.get(activeCategorySlug)?.name_zh || categoriesBySlug.get(activeCategorySlug)?.name_en || '分类'}
                    </span>
                  </nav>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{categoriesBySlug.get(activeCategorySlug)?.icon || '📚'}</span>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {categoriesBySlug.get(activeCategorySlug)?.name_zh || categoriesBySlug.get(activeCategorySlug)?.name_en}
                        </h2>
                        <p className="text-sm text-text-secondary mt-1">
                          该分类共有 {articles.length} 篇实用指南
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-text-secondary">类型：</span>
                    <Badge className="px-3 py-1.5 text-sm bg-primary text-white">全部</Badge>
                    {Object.values(verticalConfig).slice(0, 4).map((v) => (
                      <Badge key={v.label} variant="muted" className="px-3 py-1.5 text-sm">
                        {v.label}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {articles.map((guide, idx) => {
                      const vertical = verticalConfig[guide.content_vertical] || { label: '指南', className: 'bg-gray-100 text-gray-700' };
                      const category = categories.find((cat) => String(cat.id) === String(guide.category_id));
                      return (
                        <Link key={guide.id} href={`/guides/${guide.slug}`} className="group block">
                          <Card className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                            {guide.cover_image_url ? (
                              <div className="h-40 overflow-hidden">
                                <img
                                  src={guide.cover_image_url}
                                  alt={guide.title_zh || guide.title_en || 'Guide cover'}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className={`h-40 bg-gradient-to-br ${getGradient(idx + 3)} flex items-center justify-center text-4xl`}>
                                {getEmoji(guide.title_zh || guide.title_en || '', idx)}
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary">{vertical.label}</Badge>
                                {category && <Badge variant="outline">{category.name_zh || category.name_en}</Badge>}
                              </div>
                              <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition">
                                {guide.title_zh || guide.title_en}
                              </h3>
                              <p className="text-xs text-text-muted">{formatTimeAgo(guide.published_at)}</p>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ) : (
                categoryGroups.map((group, groupIdx) => (
                  <section key={group.category.id || groupIdx}>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        {group.category.icon && <span className="text-2xl">{group.category.icon}</span>}
                        {group.category.name_zh || group.category.name_en}
                      </h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {group.guides.map((guide, idx) => {
                        const vertical = verticalConfig[guide.content_vertical] || { label: '指南', className: 'bg-gray-100 text-gray-700' };
                        return (
                          <Link key={guide.id} href={`/guides/${guide.slug}`} className="group block">
                            <Card className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                              {guide.cover_image_url ? (
                                <div className="h-40 overflow-hidden">
                                  <img
                                    src={guide.cover_image_url}
                                    alt={guide.title_zh || guide.title_en || 'Guide cover'}
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <div className={`h-40 bg-gradient-to-br ${getGradient(groupIdx * 4 + idx + 3)} flex items-center justify-center text-4xl`}>
                                  {getEmoji(guide.title_zh || guide.title_en || '', groupIdx * 4 + idx)}
                                </div>
                              )}
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary">{vertical.label}</Badge>
                                  <Badge variant="outline">{group.category.name_zh || group.category.name_en}</Badge>
                                </div>
                                <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition">
                                  {guide.title_zh || guide.title_en}
                                </h3>
                                <p className="text-xs text-text-muted">{formatTimeAgo(guide.published_at)}</p>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}

              <Card className="bg-bg-card p-8 text-center">
                <h2 className="text-xl font-bold mb-2">订阅纽约本地周报</h2>
                <p className="text-sm text-text-secondary mb-5">每周一封，精选本地新闻、实用指南、活动推荐和社区精华</p>
                <NewsletterForm source="guides_cta" className="max-w-md mx-auto" />
              </Card>
            </div>

            <aside className="hidden lg:block w-72 flex-shrink-0">
              <div className="sticky top-36 space-y-6">
                <Card className="bg-bg-card p-5">
                  <h3 className="text-sm font-bold text-text-primary mb-3">热门搜索</h3>
                  <div className="flex flex-wrap gap-2">
                    {['中文家庭医生', '报税服务', '驾照路考', '学区排名', '白卡申请', '租房攻略'].map((term) => (
                      <Link
                        key={term}
                        href={`/ask?q=${encodeURIComponent(term)}`}
                        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-auto py-1.5')}
                      >
                        {term}
                      </Link>
                    ))}
                  </div>
                </Card>

                <Card className="bg-bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-text-primary">推荐商家</h3>
                    <span className="text-xs text-text-muted">赞助</span>
                  </div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-200 to-green-300 flex-shrink-0 flex items-center justify-center text-lg">💼</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">华信会计师事务所</h4>
                      <p className="text-xs text-text-muted mt-1">报税季特惠，新客户可享优惠</p>
                    </div>
                  </div>
                  <Link href="/businesses" className={cn(buttonVariants(), 'block text-center')}>了解详情</Link>
                </Card>
              </div>
            </aside>
          </div>
        )}
      </PageContainer>
    </main>
  );
}

const coverGradients = [
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-blue-400 via-indigo-500 to-purple-600',
  'from-orange-400 via-red-500 to-pink-600',
  'from-green-400 via-emerald-500 to-teal-600',
  'from-purple-400 via-violet-500 to-indigo-600',
  'from-amber-400 via-orange-500 to-red-500',
];

const coverEmojis = ['📋', '🏥', '💼', '🏠', '🚗', '🏫', '🍜', '⚖️', '🌏', '👨‍👩‍👧', '📊', '🔑'];

function getGradient(index: number) {
  return coverGradients[index % coverGradients.length];
}

function getEmoji(title: string, index: number) {
  const hash = title ? title.charCodeAt(0) % coverEmojis.length : index % coverEmojis.length;
  return coverEmojis[hash];
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
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
