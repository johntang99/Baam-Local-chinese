'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitBusinessClaim } from './actions';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ClaimFormProps {
  categories: AnyRow[];
}

export function ClaimForm({ categories }: ClaimFormProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-4">🎉</p>
        <h3 className="text-lg font-bold mb-2">申请已提交！</h3>
        <p className="text-sm text-text-secondary mb-4">我们将在 1-3 个工作日内审核您的申请，届时会通过邮件通知您。</p>
        <button onClick={() => router.push('/zh/businesses')} className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-6 text-sm')}>
          浏览商家目录
        </button>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);
    const result = await submitBusinessClaim(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error === 'UNAUTHORIZED' ? '请先登录' : result.error);
    } else {
      setSuccess(true);
    }
  };

  const inputClass = 'w-full h-11 px-4 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card';

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1.5">商家名称 *</label>
        <input name="display_name" type="text" placeholder="请输入商家名称" required className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">商家类别 *</label>
        <select name="category_id" required className={inputClass + ' cursor-pointer'}>
          <option value="">请选择类别</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name_zh || cat.name_en || cat.name}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">联系电话 *</label>
          <input name="phone" type="tel" placeholder="(xxx) xxx-xxxx" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">电子邮箱</label>
          <input name="email" type="email" placeholder="your@email.com" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">商家地址</label>
        <input name="address" type="text" placeholder="例：136-20 Roosevelt Ave, Flushing, NY 11354" className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">网站</label>
        <input name="website" type="url" placeholder="https://..." className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">商家简介</label>
        <textarea
          name="description"
          rows={3}
          placeholder="简要介绍您的商家服务..."
          className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card resize-none"
        />
      </div>

      <button type="submit" disabled={loading} className={cn(buttonVariants(), 'w-full h-12 text-base font-semibold disabled:opacity-50')}>
        {loading ? '提交中...' : '提交入驻申请'}
      </button>
    </form>
  );
}
