'use client';

import { useState, useCallback } from 'react';
import { toggleLike } from '@/app/[locale]/(public)/actions';

interface HeartButtonProps {
  postId: string;
  initialCount: number;
}

export function HeartButton({ postId, initialCount }: HeartButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);

    // Persist to DB
    setLoading(true);
    const formData = new FormData();
    formData.set('post_id', postId);
    const result = await toggleLike(formData);
    setLoading(false);

    if (result.error) {
      // Revert on error
      setLiked(wasLiked);
      setCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
    } else if (result.success) {
      // Sync with server response
      const serverLiked = result.liked ?? !wasLiked;
      setLiked(serverLiked);
    }
  }, [liked, loading, postId]);

  const showRed = liked || count > 0;

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-0.5 flex-shrink-0 ml-auto"
    >
      {showRed ? (
        <svg className={`w-3.5 h-3.5 text-red-500 transition-transform duration-200 ${liked ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-400 hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )}
      <span className={`text-[10px] ${showRed ? 'text-red-500' : 'text-gray-400'}`}>{count}</span>
    </button>
  );
}
