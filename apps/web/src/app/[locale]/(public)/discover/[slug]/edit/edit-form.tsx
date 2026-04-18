'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateDiscoverPost } from '@/app/[locale]/(public)/actions';
import { ImageUploader } from '@/components/discover/image-uploader';
import { BusinessSearchInput } from '@/components/discover/business-search-input';
import { TagInput } from '@/components/discover/tag-input';
import { VoiceButton } from '@/components/shared/voice-button';
import { Card } from '@/components/ui/card';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface EditPostFormProps {
  post: AnyRow;
  linkedBusinesses: AnyRow[];
}

export function EditPostForm({ post, linkedBusinesses }: EditPostFormProps) {
  const [title, setTitle] = useState(post.title || '');
  const [content, setContent] = useState(post.content || '');
  const [images, setImages] = useState<string[]>(post.cover_images || []);
  const [tags, setTags] = useState<string[]>(post.topic_tags || []);
  const [businesses, setBusinesses] = useState<AnyRow[]>(linkedBusinesses);
  const [location, setLocation] = useState(post.location_text || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim()) {
      setError('请输入标题或内容');
      return;
    }

    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.set('post_id', post.id);
    formData.set('title', title);
    formData.set('content', content);
    formData.set('tags', tags.join(','));
    if (images.length > 0) formData.set('cover_images', JSON.stringify(images));
    if (post.video_url) formData.set('video_url', post.video_url);
    if (post.video_thumbnail_url) formData.set('video_thumbnail_url', post.video_thumbnail_url);
    if (location.trim()) formData.set('location_text', location);
    if (businesses.length > 0) formData.set('business_ids', JSON.stringify(businesses.map(b => b.id)));

    const result = await updateDiscoverPost(formData);

    if (result.error) {
      setError(result.error === 'UNAUTHORIZED' ? '请先登录' : result.error);
      setLoading(false);
      return;
    }

    router.push(`/zh/discover/${result.slug || post.slug}`);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm r-lg">{error}</div>
      )}

      {/* Images (if note type) */}
      {post.post_type !== 'video' && (
        <ImageUploader images={images} onChange={setImages} maxImages={9} />
      )}

      {/* Video preview (if video type — not editable) */}
      {post.video_url && (
        <Card className="p-4">
          <p className="text-sm text-text-muted mb-2">视频（不可更改）</p>
          <video src={post.video_url} controls className="w-full r-lg max-h-60" />
        </Card>
      )}

      {/* Title */}
      <div className="bg-bg-card r-xl border border-border p-5">
        <label className="text-sm fw-semibold text-text-primary mb-3 block">
          标题 <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="写一个吸引人的标题..."
            maxLength={50}
            className="flex-1 h-12 px-4 border border-border r-xl text-base fw-medium focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
          />
          <VoiceButton onResult={(text) => setTitle((prev: string) => (prev + text).slice(0, 50))} />
        </div>
        <p className="text-xs text-text-muted mt-2 text-right">{title.length} / 50</p>
      </div>

      {/* Content */}
      <div className="bg-bg-card r-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm fw-semibold text-text-primary">正文内容</label>
          <VoiceButton onResult={(text) => setContent((prev: string) => prev + text)} className="w-8 h-8 r-full" />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享你的故事、经验或推荐..."
          className="w-full min-h-[200px] px-4 py-3 border border-border r-xl text-[15px] leading-[1.8] focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y transition"
        />
        <p className="text-xs text-text-muted mt-2 text-right">已输入 {content.length} 字</p>
      </div>

      {/* Tags */}
      <TagInput tags={tags} onChange={setTags} maxTags={5} />

      {/* Business Linker */}
      <BusinessSearchInput
        selectedBusinesses={businesses}
        onChange={setBusinesses}
        maxBusinesses={5}
      />

      {/* Location */}
      <div className="bg-bg-card r-xl border border-border p-5">
        <label className="text-sm fw-semibold text-text-primary mb-3 block">位置</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="添加位置..."
          className="w-full h-10 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 border border-border r-xl text-sm fw-medium text-text-secondary hover:bg-bg-page transition"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-3 bg-primary text-white r-xl text-sm fw-semibold hover:bg-primary/90 transition disabled:opacity-50"
        >
          {loading ? '保存中...' : '💾 保存修改'}
        </button>
      </div>
    </div>
  );
}
