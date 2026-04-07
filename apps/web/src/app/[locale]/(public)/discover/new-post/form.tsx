'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDiscoverPost } from '@/app/[locale]/(public)/actions';
import { ImageUploader } from '@/components/discover/image-uploader';
import { VideoUploader } from '@/components/discover/video-uploader';
import { BusinessSearchInput } from '@/components/discover/business-search-input';
import { TagInput } from '@/components/discover/tag-input';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const postTypes = [
  { key: 'note', label: '笔记', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'video', label: '视频', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'recommendation', label: '推荐清单', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
];

const locationSuggestions = ['法拉盛', '曼哈顿唐人街', '布鲁克林日落公园', '艾姆赫斯特'];

interface CreatePostFormProps {
  isLoggedIn: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prelinkedBusiness?: Record<string, any> | null;
}

export function VoicePostForm({ isLoggedIn, prelinkedBusiness }: CreatePostFormProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [businesses, setBusinesses] = useState<AnyRow[]>(prelinkedBusiness ? [prelinkedBusiness] : []);
  const [location, setLocation] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [allowComments, setAllowComments] = useState(true);
  const [moderationNotice, setModerationNotice] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const router = useRouter();

  if (!isLoggedIn) {
    return (
      <Card className="p-8 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-gray-500 mb-2">请先登录后再发布内容</p>
        <p className="text-sm text-gray-400">点击右上角「登录/注册」按钮</p>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim()) {
      setError('请输入标题或内容');
      return;
    }
    if (postType === 'video' && !videoUrl) {
      setError('请先上传视频');
      return;
    }

    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.set('post_type', postType);
    formData.set('title', title);
    formData.set('content', content);
    formData.set('tags', tags.join(','));
    if (images.length > 0) formData.set('cover_images', JSON.stringify(images));
    if (videoUrl) formData.set('video_url', videoUrl);
    if (videoThumbnailUrl) formData.set('video_thumbnail_url', videoThumbnailUrl);
    if (videoDuration) formData.set('video_duration', String(videoDuration));
    if (businesses.length > 0) formData.set('business_ids', JSON.stringify(businesses.map(b => b.id)));
    if (showLocation && location.trim()) formData.set('location_text', location);

    const result = await createDiscoverPost(formData);

    if (result.error) {
      setError(result.error === 'UNAUTHORIZED' ? '请先登录' : result.error);
      setLoading(false);
      return;
    }

    if (result.moderated) {
      setModerationNotice(true);
      setTimeout(() => {
        router.push(result.redirect ? `/zh${result.redirect}` : '/zh/discover');
      }, 2000);
      return;
    }

    if (result.redirect) {
      router.push(`/zh${result.redirect}`);
    } else {
      router.push('/zh/discover');
    }
  };

  return (
    <div className="space-y-6">
      {moderationNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          你的笔记已发布，正在审核中。审核通过后将在发现页展示。
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* Post Type Selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex gap-1">
        {postTypes.map((type) => (
          <button
            key={type.key}
            type="button"
            onClick={() => setPostType(type.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors ${
              postType === type.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type.icon} />
            </svg>
            {type.label}
          </button>
        ))}
      </div>

      {/* Image Upload (for notes) */}
      {postType !== 'video' && (
        <ImageUploader images={images} onChange={setImages} maxImages={9} />
      )}

      {/* Video Upload (for video posts) */}
      {postType === 'video' && (
        <VideoUploader
          videoUrl={videoUrl}
          thumbnailUrl={videoThumbnailUrl}
          duration={videoDuration}
          onChange={({ videoUrl: v, thumbnailUrl: t, duration: d }) => {
            setVideoUrl(v);
            setVideoThumbnailUrl(t);
            setVideoDuration(d);
          }}
        />
      )}

      {/* Title */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <label className="text-sm font-semibold text-gray-900 mb-3 block">
          标题 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="写一个吸引人的标题..."
          maxLength={50}
          className="w-full h-12 px-4 border border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
        />
        <p className="text-xs text-gray-400 mt-2 text-right">{title.length} / 50</p>
      </div>

      {/* Content — 小红书 style plain text editor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <label className="text-sm font-semibold text-gray-900 mb-3 block">正文内容</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'分享你的故事、经验或推荐...\n\n可以用 # 添加话题标签\n可以用 @ 提及其他用户'}
          className="w-full min-h-[240px] px-4 py-3 border border-gray-200 rounded-xl text-[15px] leading-[1.8] focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y transition"
        />
        <p className="text-xs text-gray-400 mt-2 text-right">已输入 {content.length} 字</p>
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
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <label className="text-sm font-semibold text-gray-900 mb-3 block">位置</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="输入位置..."
            className="w-full h-10 pl-10 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
          />
          {location && (
            <button
              type="button"
              onClick={() => setLocation('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {locationSuggestions.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocation(loc)}
              className="px-3 py-1 bg-gray-50 text-gray-500 text-xs rounded-full hover:bg-orange-50 hover:text-primary transition border border-gray-200"
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <label className="text-sm font-semibold text-gray-900 mb-4 block">发布设置</label>
        <div className="space-y-4">
          <ToggleSetting
            label="允许评论"
            description="其他用户可以在笔记下方评论"
            checked={allowComments}
            onChange={setAllowComments}
          />
          <ToggleSetting
            label="显示位置信息"
            description="在笔记中显示你设置的位置"
            checked={showLocation}
            onChange={setShowLocation}
          />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center gap-3 pb-8">
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 py-3 text-sm font-medium rounded-xl')}
        >
          存为草稿
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className={cn(buttonVariants(), 'flex-1 py-3 text-sm font-semibold rounded-xl disabled:opacity-50')}
        >
          {loading ? (
            '发布中...'
          ) : (
            <>
              <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              发布笔记
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSetting({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${
          checked ? 'right-0.5' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}
