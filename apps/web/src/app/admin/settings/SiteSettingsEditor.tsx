'use client';

import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

type SettingKey = 'header' | 'navigation' | 'footer' | 'seo';

interface Props {
  siteId: string;
  settingKey: SettingKey;
  initialValue: AnyRow | null;
}

const LABELS: Record<SettingKey, { title: string; description: string }> = {
  header: { title: 'Header 设置', description: '配置网站顶部标题栏：Logo、品牌名、位置显示等' },
  navigation: { title: '导航管理', description: '管理顶部导航菜单项：添加、删除、排序、显示/隐藏' },
  footer: { title: 'Footer 页脚', description: '配置网站底部：品牌描述、链接分组、社交媒体、版权信息' },
  seo: { title: 'SEO 搜索优化', description: '配置全局 SEO：默认标题、描述、关键词、Open Graph 图片' },
};

export function SiteSettingsEditor({ siteId, settingKey, initialValue }: Props) {
  const [value, setValue] = useState<string>(JSON.stringify(initialValue || {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'form' | 'json'>('form');

  const label = LABELS[settingKey];
  const parsed = (() => { try { return JSON.parse(value); } catch { return null; } })();

  async function handleSave() {
    setSaving(true);
    setMessage('');

    let jsonValue: AnyRow;
    try {
      jsonValue = JSON.parse(value);
    } catch {
      setMessage('❌ JSON 格式错误');
      setSaving(false);
      return;
    }

    const resp = await fetch('/admin/settings/api/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, settingKey, value: jsonValue }),
    });

    const result = await resp.json();
    setSaving(false);

    if (result.error) {
      setMessage('❌ ' + result.error);
    } else {
      setMessage('✅ 已保存');
      setTimeout(() => setMessage(''), 3000);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{label.title}</h2>
          <p className="text-sm text-gray-500">{label.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'form' ? 'json' : 'form')}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {mode === 'form' ? '切换到 JSON' : '切换到表单'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {mode === 'json' ? (
          /* JSON Editor */
          <div className="p-4">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-[500px] font-mono text-sm p-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              spellCheck={false}
            />
          </div>
        ) : (
          /* Form Editor */
          <div className="p-6 space-y-6">
            {settingKey === 'header' && parsed && <HeaderForm data={parsed} onChange={(d) => setValue(JSON.stringify(d, null, 2))} />}
            {settingKey === 'navigation' && parsed && <NavigationForm data={parsed} onChange={(d) => setValue(JSON.stringify(d, null, 2))} />}
            {settingKey === 'footer' && parsed && <FooterForm data={parsed} onChange={(d) => setValue(JSON.stringify(d, null, 2))} />}
            {settingKey === 'seo' && parsed && <SeoForm data={parsed} onChange={(d) => setValue(JSON.stringify(d, null, 2))} />}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
          <span className="text-sm text-gray-500">{message}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存设置'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Header Form ────────────────────────────────────────────────

function HeaderForm({ data, onChange }: { data: AnyRow; onChange: (d: AnyRow) => void }) {
  const update = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const logo = data.logo || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo 文字</label>
          <input value={logo.text || ''} onChange={(e) => update('logo', { ...logo, text: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo 图标字母</label>
          <input value={logo.icon || ''} onChange={(e) => update('logo', { ...logo, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">品牌标语</label>
          <input value={data.brand_tagline || ''} onChange={(e) => update('brand_tagline', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">位置文字</label>
          <input value={data.location_text || ''} onChange={(e) => update('location_text', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={data.show_location ?? true} onChange={(e) => update('show_location', e.target.checked)} />
          显示位置标识
        </label>
      </div>
    </div>
  );
}

// ─── Navigation Form ────────────────────────────────────────────

function NavigationForm({ data, onChange }: { data: AnyRow; onChange: (d: AnyRow) => void }) {
  const items = (data.items || []) as AnyRow[];

  const updateItem = (idx: number, key: string, val: unknown) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [key]: val };
    onChange({ ...data, items: newItems });
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    newItems.forEach((item, i) => { item.sort = i + 1; });
    onChange({ ...data, items: newItems });
  };

  const addItem = () => {
    onChange({ ...data, items: [...items, { href: '/new', label_zh: '新页面', label_en: 'New Page', visible: true, sort: items.length + 1 }] });
  };

  const removeItem = (idx: number) => {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 mb-2">拖动排序 · 点击眼睛图标显示/隐藏 · 编辑后点击保存</div>
      {items.map((item, idx) => (
        <div key={idx} className={`flex items-center gap-3 p-3 border rounded-lg ${item.visible ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
          <div className="flex flex-col gap-1">
            <button onClick={() => moveItem(idx, -1)} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
            <button onClick={() => moveItem(idx, 1)} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
          </div>
          <span className="text-xs text-gray-400 w-6">{idx + 1}</span>
          <input value={item.label_zh || ''} onChange={(e) => updateItem(idx, 'label_zh', e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm" placeholder="中文名" />
          <input value={item.label_en || ''} onChange={(e) => updateItem(idx, 'label_en', e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm" placeholder="English" />
          <input value={item.href || ''} onChange={(e) => updateItem(idx, 'href', e.target.value)}
            className="w-32 px-2 py-1.5 border border-gray-200 rounded text-sm font-mono" placeholder="/path" />
          <button onClick={() => updateItem(idx, 'visible', !item.visible)}
            className={`text-lg ${item.visible ? 'text-green-500' : 'text-gray-300'}`}>
            {item.visible ? '👁' : '🚫'}
          </button>
          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      ))}
      <button onClick={addItem} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">
        + 添加导航项
      </button>
    </div>
  );
}

// ─── Footer Form ────────────────────────────────────────────────

function FooterForm({ data, onChange }: { data: AnyRow; onChange: (d: AnyRow) => void }) {
  const update = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const sections = (data.sections || []) as AnyRow[];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">品牌描述</label>
        <textarea value={data.brand_description || ''} onChange={(e) => update('brand_description', e.target.value)}
          rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
      </div>

      {sections.map((section, sIdx) => (
        <div key={sIdx} className="border border-gray-200 rounded-lg p-4">
          <input value={section.title || ''} onChange={(e) => {
            const newSections = [...sections];
            newSections[sIdx] = { ...section, title: e.target.value };
            update('sections', newSections);
          }} className="font-semibold text-sm mb-3 px-2 py-1 border border-gray-200 rounded w-full" />
          <div className="space-y-2">
            {(section.links || []).map((link: AnyRow, lIdx: number) => (
              <div key={lIdx} className="flex gap-2">
                <input value={link.label || ''} onChange={(e) => {
                  const newSections = [...sections];
                  const newLinks = [...(section.links || [])];
                  newLinks[lIdx] = { ...link, label: e.target.value };
                  newSections[sIdx] = { ...section, links: newLinks };
                  update('sections', newSections);
                }} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm" placeholder="标签" />
                <input value={link.href || ''} onChange={(e) => {
                  const newSections = [...sections];
                  const newLinks = [...(section.links || [])];
                  newLinks[lIdx] = { ...link, href: e.target.value };
                  newSections[sIdx] = { ...section, links: newLinks };
                  update('sections', newSections);
                }} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm font-mono" placeholder="/path" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">版权信息</label>
          <input value={data.copyright || ''} onChange={(e) => update('copyright', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="© {year} Brand" />
        </div>
      </div>
    </div>
  );
}

// ─── SEO Form ───────────────────────────────────────────────────

function SeoForm({ data, onChange }: { data: AnyRow; onChange: (d: AnyRow) => void }) {
  const update = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">默认标题 (Default Title)</label>
        <input value={data.default_title || ''} onChange={(e) => update('default_title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <p className="text-xs text-gray-400 mt-1">首页标题，显示在浏览器标签页</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">标题模板 (Title Template)</label>
        <input value={data.title_template || ''} onChange={(e) => update('title_template', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="{page} · Brand" />
        <p className="text-xs text-gray-400 mt-1">子页面标题格式，{'{page}'} 会被替换为页面名称</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">网站描述 (Meta Description)</label>
        <textarea value={data.description || ''} onChange={(e) => update('description', e.target.value)}
          rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
        <p className="text-xs text-gray-400 mt-1">搜索引擎结果中显示的描述文字，建议 150 字以内</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">关键词 (Keywords)</label>
        <input value={(data.keywords || []).join(', ')} onChange={(e) => update('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="关键词1, 关键词2, ..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
          <input value={data.og_image_url || ''} onChange={(e) => update('og_image_url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">语言 (Locale)</label>
          <input value={data.locale || ''} onChange={(e) => update('locale', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="zh-CN" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Site Verification</label>
          <input value={data.google_site_verification || ''} onChange={(e) => update('google_site_verification', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Analytics ID</label>
          <input value={data.analytics_id || ''} onChange={(e) => update('analytics_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="G-XXXXXXXXXX" />
        </div>
      </div>
    </div>
  );
}
