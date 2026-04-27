'use client';

import { useState, useCallback } from 'react';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { cn } from '@/lib/utils';

interface VisaCategory {
  code: string;
  name: string;
  match: 'high' | 'medium' | 'low';
  description: string;
  processingTime: string;
  employerRequired: boolean;
  requirements: string[];
  pros: string[];
  cons: string[];
}

interface ScreenerResult {
  categories: VisaCategory[];
  notes: string[];
  nextSteps: string;
  disclaimer: string;
}

interface FormData {
  goal: string;
  citizenship: string;
  birthCountry: string;
  currentLocation: string;
  currentStatus: string;
  occupation: string;
  yearsExperience: string;
  hasEmployerSponsor: string;
  salaryRange: string;
  hasUSCitizenFamily: boolean;
  hasLPRFamily: boolean;
  familyRelationship: string;
  highestDegree: string;
  fieldOfStudy: string;
  hasExtraordinaryAchievements: boolean;
}

const GOALS = [
  { value: '在美国工作', icon: '🎯', en: 'Work in the US' },
  { value: '在美国学习', icon: '🎓', en: 'Study in the US' },
  { value: '获得绿卡/永久居留', icon: '🏠', en: 'Get green card' },
  { value: '与家人团聚', icon: '👨‍👩‍👧‍👦', en: 'Family reunification' },
  { value: '在美国创业/投资', icon: '🏢', en: 'Start business / invest' },
  { value: '寻求庇护/保护', icon: '🆘', en: 'Seek asylum / protection' },
];

const STATUSES = [
  '无签证（在中国）', 'B1/B2 旅游签证', 'F1 学生签证', 'H1B 工作签证',
  'L1 跨国调派签证', 'O1 杰出人才签证', 'J1 交流访问签证', 'E2 投资者签证',
  '已有绿卡（想了解入籍）', '其他签证', '逾期居留',
];

const DEGREES = ['高中及以下', '大专', '本科 (Bachelor)', '硕士 (Master)', '博士 (PhD/MD/JD)', '其他专业学位'];

const MATCH_STYLES = {
  high: { bg: 'border-green-300 bg-accent-green-light', badge: 'bg-accent-green text-text-inverse', label: '高度匹配' },
  medium: { bg: 'border-accent-yellow bg-accent-yellow/20', badge: 'bg-accent-yellow text-text-inverse', label: '可能匹配' },
  low: { bg: 'border-blue-300 bg-secondary-50', badge: 'bg-secondary text-text-inverse', label: '值得探索' },
};

const TOTAL_STEPS = 6;

export function ScreenerClient() {
  const { convert } = useChineseScript();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [form, setForm] = useState<FormData>({
    goal: '', citizenship: '中国', birthCountry: '中国', currentLocation: '在美国',
    currentStatus: '', occupation: '', yearsExperience: '', hasEmployerSponsor: '',
    salaryRange: '', hasUSCitizenFamily: false, hasLPRFamily: false, familyRelationship: '',
    highestDegree: '', fieldOfStudy: '', hasExtraordinaryAchievements: false,
  });

  const updateForm = (key: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!form.goal;
      case 2: return !!form.citizenship;
      case 3: return !!form.currentStatus;
      case 4: return true; // Optional fields
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/immigration/visa-screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.status === 429) { setError('查询过于频繁，请稍后再试'); return; }
      if (!res.ok) { setError('评估失败，请稍后重试'); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('网络错误，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSubmit();
  };

  const handleRestart = () => {
    setStep(1);
    setResult(null);
    setError('');
    setForm({
      goal: '', citizenship: '中国', birthCountry: '中国', currentLocation: '在美国',
      currentStatus: '', occupation: '', yearsExperience: '', hasEmployerSponsor: '',
      salaryRange: '', hasUSCitizenFamily: false, hasLPRFamily: false, familyRelationship: '',
      highestDegree: '', fieldOfStudy: '', hasExtraordinaryAchievements: false,
    });
  };

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="bg-bg-card border border-border r-xl p-12 text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent r-full animate-spin mx-auto mb-6" />
        <h3 className="text-lg fw-bold text-text-primary mb-2">{convert('正在分析你的情况...')}</h3>
        <p className="text-sm text-text-secondary">{convert('基于你提供的信息，我们正在评估可能适合你的签证类别')}</p>
      </div>
    );
  }

  // Helper: build summary items from form data
  const getSummaryItems = () => {
    const items: { label: string; value: string }[] = [];
    if (form.goal) items.push({ label: '目标', value: form.goal });
    if (form.citizenship) items.push({ label: '国籍', value: form.citizenship });
    if (form.birthCountry && form.birthCountry !== form.citizenship) items.push({ label: '出生地', value: form.birthCountry });
    if (form.currentLocation) items.push({ label: '位置', value: form.currentLocation });
    if (form.currentStatus) items.push({ label: '身份', value: form.currentStatus });
    if (form.occupation) items.push({ label: '职业', value: form.occupation });
    if (form.yearsExperience) items.push({ label: '经验', value: `${form.yearsExperience}年` });
    if (form.hasEmployerSponsor) items.push({ label: '雇主担保', value: form.hasEmployerSponsor });
    if (form.hasUSCitizenFamily) items.push({ label: '美国公民亲属', value: form.familyRelationship || '有' });
    if (form.hasLPRFamily) items.push({ label: '绿卡亲属', value: '有' });
    if (form.highestDegree) items.push({ label: '学历', value: form.highestDegree });
    if (form.fieldOfStudy) items.push({ label: '专业', value: form.fieldOfStudy });
    if (form.hasExtraordinaryAchievements) items.push({ label: '突出成就', value: '有' });
    return items;
  };

  // ─── Results State ───
  if (result) {
    const summaryItems = getSummaryItems();
    return (
      <div>
        {/* User Info Summary */}
        <div className="bg-bg-page border border-border r-xl p-4 mb-6">
          <div className="text-sm fw-bold text-text-primary mb-2">{convert('你的基本信息：')}</div>
          <div className="flex flex-wrap gap-2">
            {summaryItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-bg-card border border-border r-full px-2.5 py-1">
                <span className="text-text-muted">{convert(item.label)}:</span>
                <span className="text-text-secondary fw-medium">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-green-light r-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl fw-bold text-text-primary mb-1">{convert('你的签证资格评估结果')}</h2>
          <p className="text-sm text-text-secondary">{convert('基于你的个人情况，以下是可能适合你的签证类别')}</p>
        </div>

        {/* Category Cards */}
        <div className="space-y-4 mb-8">
          {result.categories.map((cat, i) => {
            const style = MATCH_STYLES[cat.match];
            return (
              <div key={i} className={cn('border-2 r-xl p-5 sm:p-6', style.bg)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('text-xs fw-bold px-2.5 py-1 r-full', style.badge)}>{style.label}</span>
                </div>
                <h3 className="text-lg fw-bold text-text-primary mb-2">{cat.code} {cat.name}</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{cat.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-bg-card/60 r-lg p-3">
                    <div className="text-[10px] text-text-muted mb-0.5">{convert('处理时间')}</div>
                    <div className="text-xs fw-semibold text-text-primary">{cat.processingTime}</div>
                  </div>
                  <div className="bg-bg-card/60 r-lg p-3">
                    <div className="text-[10px] text-text-muted mb-0.5">{convert('雇主要求')}</div>
                    <div className="text-xs fw-semibold text-text-primary">{cat.employerRequired ? convert('需要雇主') : convert('不需要')}</div>
                  </div>
                  {cat.requirements?.[0] && (
                    <div className="bg-bg-card/60 r-lg p-3">
                      <div className="text-[10px] text-text-muted mb-0.5">{convert('关键条件')}</div>
                      <div className="text-xs fw-semibold text-text-primary">{cat.requirements[0]}</div>
                    </div>
                  )}
                </div>

                {(cat.pros?.length > 0 || cat.cons?.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {cat.pros?.length > 0 && (
                      <div>
                        {cat.pros.map((p, j) => (
                          <div key={j} className="flex items-start gap-1.5 mb-1">
                            <span className="text-accent-green mt-0.5">✓</span>
                            <span className="text-text-secondary">{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {cat.cons?.length > 0 && (
                      <div>
                        {cat.cons.map((c, j) => (
                          <div key={j} className="flex items-start gap-1.5 mb-1">
                            <span className="text-accent-yellow mt-0.5">⚠</span>
                            <span className="text-text-secondary">{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {result.notes?.length > 0 && (
          <div className="bg-bg-card border border-border r-xl p-5 mb-6">
            <h3 className="text-sm fw-bold text-text-primary mb-3">{convert('重要提示')}</h3>
            <div className="space-y-2">
              {result.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-accent-yellow flex-shrink-0">⚠️</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
            {result.nextSteps && (
              <div className="mt-3 pt-3 border-t border-border-light">
                <div className="flex items-center gap-2 text-sm fw-bold text-text-primary mb-2">
                  <span>📋</span>
                  <span>{convert('建议行动')}</span>
                </div>
                <div
                  className="text-sm text-text-secondary leading-relaxed prose prose-sm max-w-none [&_strong]:text-text-primary [&_strong]:fw-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{
                    __html: result.nextSteps
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^\d+\.\s+/gm, (m) => `<li>${m.replace(/^\d+\.\s+/, '')}`)
                      .replace(/^[-–]\s+/gm, '• ')
                      .replace(/\n/g, '<br />')
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Consultation CTA */}
        <div className="bg-gradient-to-br from-primary to-primary-dark r-xl p-6 sm:p-8 text-center text-text-inverse mb-6">
          <h3 className="text-lg fw-bold mb-2">{convert('想了解哪个方案最适合你？')}</h3>
          <p className="text-sm text-text-inverse/80 mb-5">{convert('免费咨询移民律师 — 30分钟一对一评估，帮你制定最佳移民策略')}</p>
          <button className="px-8 py-3 bg-bg-card text-primary fw-bold r-xl hover:bg-bg-page transition">
            {convert('预约免费咨询')}
          </button>
          <p className="text-xs text-text-inverse/60 mt-3">{convert('已有 500+ 华人通过Baam找到合适的移民律师')}</p>
        </div>

        {/* Disclaimer */}
        <div className="bg-accent-yellow/20 border border-accent-yellow r-xl p-4 text-xs text-accent-yellow mb-6">
          {result.disclaimer || convert('本评估结果仅供参考，不构成法律建议。具体资格需由持牌移民律师根据您的详细情况判断。')}
        </div>

        {/* Restart */}
        <div className="text-center">
          <button onClick={handleRestart} className="text-sm text-text-muted hover:text-primary transition flex items-center gap-1 mx-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {convert('重新评估')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Form Steps ───
  return (
    <div>
      {error && (
        <div className="bg-accent-red-light border border-accent-red text-accent-red r-xl p-4 mb-6 text-sm">{convert(error)}</div>
      )}

      {/* Previous Answers Summary (shown from step 2+) */}
      {step > 1 && (
        <div className="bg-bg-page border border-border r-xl p-4 mb-6">
          <div className="text-sm fw-bold text-text-primary mb-2">{convert('你填写的信息：')}</div>
          <div className="flex flex-wrap gap-2">
            {getSummaryItems().map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-bg-card border border-border r-full px-2.5 py-1">
                <span className="text-text-muted">{convert(item.label)}:</span>
                <span className="text-text-secondary fw-medium">{item.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center">
            <div className={cn(
              'w-9 h-9 r-full flex items-center justify-center text-sm fw-bold transition cursor-pointer',
              s < step ? 'bg-accent-green text-text-inverse hover:bg-accent-green' :
              s === step ? 'bg-primary text-text-inverse' :
              'bg-border-light text-text-muted'
            )}
            onClick={() => { if (s < step) setStep(s); }}
            >
              {s < step ? '✓' : s}
            </div>
            {s < TOTAL_STEPS && (
              <div className={cn('w-8 h-0.5', s < step ? 'bg-accent-green' : 'bg-border-light')} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-bg-card border border-border r-xl p-5 sm:p-6">
        <div className="text-xs text-text-muted mb-1">Step {step} / {TOTAL_STEPS}</div>

        {/* Step 1: Goal */}
        {step === 1 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-1">{convert('你的目标是什么？')}</h2>
            <p className="text-sm text-text-muted mb-4">{convert('选择最符合你当前需求的选项')}</p>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <button key={g.value} onClick={() => updateForm('goal', g.value)}
                  className={cn('w-full flex items-center gap-3 p-4 border-2 r-xl text-left transition',
                    form.goal === g.value ? 'border-primary bg-primary-50' : 'border-border hover:border-border')}>
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <div className="text-sm fw-semibold text-text-primary">{convert(g.value)}</div>
                    <div className="text-xs text-text-muted">{g.en}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Nationality */}
        {step === 2 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-4">{convert('你的国籍和出生地')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('国籍')}</label>
                <input type="text" value={form.citizenship} onChange={(e) => updateForm('citizenship', e.target.value)}
                  className="w-full h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('出生地（国家）')}</label>
                <input type="text" value={form.birthCountry} onChange={(e) => updateForm('birthCountry', e.target.value)}
                  className="w-full h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('当前位置')}</label>
                <select value={form.currentLocation} onChange={(e) => updateForm('currentLocation', e.target.value)}
                  className="w-full h-11 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none">
                  <option value="在美国">{convert('在美国')}</option>
                  <option value="在中国">{convert('在中国')}</option>
                  <option value="其他国家">{convert('其他国家')}</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Current Status */}
        {step === 3 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-4">{convert('你目前的身份')}</h2>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => updateForm('currentStatus', s)}
                  className={cn('w-full p-3 border-2 r-xl text-left text-sm transition',
                    form.currentStatus === s ? 'border-primary bg-primary-50 fw-medium' : 'border-border hover:border-border')}>
                  {convert(s)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Employment */}
        {step === 4 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-4">{convert('工作和职业信息')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('职业/行业')}</label>
                <input type="text" value={form.occupation} onChange={(e) => updateForm('occupation', e.target.value)}
                  placeholder={convert('如：软件工程师、会计、厨师')}
                  className="w-full h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('工作经验（年）')}</label>
                <select value={form.yearsExperience} onChange={(e) => updateForm('yearsExperience', e.target.value)}
                  className="w-full h-11 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('请选择')}</option>
                  <option value="0-1">0-1年</option><option value="2-5">2-5年</option>
                  <option value="5-10">5-10年</option><option value="10+">10年以上</option>
                </select>
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('雇主是否愿意担保签证/绿卡？')}</label>
                <select value={form.hasEmployerSponsor} onChange={(e) => updateForm('hasEmployerSponsor', e.target.value)}
                  className="w-full h-11 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('请选择')}</option>
                  <option value="是">{convert('是，雇主愿意')}</option>
                  <option value="否">{convert('否 / 不确定')}</option>
                  <option value="自雇">{convert('我是自雇/创业者')}</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Family */}
        {step === 5 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-4">{convert('家庭关系')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-2">{convert('你有美国公民的直系亲属吗？')}</label>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasUSCitizenFamily', true)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      form.hasUSCitizenFamily ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('有')}
                  </button>
                  <button onClick={() => updateForm('hasUSCitizenFamily', false)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      !form.hasUSCitizenFamily ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('没有')}
                  </button>
                </div>
              </div>
              {form.hasUSCitizenFamily && (
                <div>
                  <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('关系')}</label>
                  <select value={form.familyRelationship} onChange={(e) => updateForm('familyRelationship', e.target.value)}
                    className="w-full h-11 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none">
                    <option value="">{convert('请选择')}</option>
                    <option value="配偶">{convert('配偶')}</option>
                    <option value="父母">{convert('父母')}</option>
                    <option value="子女（21岁以上）">{convert('子女（21岁以上）')}</option>
                    <option value="兄弟姐妹">{convert('兄弟姐妹')}</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-2">{convert('你有绿卡持有者的直系亲属吗？')}</label>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasLPRFamily', true)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      form.hasLPRFamily ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('有')}
                  </button>
                  <button onClick={() => updateForm('hasLPRFamily', false)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      !form.hasLPRFamily ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('没有')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 6: Education */}
        {step === 6 && (
          <>
            <h2 className="text-lg fw-bold text-text-primary mb-4">{convert('教育背景')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('最高学历')}</label>
                <select value={form.highestDegree} onChange={(e) => updateForm('highestDegree', e.target.value)}
                  className="w-full h-11 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('请选择')}</option>
                  {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-1.5">{convert('专业领域')}</label>
                <input type="text" value={form.fieldOfStudy} onChange={(e) => updateForm('fieldOfStudy', e.target.value)}
                  placeholder={convert('如：计算机科学、工商管理、电气工程')}
                  className="w-full h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm fw-medium text-text-secondary mb-2">{convert('你在专业领域有突出成就吗？')}</label>
                <p className="text-xs text-text-muted mb-2">{convert('如：发表论文、专利、行业获奖、媒体报道等')}</p>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasExtraordinaryAchievements', true)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      form.hasExtraordinaryAchievements ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('有')}
                  </button>
                  <button onClick={() => updateForm('hasExtraordinaryAchievements', false)}
                    className={cn('flex-1 p-3 border-2 r-xl text-sm text-center transition',
                      !form.hasExtraordinaryAchievements ? 'border-primary bg-primary-50' : 'border-border')}>
                    {convert('没有')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-light">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="text-sm text-text-muted hover:text-text-secondary flex items-center gap-1 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {convert('上一步')}
            </button>
          ) : <div />}
          <button onClick={handleNext} disabled={!canProceed()}
            className="px-6 py-2.5 bg-primary text-text-inverse fw-semibold r-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2">
            {step === TOTAL_STEPS ? convert('获取评估结果') : convert('下一步')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
