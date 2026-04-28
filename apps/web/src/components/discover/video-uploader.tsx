'use client';

import { useState, useRef, useCallback } from 'react';

interface VideoUploaderProps {
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  onChange: (data: { videoUrl: string | null; thumbnailUrl: string | null; duration: number | null }) => void;
}

export function VideoUploader({ videoUrl, thumbnailUrl, duration, onChange }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const uploadFile = async (
    file: File,
    onProgress?: (payload: { percent: number; phase: 'uploading' | 'processing' | 'done' }) => void,
  ): Promise<{ url: string | null; error?: string }> => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('folder', 'discover/videos');

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.responseType = 'json';

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        // Phase 1: browser -> API route transfer (0% ~ 85%)
        const percent = Math.min(85, Math.round((event.loaded / event.total) * 85));
        onProgress?.({ percent, phase: 'uploading' });
      };

      xhr.upload.onload = () => {
        // Phase 2: API route -> Supabase write in progress
        onProgress?.({ percent: 90, phase: 'processing' });
      };

      xhr.onload = () => {
        const response =
          xhr.response && typeof xhr.response === 'object'
            ? (xhr.response as { url?: string; error?: string; message?: string })
            : null;
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.({ percent: 100, phase: 'done' });
          resolve({ url: response?.url || null });
          return;
        }
        resolve({ url: null, error: response?.error || response?.message || '上传失败' });
      };

      xhr.onerror = () => resolve({ url: null, error: '网络错误，上传失败' });
      xhr.onabort = () => resolve({ url: null, error: '上传已取消' });

      xhr.send(formData);
    });
  };

  // Extract duration and generate thumbnail from video element
  // Mobile-safe: adds timeout and handles iOS quirks (HEVC, autoplay restrictions)
  const extractMetadata = useCallback((file: File): Promise<{ duration: number; thumbnail: string | null }> => {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (duration: number, thumbnail: string | null) => {
        if (resolved) return;
        resolved = true;
        URL.revokeObjectURL(video.src);
        resolve({ duration, thumbnail });
      };

      // Timeout: if metadata extraction takes > 10s, skip it and upload anyway
      const timer = setTimeout(() => {
        done(30, null); // Assume 30s default so duration check passes
      }, 10000);

      const video = document.createElement('video');
      video.preload = 'auto'; // 'auto' works better than 'metadata' on iOS
      video.muted = true;
      video.playsInline = true; // Required for iOS
      video.setAttribute('playsinline', ''); // Belt and suspenders for iOS

      video.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = Math.round(video.duration);
        if (!dur || !isFinite(dur)) {
          done(30, null); // Can't determine duration, use default
          return;
        }

        // Try to seek for thumbnail
        try {
          video.currentTime = Math.min(1, dur * 0.1);
        } catch {
          done(dur, null); // Seek failed, return duration without thumbnail
        }
      };

      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            done(Math.round(video.duration), thumbnail);
          } else {
            done(Math.round(video.duration), null);
          }
        } catch {
          done(Math.round(video.duration), null);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        // On mobile, HEVC videos may fail to load in video element but still upload fine
        done(30, null); // Use default duration, skip thumbnail
      };

      video.src = URL.createObjectURL(file);
      // On iOS, calling load() explicitly helps trigger metadata loading
      video.load();
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setProgress('请选择视频文件');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setProgress('视频文件不能超过 200MB');
      setUploadPercent(null);
      return;
    }

    setUploading(true);
    setUploadPercent(null);
    setProgress('正在提取视频信息...');

    // Extract metadata first
    const metadata = await extractMetadata(file);

    // Only enforce duration limits if we could actually extract the duration
    // (metadata.duration === 30 means extraction failed, use default — skip validation)
    if (metadata.duration !== 30) {
      if (metadata.duration < 5) {
        setProgress('视频时长不能少于 5 秒');
        setUploading(false);
        setUploadPercent(null);
        return;
      }

      if (metadata.duration > 300) {
        setProgress('视频时长不能超过 5 分钟');
        setUploading(false);
        setUploadPercent(null);
        return;
      }
    }

    // Upload video
    setProgress('正在上传视频...');
    setUploadPercent(0);
    const { url, error } = await uploadFile(file, ({ percent, phase }) => {
      setUploadPercent(percent);
      if (phase === 'processing') {
        setProgress('文件已传输，正在写入云端...');
      } else if (phase === 'uploading') {
        setProgress('正在上传视频...');
      }
    });

    if (url) {
      // Upload thumbnail if we got one
      let thumbUrl: string | null = null;
      if (metadata.thumbnail) {
        setProgress('正在生成封面...');
        setUploadPercent(null);
        try {
          const blob = await fetch(metadata.thumbnail).then(r => r.blob());
          const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbForm = new FormData();
          thumbForm.set('file', thumbFile);
          thumbForm.set('folder', 'discover/thumbnails');
          const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbForm });
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            thumbUrl = thumbData.url;
          }
        } catch { /* thumbnail upload failed, continue without */ }
      }

      onChange({
        videoUrl: url,
        thumbnailUrl: thumbUrl,
        duration: metadata.duration,
      });
      setProgress('');
      setUploadPercent(null);
    } else {
      setProgress(error || '上传失败，请重试');
      setUploadPercent(null);
    }

    setUploading(false);
  }, [extractMetadata, onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const removeVideo = () => {
    onChange({ videoUrl: null, thumbnailUrl: null, duration: null });
  };

  return (
    <div className="bg-white r-xl border border-gray-200 p-5 sm:p-6">
      <label className="text-sm font-semibold text-gray-900 mb-3 block">
        上传视频 <span className="text-gray-400 font-normal">(5秒-5分钟，最大200MB)</span>
      </label>

      {/* Video Preview */}
      {videoUrl ? (
        <div className="mb-4">
          <div className="relative r-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnailUrl || undefined}
              controls
              className="w-full max-h-[400px] object-contain"
            />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white r-full flex items-center justify-center hover:bg-black/80 transition"
            >
              &times;
            </button>
          </div>
          {duration && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              视频时长：{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
            </p>
          )}
        </div>
      ) : (
        /* Upload Zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed r-xl p-10 text-center transition-colors ${
            uploading ? 'border-gray-200 bg-gray-50 cursor-wait' :
            dragOver ? 'border-primary bg-orange-50 cursor-pointer' :
            'border-gray-300 hover:border-primary hover:bg-orange-50/50 cursor-pointer'
          }`}
        >
          {uploading ? (
            <>
              {uploadPercent !== null ? (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-gray-600 mb-3">{progress || '正在上传视频...'}</p>
                  <div className="h-2 w-full bg-gray-200 r-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{uploadPercent}%</p>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 border-3 border-primary border-t-transparent r-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">{progress}</p>
                </>
              )}
            </>
          ) : (
            <>
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">
                拖拽视频到此处，或 <span className="text-primary font-medium">点击上传</span>
              </p>
              <p className="text-xs text-gray-400">支持 MP4、WebM、MOV，5秒-5分钟，不超过 200MB</p>
            </>
          )}
        </div>
      )}

      {progress && !uploading && (
        <p className="text-xs text-red-500 mt-2 text-center">{progress}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mov,video/*"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
