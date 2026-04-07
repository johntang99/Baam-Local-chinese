'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from './actions';
import {
  readQuickReplyModeFromStorage,
  writeQuickReplyModeToStorage,
  type Helper2QuickReplyMode,
} from '@/lib/helper2-preferences';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface SettingsFormProps {
  profile: AnyRow;
  userEmail: string;
}

export function SettingsForm({ profile, userEmail }: SettingsFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickReplyMode, setQuickReplyMode] = useState<Helper2QuickReplyMode>('fill');
  const router = useRouter();

  useEffect(() => {
    setQuickReplyMode(readQuickReplyModeFromStorage());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.set('display_name', displayName);
    formData.set('username', username);
    formData.set('bio', bio);
    formData.set('headline', headline);

    const result = await updateProfile(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('保存成功！');
      router.refresh();
    }
  };

  const inputClass = 'w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{success}</div>}

      {/* Basic Info */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-base">基本信息</h2>

        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input type="email" value={userEmail} disabled className={`${inputClass} bg-gray-50 text-text-muted`} />
          <p className="text-xs text-text-muted mt-1">邮箱不可更改</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">显示名称 *</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="你的昵称"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">用户名</label>
          <div className="flex items-center">
            <span className="text-sm text-text-muted mr-1">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-text-muted mt-1">只能使用小写字母、数字和下划线</p>
        </div>
      </Card>

      {/* Profile Details */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-base">个人介绍</h2>

        <div>
          <label className="block text-sm font-medium mb-1">一句话介绍</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="例：法拉盛美食探店博主"
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">个人简介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己..."
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
          />
          <p className="text-xs text-text-muted mt-1">{bio.length}/500</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-base">小帮手-2 偏好</h2>
        <p className="text-sm text-text-muted">快捷下一问的点击行为（仅当前浏览器生效）</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="helper2QuickReplyMode"
              checked={quickReplyMode === 'fill'}
              onChange={() => {
                setQuickReplyMode('fill');
                writeQuickReplyModeToStorage('fill');
              }}
            />
            点击仅填充输入框（默认）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="helper2QuickReplyMode"
              checked={quickReplyMode === 'send'}
              onChange={() => {
                setQuickReplyMode('send');
                writeQuickReplyModeToStorage('send');
              }}
            />
            点击即发送
          </label>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-6 text-sm disabled:opacity-50')}>
          {loading ? '保存中...' : '保存设置'}
        </button>
      </div>
    </form>
  );
}
