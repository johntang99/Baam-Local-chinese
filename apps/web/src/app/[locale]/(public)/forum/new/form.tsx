'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createForumThread } from '@/app/[locale]/(public)/actions';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ForumNewPostFormProps {
  boards: AnyRow[];
  isLoggedIn: boolean;
}

export function ForumNewPostForm({ boards, isLoggedIn }: ForumNewPostFormProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isLoggedIn) {
    return (
      <Card className="p-8 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-text-secondary mb-2">请先登录后再发帖</p>
        <p className="text-sm text-text-muted">点击右上角「登录/注册」按钮</p>
      </Card>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);

    const result = await createForumThread(formData);

    if (result.error) {
      if (result.error === 'UNAUTHORIZED') {
        setError('请先登录');
      } else {
        setError(result.error);
      }
      setLoading(false);
      return;
    }

    if (result.redirect) {
      router.push(`/zh${result.redirect}`);
    } else {
      router.push('/zh/forum');
    }
  };

  return (
    <Card className="p-6">
      <form action={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* Board Selector */}
      <div>
        <label htmlFor="board-select" className="block text-sm font-medium mb-1">
          选择版块 <span className="text-accent-red">*</span>
        </label>
        <select
          id="board-select"
          name="board_id"
          required
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card"
        >
          <option value="">请选择版块</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.emoji || '📋'} {b.name_zh || b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Title Input */}
      <div>
        <label htmlFor="post-title" className="block text-sm font-medium mb-1">
          标题 <span className="text-accent-red">*</span>
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          placeholder="请输入帖子标题"
          maxLength={120}
          required
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      {/* Rich Text Area */}
      <div>
        <label htmlFor="post-body" className="block text-sm font-medium mb-1">
          内容 <span className="text-accent-red">*</span>
        </label>
        <textarea
          id="post-body"
          name="body"
          placeholder={'写下你想分享的内容...\n\n支持 Markdown 格式：**加粗** *斜体* [链接](url) - 列表'}
          required
          className="w-full h-48 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
        />
        <p className="text-xs text-text-muted mt-1">支持 Markdown 格式</p>
      </div>

      {/* Tag Input */}
      <div>
        <label htmlFor="post-tags" className="block text-sm font-medium mb-1">标签</label>
        <input
          id="post-tags"
          name="tags"
          type="text"
          placeholder="输入标签，用逗号分隔（如：租房, 法拉盛, 求推荐）"
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <p className="text-xs text-text-muted mt-1">最多 5 个标签</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading} className={cn(buttonVariants(), 'px-6 disabled:opacity-50')}>
          {loading ? '发布中...' : '发布帖子'}
        </button>
      </div>
      </form>
    </Card>
  );
}
