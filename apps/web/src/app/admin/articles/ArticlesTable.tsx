'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { bulkPublish, bulkArchive, deleteArticle, generateAISummary } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const verticalBadge: Record<string, { cls: string; label: string }> = {
  news_alert: { cls: 'badge badge-red', label: '新闻快讯' },
  news_brief: { cls: 'badge badge-blue', label: '新闻简报' },
  news_explainer: { cls: 'badge badge-primary', label: '新闻解读' },
  guide_howto: { cls: 'badge badge-purple', label: '操作指南' },
  guide_checklist: { cls: 'badge badge-purple', label: '清单指南' },
  guide_comparison: { cls: 'badge badge-purple', label: '对比指南' },
};

const statusBadge: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'badge badge-gray', label: '草稿' },
  ai_drafted: { cls: 'badge badge-blue', label: 'AI草稿' },
  human_reviewed: { cls: 'badge badge-yellow', label: '已审核' },
  published: { cls: 'badge badge-green', label: '已发布' },
  archived: { cls: 'badge badge-red', label: '已归档' },
};

interface ArticlesTableProps {
  articles: AnyRow[];
  regionNameMap: Record<string, string>;
  siteParams?: string;
}

export default function ArticlesTable({ articles, regionNameMap, siteParams = '' }: ArticlesTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggleAll = () => {
    if (selected.size === articles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(articles.map((a) => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkPublish = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await bulkPublish(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleBulkArchive = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await bulkArchive(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleBulkAISummary = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await Promise.all(Array.from(selected).map((id) => generateAISummary(id)));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return;
    startTransition(async () => {
      await deleteArticle(id);
      router.refresh();
    });
  };

  return (
    <>
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-page border border-border rounded-lg mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={articles.length > 0 && selected.size === articles.length}
            onChange={toggleAll}
            className="rounded border-gray-300"
          />
          全选
        </label>
        <span className="text-sm text-text-muted">已选 {selected.size} 项</span>
        <div className="flex-1" />
        <button
          onClick={handleBulkPublish}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          批量发布
        </button>
        <button
          onClick={handleBulkArchive}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          批量归档
        </button>
        <button
          onClick={handleBulkAISummary}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI重新生成摘要
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>标题</th>
              <th>类型</th>
              <th>状态</th>
              <th>地区</th>
              <th>作者</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const vb = verticalBadge[a.content_vertical] || { cls: 'badge badge-gray', label: a.content_vertical || '—' };
              const sb = statusBadge[a.editorial_status] || { cls: 'badge badge-gray', label: a.editorial_status || '—' };
              return (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="max-w-xs">
                    <p className="font-medium truncate">{a.title_zh || a.title_en || '无标题'}</p>
                  </td>
                  <td>
                    <span className={`${vb.cls} text-xs`}>{vb.label}</span>
                  </td>
                  <td>
                    <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                  </td>
                  <td className="text-sm text-text-muted">
                    {a.region_id ? (regionNameMap[a.region_id] || '—') : '—'}
                  </td>
                  <td className="text-sm text-text-muted">—</td>
                  <td className="text-sm text-text-muted">
                    {a.published_at ? new Date(a.published_at).toLocaleDateString('zh-CN') : '—'}
                  </td>
                  <td className="flex items-center gap-2">
                    <Link
                      href={`/admin/articles/${a.id}/edit${siteParams ? `?${siteParams}` : ''}`}
                      className="text-xs text-primary hover:underline"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
