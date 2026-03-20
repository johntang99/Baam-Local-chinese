'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createBusiness, updateBusiness } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusOptions = [
  { value: 'active', label: '活跃' },
  { value: 'inactive', label: '未激活' },
  { value: 'suspended', label: '已暂停' },
  { value: 'claimed', label: '已认领' },
];

const verificationOptions = [
  { value: 'unverified', label: '未认证' },
  { value: 'pending', label: '待认证' },
  { value: 'verified', label: '已认证' },
  { value: 'rejected', label: '已拒绝' },
];

const planOptions = [
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
];

interface BusinessFormProps {
  business?: AnyRow | null;
  categories: AnyRow[];
  isNew: boolean;
  siteParams?: string;
}

export default function BusinessForm({ business, categories, isNew, siteParams = '' }: BusinessFormProps) {
  const siteQuery = siteParams ? `?${siteParams}` : '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState(business?.display_name || '');
  const [displayNameZh, setDisplayNameZh] = useState(business?.display_name_zh || '');
  const [shortDescZh, setShortDescZh] = useState(business?.short_desc_zh || '');
  const [phone, setPhone] = useState(business?.phone || '');
  const [email, setEmail] = useState(business?.email || '');
  const [websiteUrl, setWebsiteUrl] = useState(business?.website_url || '');
  const [wechatId, setWechatId] = useState(business?.wechat_id || '');
  const [status, setStatus] = useState(business?.status || 'active');
  const [verificationStatus, setVerificationStatus] = useState(business?.verification_status || 'unverified');
  const [currentPlan, setCurrentPlan] = useState(business?.current_plan || 'free');
  const [categoryId, setCategoryId] = useState(business?.category_id || '');

  const buildFormData = () => {
    const fd = new FormData();
    fd.set('display_name', displayName);
    fd.set('display_name_zh', displayNameZh);
    fd.set('short_desc_zh', shortDescZh);
    fd.set('phone', phone);
    fd.set('email', email);
    fd.set('website_url', websiteUrl);
    fd.set('wechat_id', wechatId);
    fd.set('status', status);
    fd.set('verification_status', verificationStatus);
    fd.set('current_plan', currentPlan);
    fd.set('category_id', categoryId);
    return fd;
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      if (isNew) {
        const result = await createBusiness(fd);
        if (result.error) {
          setError(result.error);
        } else if (result.id) {
          router.push(`/admin/businesses/${result.id}/edit${siteQuery}`);
        }
      } else {
        const result = await updateBusiness(business!.id, fd);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      }
    });
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
              <a href={`/admin/businesses${siteQuery}`} className="hover:underline">商家管理</a>
              {' > '}
              {isNew ? '新建' : '编辑'}
            </p>
            <h1 className="text-xl font-bold">{isNew ? '新建商家' : '编辑商家'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/admin/businesses${siteQuery}`}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page inline-flex items-center"
            >
              取消
            </a>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? '保存中...' : '保存'}
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
          {/* Display Name ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">商家名称（中文）</label>
            <input
              type="text"
              value={displayNameZh}
              onChange={(e) => setDisplayNameZh(e.target.value)}
              placeholder="输入商家中文名称"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Display Name EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">商家名称（英文）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter business name in English"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Short Description ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">简短描述（中文）</label>
            <textarea
              value={shortDescZh}
              onChange={(e) => setShortDescZh(e.target.value)}
              placeholder="输入商家简短描述"
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* Contact Info */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">联系方式</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">电话</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例如：+1 (555) 123-4567"
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="例如：info@business.com"
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">网站</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">微信号</label>
                <input
                  type="text"
                  value={wechatId}
                  onChange={(e) => setWechatId(e.target.value)}
                  placeholder="微信号"
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* AI Description Placeholder */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI 生成简介</label>
              <button
                type="button"
                disabled
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI生成简介
              </button>
            </div>
            <p className="text-sm text-text-muted">保存商家信息后可使用AI生成简介</p>
          </div>
        </div>

        {/* Right column 30% */}
        <div className="space-y-6" style={{ flex: '3' }}>
          {/* Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Verification Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">认证状态</label>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {verificationOptions.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Plan */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">套餐</label>
            <select
              value={currentPlan}
              onChange={(e) => setCurrentPlan(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {planOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
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

          {/* Business Stats (edit mode only) */}
          {!isNew && business && (
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
              <label className="block text-sm font-medium">商家数据</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.avg_rating ? Number(business.avg_rating).toFixed(1) : '--'}</p>
                  <p className="text-xs text-text-muted">平均评分</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.review_count ?? 0}</p>
                  <p className="text-xs text-text-muted">评论数</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.lead_count ?? 0}</p>
                  <p className="text-xs text-text-muted">线索数</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.is_featured ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-text-muted">推荐</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
