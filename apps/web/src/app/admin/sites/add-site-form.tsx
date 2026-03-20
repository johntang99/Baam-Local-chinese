'use client';

import { useState } from 'react';
import { addSite } from './actions';

export function AddSiteForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await addSite(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setOpen(false);
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark">+ 添加站点</button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">添加新站点</h3>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input name="slug" required placeholder="e.g. nj-zh" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">语言 *</label>
                  <select name="locale" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="bilingual">双语</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
                  <input name="name" required placeholder="e.g. New Jersey Chinese" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">中文名</label>
                  <input name="name_zh" placeholder="e.g. 新泽西中文站" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">域名</label>
                <input name="domain" placeholder="e.g. nj.baam.us" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">说明</label>
                <textarea name="description" rows={2} placeholder="站点描述..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                  {loading ? '创建中...' : '创建站点'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
