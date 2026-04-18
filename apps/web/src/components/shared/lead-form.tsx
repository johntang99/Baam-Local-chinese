'use client';

import { useState } from 'react';
import { submitLead } from '@/app/[locale]/(public)/actions';

interface LeadFormProps {
  businessId?: string;
  sourceType?: string;
  sourceArticleId?: string;
  className?: string;
}

export function LeadForm({ businessId, sourceType = 'business_page', sourceArticleId, className = '' }: LeadFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showMore, setShowMore] = useState(false);

  if (status === 'success') {
    return (
      <div className={`p-4 bg-accent-green-light border border-accent-green/30 r-lg text-center ${className}`}>
        <p className="text-sm text-accent-green fw-medium">{message}</p>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setStatus('loading');
    if (businessId) formData.set('business_id', businessId);
    formData.set('source_type', sourceType);
    if (sourceArticleId) formData.set('source_article_id', sourceArticleId);

    const result = await submitLead(formData);

    if (result.error) {
      setStatus('error');
      setMessage(result.error);
    } else {
      setStatus('success');
      setMessage(result.message || '提交成功！');
    }
  };

  return (
    <form action={handleSubmit} className={`space-y-2.5 ${className}`}>
      {status === 'error' && (
        <p className="text-xs text-accent-red">{message}</p>
      )}
      {/* Required fields: phone + message */}
      <div>
        <input
          type="tel"
          name="phone"
          placeholder="手机号码 *"
          required
          className="w-full h-10 px-3 border border-border r-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        />
      </div>
      <div>
        <textarea
          name="message"
          placeholder="简单描述你的需求..."
          rows={3}
          className="w-full px-3 py-2 border border-border r-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none"
        />
      </div>

      {/* Optional: name + email collapsed by default */}
      {showMore ? (
        <>
          <input
            type="text"
            name="name"
            placeholder="你的姓名（可选）"
            className="w-full h-10 px-3 border border-border r-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
          <input
            type="email"
            name="email"
            placeholder="邮箱（可选）"
            className="w-full h-10 px-3 border border-border r-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs text-text-muted hover:text-primary transition-colors"
        >
          + 添加姓名 / 邮箱（可选）
        </button>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full btn btn-primary h-10 text-sm disabled:opacity-50"
      >
        {status === 'loading' ? '提交中...' : '免费咨询'}
      </button>
      <p className="text-xs text-text-muted text-center">提交后商家将尽快与您联系</p>
    </form>
  );
}
