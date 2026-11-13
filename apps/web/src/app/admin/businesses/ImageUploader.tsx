'use client';
import { useState } from 'react';
import { ImagePickerModal } from '@/components/admin/ImagePickerModal';

interface Props {
  businessSlug: string;
  images: string[];
  onChange: (nextImages: string[]) => void;
}

export default function ImageUploader({ businessSlug, images, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelect = (url: string) => {
    if (images.length >= 10) { alert('最多10张'); return; }
    if (images.includes(url)) return;
    onChange([...images, url]);
  };

  const handleDelete = async (url: string) => {
    if (!confirm('确定删除？')) return;
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/object\/public\/[^/]+\/(.+)/);
      if (pathMatch) {
        await fetch('/api/media/file', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathMatch[1] }),
        });
      }
    } catch {}
    onChange(images.filter(i => i !== url));
  };

  const handleSetCover = (idx: number) => {
    if (idx === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(idx, 1);
    newImages.unshift(moved);
    onChange(newImages);
  };

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {images.map((url, i) => (
            <div key={url} className={`relative group aspect-square r-lg overflow-hidden border-2 ${
              i === 0 ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
            }`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <div className="absolute top-1 left-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  封面
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleSetCover(i)}
                    className="bg-white text-gray-800 text-xs px-2 py-1 rounded shadow hover:bg-gray-100"
                  >
                    设为封面
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  className="bg-red-600 text-white text-xs px-2 py-1 rounded shadow hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setPickerOpen(true)}
        className="h-9 px-4 text-sm r-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
        📷 选择图片
      </button>
      <span className="text-xs text-gray-400 ml-2">{images.length}/10</span>

      <ImagePickerModal
        open={pickerOpen}
        folder={`businesses/${businessSlug}`}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  );
}
