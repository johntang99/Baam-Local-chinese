'use client';

import { useEffect, useMemo, useState } from 'react';

interface ImagePickerModalProps {
  open: boolean;
  folder: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}

interface MediaItem {
  id: string;
  url: string;
  path: string;
}

interface ProviderItem {
  id: string;
  previewUrl: string;
  sourceUrl: string;
  alt: string;
  author?: string;
}

type SourceTab = 'library' | 'unsplash' | 'pexels' | 'ai';

async function parseApiPayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function ImagePickerModal({ open, folder, onClose, onSelect }: ImagePickerModalProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [providerItems, setProviderItems] = useState<ProviderItem[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>('library');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerPage, setProviderPage] = useState(1);
  const [providerTotalPages, setProviderTotalPages] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/media/list?folder=${encodeURIComponent(folder)}`);
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || '加载图库失败');
      }
      setItems(payload.items || []);
    } catch (error: any) {
      setStatus(error?.message || '加载图库失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProvider = async (tab: 'unsplash' | 'pexels', page = 1) => {
    if (!query.trim()) {
      setProviderItems([]);
      setProviderTotalPages(0);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        provider: tab,
        query: query.trim(),
        page: String(page),
        perPage: '24',
      });
      const response = await fetch(`/api/media/provider/search?${params.toString()}`);
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || '搜索失败');
      }
      setProviderItems(payload.items || []);
      setProviderPage(Number(payload.page || page));
      setProviderTotalPages(Number(payload.totalPages || 0));
    } catch (error: any) {
      setStatus(error?.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSourceTab('library');
    setProviderItems([]);
    setProviderPage(1);
    setProviderTotalPages(0);
    setStatus(null);
    setQuery('');
    loadLibrary();
  }, [open, folder]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return items.filter((item) => {
      return !lower || item.path.toLowerCase().includes(lower);
    });
  }, [items, query]);

  const handleImportProviderImage = async (item: ProviderItem) => {
    if (sourceTab === 'library') return;
    setImportingId(item.id);
    setStatus(null);
    try {
      const response = await fetch('/api/media/provider/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder,
          provider: sourceTab,
          sourceUrl: item.sourceUrl,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || '导入失败');
      }
      onSelect(payload.url);
      onClose();
    } catch (error: any) {
      setStatus(error?.message || '导入失败');
    } finally {
      setImportingId(null);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setStatus(null);
    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('file', file);
    try {
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || '上传失败');
      }
      onSelect(payload.url);
      onClose();
    } catch (error: any) {
      setStatus(error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onProviderSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sourceTab === 'library') return;
    if (sourceTab === 'ai') {
      void handleGenerateAiImage();
      return;
    }
    loadProvider(sourceTab, 1);
  };

  const handleGenerateAiImage = async () => {
    const prompt = query.trim();
    if (!prompt) {
      setStatus('请先输入图片描述（例如：纽约法拉盛街景，温暖真实摄影风格）');
      return;
    }
    setGenerating(true);
    setStatus(null);
    try {
      const response = await fetch('/api/media/provider/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder,
          prompt,
          size: '1536x1024',
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || 'AI 生成失败');
      }
      onSelect(payload.url);
      onClose();
    } catch (error: any) {
      setStatus(error?.message || 'AI 生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const renderProviderGrid = () => (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        {providerItems.length} 个结果
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providerItems.map((item) => (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="aspect-[4/3] bg-gray-100">
              <img
                src={item.previewUrl}
                alt={item.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-3 space-y-2">
              <div className="text-xs text-gray-600 line-clamp-2">{item.alt}</div>
              {item.author && (
                <div className="text-[11px] text-gray-500">Photo by {item.author}</div>
              )}
              <button
                type="button"
                onClick={() => handleImportProviderImage(item)}
                disabled={Boolean(importingId)}
                className="px-2 py-1 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {importingId === item.id ? '导入中...' : '使用此图'}
              </button>
            </div>
          </div>
        ))}
        {providerItems.length === 0 && !loading && (
          <div className="text-sm text-gray-500">
            搜索 {sourceTab} 图片并导入。
          </div>
        )}
      </div>
      {providerTotalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={providerPage <= 1 || loading}
            onClick={() => loadProvider(sourceTab as 'unsplash' | 'pexels', providerPage - 1)}
            className="px-2 py-1 rounded-md border border-gray-200 text-xs disabled:opacity-60"
          >
            上一页
          </button>
          <span className="text-xs text-gray-500">
            第 {providerPage} / {providerTotalPages} 页
          </span>
          <button
            type="button"
            disabled={providerPage >= providerTotalPages || loading}
            onClick={() => loadProvider(sourceTab as 'unsplash' | 'pexels', providerPage + 1)}
            className="px-2 py-1 rounded-md border border-gray-200 text-xs disabled:opacity-60"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );

  const renderAiPanel = () => (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        使用 GPT 生成封面图。建议描述包含：场景、地点、风格、光线、构图。
      </div>
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 leading-relaxed">
        示例：纽约法拉盛社区街道，白天自然光，纪实摄影风格，画面干净，适合作为生活指南文章封面，不含文字或水印。
      </div>
      <button
        type="button"
        onClick={() => void handleGenerateAiImage()}
        disabled={generating}
        className="px-3 py-2 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {generating ? '生成中...' : '生成并使用'}
      </button>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">图片选择</h2>
            <p className="text-xs text-gray-500">
              从图库、Unsplash、Pexels 选择，或从电脑上传。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleUpload(file);
                  event.currentTarget.value = '';
                }}
              />
              <span className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
                {uploading ? '上传中...' : '上传'}
              </span>
            </label>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-xs"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            {(['library', 'unsplash', 'pexels', 'ai'] as SourceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSourceTab(tab);
                  setStatus(null);
                  if (tab === 'library') {
                    loadLibrary();
                  } else {
                    setProviderItems([]);
                    setProviderPage(1);
                    setProviderTotalPages(0);
                  }
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs border ${
                  sourceTab === tab
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab === 'library'
                  ? '图库'
                  : tab === 'unsplash'
                    ? 'Unsplash'
                    : tab === 'pexels'
                      ? 'Pexels'
                      : 'AI 生成'}
              </button>
            ))}
          </div>

          <form
            className={`grid gap-3 ${sourceTab === 'library' ? 'md:grid-cols-1' : 'md:grid-cols-[1fr_auto]'}`}
            onSubmit={onProviderSearchSubmit}
          >
            <input
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              placeholder={
                sourceTab === 'library'
                  ? '按文件名搜索'
                  : sourceTab === 'ai'
                    ? '输入 AI 生成提示词'
                    : '搜索图片'
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {sourceTab !== 'library' && (
              <button
                type="submit"
                disabled={generating}
                className="px-3 py-2 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
              >
                {sourceTab === 'ai' ? (generating ? '生成中...' : '生成') : '搜索'}
              </button>
            )}
          </form>
        </div>

        <div className="p-5 overflow-y-auto">
          {status && (
            <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {status}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-gray-500">加载中...</div>
          ) : sourceTab === 'library' ? (
            <div>
              <div className="mb-3 text-xs text-gray-500">
                {filtered.length} 个结果
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.url);
                      onClose();
                    }}
                    className="border border-gray-200 rounded-lg overflow-hidden text-left hover:shadow-sm"
                  >
                    <div className="aspect-[4/3] bg-gray-100">
                      <img
                        src={item.url}
                        alt={item.path}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-3 py-2 text-xs text-gray-600 truncate">{item.path}</div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="text-sm text-gray-500">暂无图片</div>
                )}
              </div>
            </div>
          ) : sourceTab === 'ai' ? (
            renderAiPanel()
          ) : (
            renderProviderGrid()
          )}
        </div>
      </div>
    </div>
  );
}
