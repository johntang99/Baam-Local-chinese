'use client';

import { useState } from 'react';
import { addCategory, updateCategory, deleteCategory } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface CategoryTreeProps {
  categories: AnyRow[];
}

interface CategoryFormData {
  slug: string;
  name_en: string;
  name_zh: string;
  icon: string;
  parent_id: string;
  sort_order: string;
}

const emptyForm: CategoryFormData = { slug: '', name_en: '', name_zh: '', icon: '', parent_id: '', sort_order: '0' };

export function CategoryTree({ categories }: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Build tree: parents are categories with no parent_id
  const parents = categories.filter(c => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddModal = (parentId?: string) => {
    setEditingId(null);
    setFormData({ ...emptyForm, parent_id: parentId || '' });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (cat: AnyRow) => {
    setEditingId(cat.id);
    setFormData({
      slug: cat.slug || '',
      name_en: cat.name_en || '',
      name_zh: cat.name_zh || '',
      icon: cat.icon || '',
      parent_id: cat.parent_id || '',
      sort_order: String(cat.sort_order ?? 0),
    });
    setError('');
    setModalOpen(true);
  };

  const handleDelete = async (cat: AnyRow) => {
    const children = childrenOf(cat.id);
    const msg = children.length > 0
      ? `确定要删除分类「${cat.name_zh || cat.name_en}」及其 ${children.length} 个子分类吗？`
      : `确定要删除分类「${cat.name_zh || cat.name_en}」吗？`;
    if (!confirm(msg)) return;
    const result = await deleteCategory(cat.id);
    if (result.error) alert(result.error);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData();
    fd.set('slug', formData.slug);
    fd.set('name_en', formData.name_en);
    fd.set('name_zh', formData.name_zh);
    fd.set('icon', formData.icon);
    fd.set('parent_id', formData.parent_id);
    fd.set('sort_order', formData.sort_order);

    const result = editingId
      ? await updateCategory(editingId, fd)
      : await addCategory(fd);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setModalOpen(false);
      setLoading(false);
    }
  };

  const updateField = (field: keyof CategoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">商家分类管理</h2>
        <button onClick={() => openAddModal()} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">
          + 添加分类
        </button>
      </div>

      <div className="card overflow-hidden">
        {parents.length === 0 ? (
          <div className="p-6 text-center text-text-muted">暂无商家分类</div>
        ) : (
          <div className="divide-y divide-border">
            {parents.map(parent => {
              const children = childrenOf(parent.id);
              const isExpanded = expanded[parent.id] ?? true;
              return (
                <div key={parent.id}>
                  {/* Parent row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-page/50">
                    <button
                      onClick={() => toggleExpand(parent.id)}
                      className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary rounded"
                      title={isExpanded ? '收起' : '展开'}
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <span className="text-xl" title="图标">{parent.icon || '📁'}</span>
                    <span className="font-medium">{parent.name_zh || '—'}</span>
                    <span className="text-text-secondary text-sm">{parent.name_en || '—'}</span>
                    <span className="font-mono text-xs text-text-muted bg-bg-page px-2 py-0.5 rounded">{parent.slug}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => openAddModal(parent.id)} className="text-xs text-primary hover:underline">添加子分类</button>
                      <button onClick={() => openEditModal(parent)} className="text-xs text-primary hover:underline">编辑</button>
                      <button onClick={() => handleDelete(parent)} className="text-xs text-red-600 hover:underline">删除</button>
                    </div>
                  </div>

                  {/* Children */}
                  {isExpanded && children.length > 0 && (
                    <div className="bg-bg-page/30">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 pl-14 hover:bg-bg-page/50 border-t border-border/50">
                          <span className="text-lg">{child.icon || '📄'}</span>
                          <span className="text-sm font-medium">{child.name_zh || '—'}</span>
                          <span className="text-text-secondary text-xs">{child.name_en || '—'}</span>
                          <span className="font-mono text-xs text-text-muted bg-bg-page px-2 py-0.5 rounded">{child.slug}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => openEditModal(child)} className="text-xs text-primary hover:underline">编辑</button>
                            <button onClick={() => handleDelete(child)} className="text-xs text-red-600 hover:underline">删除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-[520px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingId ? '编辑分类' : '添加分类'}</h3>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    value={formData.slug}
                    onChange={e => updateField('slug', e.target.value)}
                    required
                    placeholder="e.g. restaurant"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">图标（Emoji）</label>
                  <input
                    value={formData.icon}
                    onChange={e => updateField('icon', e.target.value)}
                    placeholder="e.g. 🍜"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">英文名 *</label>
                  <input
                    value={formData.name_en}
                    onChange={e => updateField('name_en', e.target.value)}
                    required
                    placeholder="e.g. Restaurant"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">中文名</label>
                  <input
                    value={formData.name_zh}
                    onChange={e => updateField('name_zh', e.target.value)}
                    placeholder="e.g. 餐厅"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">上级分类</label>
                  <select
                    value={formData.parent_id}
                    onChange={e => updateField('parent_id', e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">无（顶级分类）</option>
                    {parents.filter(p => p.id !== editingId).map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name_zh || p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => updateField('sort_order', e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                  取消
                </button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                  {loading ? '保存中...' : editingId ? '保存修改' : '添加分类'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
