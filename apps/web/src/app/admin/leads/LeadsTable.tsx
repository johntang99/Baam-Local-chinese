'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { updateLeadStatus, deleteLead } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4) + '****';
}

function truncate(text: string | null, max = 50): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const statusBadge: Record<string, { cls: string; label: string }> = {
  new: { cls: 'badge badge-red', label: '新建' },
  contacted: { cls: 'badge badge-blue', label: '已联系' },
  qualified: { cls: 'badge badge-purple', label: '已评估' },
  converted: { cls: 'badge badge-green', label: '已转化' },
  closed: { cls: 'badge badge-gray', label: '已关闭' },
};

const statusOptions = [
  { value: 'new', label: '新建' },
  { value: 'contacted', label: '已联系' },
  { value: 'qualified', label: '已评估' },
  { value: 'converted', label: '已转化' },
  { value: 'closed', label: '已关闭' },
];

interface LeadsTableProps {
  leads: AnyRow[];
}

export default function LeadsTable({ leads }: LeadsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      await updateLeadStatus(id, status);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这条线索吗？')) return;
    startTransition(async () => {
      await deleteLead(id);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>联系人</th>
              <th>电话</th>
              <th>来源</th>
              <th>商家</th>
              <th>AI摘要</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-text-muted py-8">该站点暂无线索</td>
              </tr>
            ) : (
              leads.map((lead) => {
                const sb = statusBadge[lead.status] || { cls: 'badge badge-gray', label: lead.status || '—' };
                return (
                  <tr key={lead.id}>
                    <td className="font-medium">{lead.contact_name || '匿名'}</td>
                    <td className="text-text-secondary">{maskPhone(lead.contact_phone)}</td>
                    <td className="text-sm">{lead.source_type || '—'}</td>
                    <td className="text-sm text-text-muted">{lead.business_name || '—'}</td>
                    <td className="text-text-secondary text-sm max-w-[200px]">
                      <span className="truncate block">{truncate(lead.ai_summary)}</span>
                    </td>
                    <td>
                      <select
                        value={lead.status || 'new'}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        disabled={isPending}
                        className={`text-xs border border-border rounded px-1 py-0.5 bg-white disabled:opacity-50`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-text-muted text-sm">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
