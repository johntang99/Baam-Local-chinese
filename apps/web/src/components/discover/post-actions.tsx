'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDiscoverPost } from '@/app/[locale]/(public)/actions';

interface PostActionsProps {
  postId: string;
  postSlug: string;
}

export function PostActions({ postId, postSlug }: PostActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.set('post_id', postId);
    const result = await deleteDiscoverPost(formData);

    if (result.error) {
      alert(result.error);
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.push('/zh/discover');
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">确定删除？</span>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 r-lg hover:bg-gray-200 transition"
        >
          取消
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-white bg-red-500 r-lg hover:bg-red-600 transition disabled:opacity-50"
        >
          {loading ? '删除中...' : '确定删除'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.push('/zh/discover/new-post')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary r-lg hover:bg-primary/90 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        继续发布
      </button>
      <button
        onClick={() => router.push(`/zh/discover/${postSlug}/edit`)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 r-lg hover:bg-gray-200 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        编辑
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 bg-red-50 r-lg hover:bg-red-100 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        删除
      </button>
    </div>
  );
}
