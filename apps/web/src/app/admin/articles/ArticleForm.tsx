'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createArticle, updateArticle, publishArticle, generateAISummary } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const contentVerticals = [
  { value: 'news_alert', label: '新闻快讯' },
  { value: 'news_brief', label: '新闻简报' },
  { value: 'news_explainer', label: '新闻解读' },
  { value: 'guide_howto', label: '操作指南' },
  { value: 'guide_checklist', label: '清单指南' },
  { value: 'guide_comparison', label: '对比指南' },
];

const editorialStatuses = [
  { value: 'draft', label: '草稿' },
  { value: 'ai_drafted', label: 'AI草稿' },
  { value: 'human_reviewed', label: '已审核' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

const sourceTypes = [
  { value: 'official_gov', label: '政府官方' },
  { value: 'media', label: '媒体' },
  { value: 'community_org', label: '社区组织' },
  { value: 'original', label: '原创' },
  { value: 'ai_assisted', label: 'AI辅助' },
];

const audienceOptions = [
  { value: 'new_immigrant', label: '新移民' },
  { value: 'family', label: '家庭' },
  { value: 'business', label: '商家' },
  { value: 'senior', label: '老人' },
  { value: 'student', label: '学生' },
  { value: 'all', label: '所有人' },
];

const toolbarButtons = ['H2', 'H3', 'B', 'I', 'List', 'Img', 'Link', 'Code'];

interface ArticleFormProps {
  article?: AnyRow | null;
  categories: AnyRow[];
  regions: AnyRow[];
  isNew: boolean;
  siteParams?: string;
}

export default function ArticleForm({ article, categories, regions, isNew, siteParams = '' }: ArticleFormProps) {
  const siteQuery = siteParams ? `?${siteParams}` : '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titleZh, setTitleZh] = useState(article?.title_zh || '');
  const [titleEn, setTitleEn] = useState(article?.title_en || '');
  const [contentVertical, setContentVertical] = useState(article?.content_vertical || 'news_alert');
  const [bodyZh, setBodyZh] = useState(article?.body_zh || '');
  const [bodyEn, setBodyEn] = useState(article?.body_en || '');
  const [editorialStatus, setEditorialStatus] = useState(article?.editorial_status || 'draft');
  const [categoryId, setCategoryId] = useState(article?.category_id || '');
  const [regionId, setRegionId] = useState(article?.region_id || '');
  const [sourceType, setSourceType] = useState(article?.source_type || '');
  const [sourceName, setSourceName] = useState(article?.source_name || '');
  const [sourceUrl, setSourceUrl] = useState(article?.source_url || '');
  const [seoTitleZh, setSeoTitleZh] = useState(article?.seo_title_zh || '');
  const [seoDescZh, setSeoDescZh] = useState(article?.seo_desc_zh || '');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(article?.audience_types || []);
  const [aiSummaryZh] = useState(article?.ai_summary_zh || '');
  const [aiSummaryEn] = useState(article?.ai_summary_en || '');

  const buildFormData = () => {
    const fd = new FormData();
    fd.set('title_zh', titleZh);
    fd.set('title_en', titleEn);
    fd.set('content_vertical', contentVertical);
    fd.set('body_zh', bodyZh);
    fd.set('body_en', bodyEn);
    fd.set('editorial_status', editorialStatus);
    fd.set('category_id', categoryId);
    fd.set('region_id', regionId);
    fd.set('source_type', sourceType);
    fd.set('source_name', sourceName);
    fd.set('source_url', sourceUrl);
    fd.set('seo_title_zh', seoTitleZh);
    fd.set('seo_desc_zh', seoDescZh);
    fd.set('audience_types', JSON.stringify(selectedAudiences));
    return fd;
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      if (isNew) {
        const result = await createArticle(fd);
        if (result.error) {
          setError(result.error);
        } else if (result.id) {
          router.push(`/admin/articles/${result.id}/edit${siteQuery}`);
        }
      } else {
        const result = await updateArticle(article!.id, fd);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      }
    });
  };

  const handlePublish = () => {
    if (isNew) {
      setEditorialStatus('published');
      handleSave();
      return;
    }
    startTransition(async () => {
      await publishArticle(article!.id);
      router.refresh();
    });
  };

  const handleGenerateAISummary = () => {
    if (!article?.id) return;
    startTransition(async () => {
      await generateAISummary(article.id);
      router.refresh();
    });
  };

  const toggleAudience = (value: string) => {
    setSelectedAudiences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted mb-1">
              <a href={`/admin${siteQuery}`} className="hover:underline">Admin</a>
              {' > '}
              <a href={`/admin/articles${siteQuery}`} className="hover:underline">内容管理</a>
              {' > '}
              {isNew ? '新建' : '编辑'}
            </p>
            <h1 className="text-xl font-bold">{isNew ? '新建文章' : '编辑文章'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page disabled:opacity-50"
            >
              保存草稿
            </button>
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              发布
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="p-6 flex gap-6">
        {/* Left column 70% */}
        <div className="flex-1 min-w-0 space-y-6" style={{ flex: '7' }}>
          {/* Title ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">标题（中文）</label>
            <input
              type="text"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="输入文章中文标题"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Title EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">标题（英文）</label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Enter article title in English"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Content Vertical */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">内容类型</label>
            <select
              value={contentVertical}
              onChange={(e) => setContentVertical(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {contentVerticals.map((cv) => (
                <option key={cv.value} value={cv.value}>{cv.label}</option>
              ))}
            </select>
          </div>

          {/* Body ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">正文（中文）</label>
            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border">
              {toolbarButtons.map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className="px-2 py-1 text-xs font-mono text-text-muted border border-border rounded hover:bg-bg-page"
                >
                  {btn}
                </button>
              ))}
            </div>
            <textarea
              value={bodyZh}
              onChange={(e) => setBodyZh(e.target.value)}
              placeholder="输入文章正文内容（支持Markdown）"
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* Body EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">正文（英文）</label>
            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border">
              {toolbarButtons.map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className="px-2 py-1 text-xs font-mono text-text-muted border border-border rounded hover:bg-bg-page"
                >
                  {btn}
                </button>
              ))}
            </div>
            <textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              placeholder="Enter article body content (Markdown supported)"
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* AI Summary */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI 摘要</label>
              <button
                type="button"
                onClick={handleGenerateAISummary}
                disabled={isPending || isNew}
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI生成摘要
              </button>
            </div>
            {(aiSummaryZh || aiSummaryEn) ? (
              <div className="space-y-3">
                {aiSummaryZh && (
                  <div className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1 font-medium">中文摘要</p>
                    <p className="text-sm">{aiSummaryZh}</p>
                  </div>
                )}
                {aiSummaryEn && (
                  <div className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1 font-medium">English Summary</p>
                    <p className="text-sm">{aiSummaryEn}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">保存文章后可生成AI摘要</p>
            )}
          </div>

          {/* AI FAQ */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI FAQ</label>
              <button
                type="button"
                disabled
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                生成FAQ
              </button>
            </div>
            {article?.ai_faq ? (
              <div className="space-y-2">
                {(article.ai_faq as { q: string; a: string }[]).map((item: { q: string; a: string }, i: number) => (
                  <div key={i} className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-sm font-medium">Q: {item.q}</p>
                    <p className="text-sm text-text-muted mt-1">A: {item.a}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">保存文章后可生成FAQ</p>
            )}
          </div>
        </div>

        {/* Right column 30% */}
        <div className="space-y-6" style={{ flex: '3' }}>
          {/* Editorial Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">发布状态</label>
            <select
              value={editorialStatus}
              onChange={(e) => setEditorialStatus(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {editorialStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">分类</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">选择分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name_zh || c.name || c.slug}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">地区</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">选择地区</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name_zh || r.slug}</option>
              ))}
            </select>
          </div>

          {/* Source Info */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">来源信息</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">来源类型</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">选择来源类型</option>
                {sourceTypes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">来源名称</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="例如：纽约时报"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">来源 URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Cover Image */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">封面图片</label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-text-muted">点击或拖拽上传封面图片</p>
              <p className="text-xs text-text-muted mt-1">建议尺寸 1200x630</p>
            </div>
          </div>

          {/* Audience Types */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-3">受众类型</label>
            <div className="space-y-2">
              {audienceOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAudiences.includes(opt.value)}
                    onChange={() => toggleAudience(opt.value)}
                    className="rounded border-gray-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">SEO 设置</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">SEO 标题（中文）</label>
              <input
                type="text"
                value={seoTitleZh}
                onChange={(e) => setSeoTitleZh(e.target.value)}
                placeholder="SEO标题，留空则使用文章标题"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">SEO 描述（中文）</label>
              <input
                type="text"
                value={seoDescZh}
                onChange={(e) => setSeoDescZh(e.target.value)}
                placeholder="SEO描述，留空则使用AI摘要"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
