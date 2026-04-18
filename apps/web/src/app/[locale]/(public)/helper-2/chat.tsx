'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import { askHelper2 } from './actions';
import {
  readQuickReplyModeFromStorage,
  writeQuickReplyModeToStorage,
  type Helper2QuickReplyMode,
} from '@/lib/helper2-preferences';

const BusinessMapView = dynamic(() => import('@/components/businesses/BusinessMapWrapper'), { ssr: false });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fullContent?: string;
  sources?: {
    type: string;
    title: string;
    url: string;
    snippet?: string;
    isExternal?: boolean;
  }[];
  usedWebFallback?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBusinesses?: any[];
  quickReplies?: string[];
  query?: string;
}

const sourceTypeMeta: Record<string, { icon: string; badgeClass: string }> = {
  '商家': { icon: '🏪', badgeClass: 'bg-secondary-50 text-secondary-dark border-secondary-light' },
  '指南': { icon: '📘', badgeClass: 'bg-accent-green-light text-accent-green border-accent-green' },
  '论坛': { icon: '💬', badgeClass: 'bg-accent-purple-light text-accent-purple border-accent-purple' },
  '发现': { icon: '📝', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  '新闻': { icon: '📰', badgeClass: 'bg-accent-red-light text-accent-red border-accent-red' },
  '活动': { icon: '🎪', badgeClass: 'bg-primary-50 text-primary-dark border-primary-200' },
  '网页': { icon: '🌐', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
};

// Featured categories — shown with 2-column question grid (more questions)
const FEATURED_CATEGORIES = [
  {
    icon: '🍜',
    label: '美食推荐',
    questions: [
      '推荐好吃的法拉盛火锅店',
      '法拉盛好吃的上海菜推荐',
      '法拉盛正宗的川菜馆有哪些？',
      '推荐法拉盛好喝的奶茶店',
      '华埠哪家早茶点心最好？',
      '法拉盛哪里有好吃的韩餐？',
    ],
  },
  {
    icon: '🏥',
    label: '医疗健康',
    questions: [
      '法拉盛哪里有中文牙医？',
      '孩子发烧了，附近有儿科吗？',
      '哪里可以看中医针灸？',
      '推荐一个说中文的家庭医生',
      '法拉盛哪里可以做体检？',
      '配眼镜去哪里比较好？',
    ],
  },
  {
    icon: '📋',
    label: '生活指南',
    questions: [
      '新移民来纽约第一个月先做什么？',
      '怎么考纽约驾照？流程是什么？',
      '纽约租房要注意什么？',
      '孩子上学怎么选学区？',
      '怎么申请白卡医疗保险？',
      '在纽约怎么坐地铁最划算？',
    ],
  },
  {
    icon: '🏠',
    label: '家居生活',
    questions: [
      '水管漏了找谁修比较靠谱？',
      '有推荐的搬家公司吗？',
      '装修房子找哪家比较好？',
      '家里要装空调，找谁？',
      '家里有蟑螂怎么办？',
      '推荐靠谱的开锁师傅',
    ],
  },
];

// Regular categories — shown as single-column list
const SIDE_CATEGORIES = [
  {
    icon: '⚖️',
    label: '法律移民',
    questions: [
      '工卡到期了怎么续？',
      '需要办理移民，找什么律师？',
      '收到交通罚单怎么处理？',
      '离婚需要准备什么材料？',
      '绿卡面谈前要准备哪些文件？',
      '申请入籍要满足什么条件？',
    ],
  },
  {
    icon: '💰',
    label: '财税金融',
    questions: [
      '今年报税有什么新变化？',
      '推荐法拉盛靠谱的报税会计',
      '买房贷款找谁比较好？',
      '新移民怎么开始建立信用？',
      '小生意怎么注册公司和报税？',
      '首次买房首付一般要准备多少？',
    ],
  },
  {
    icon: '👶',
    label: '教育培训',
    questions: [
      '法拉盛有什么好的课后班？',
      '孩子学钢琴哪里比较好？',
      '附近有中文的幼儿园吗？',
      '哪里可以学英语？',
      'SAT/SHSAT 培训班怎么选？',
      '孩子作业跟不上，有推荐辅导班吗？',
    ],
  },
  {
    icon: '💇',
    label: '美容美发',
    questions: [
      '推荐一家好的美甲店',
      '法拉盛哪家理发店剪得好？',
      '想做个SPA放松一下，去哪里？',
      '哪里做半永久眉毛比较好？',
      '皮肤管理做哪些项目比较值？',
      '有靠谱的医美诊所推荐吗？',
    ],
  },
];

const ALL_CATEGORIES = [...FEATURED_CATEGORIES, ...SIDE_CATEGORIES];

const LOADING_MESSAGES = [
  '先帮你抓重点结论...',
  '正在匹配站内商家、指南和论坛内容...',
  '在校对评分与来源，避免给你错信息...',
  '快好了，我会先给你最有用的答案。',
];

function nodeToText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((item) => nodeToText(item)).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const maybeProps = (node as { props?: { children?: unknown } }).props;
    return nodeToText(maybeProps?.children ?? '');
  }
  return '';
}

function nodeContainsAnchor(node: unknown): boolean {
  if (!node) return false;
  if (Array.isArray(node)) return node.some((item) => nodeContainsAnchor(item));
  if (typeof node === 'object') {
    const maybeNode = node as { type?: unknown; props?: { href?: unknown; children?: unknown } };
    if (maybeNode.type === 'a' || maybeNode.props?.href) return true;
    if (typeof maybeNode.type === 'function' && (maybeNode.type as { name?: string }).name === 'a') return true;
    return nodeContainsAnchor(maybeNode.props?.children);
  }
  return false;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function extractPhone(text: string): string | null {
  const phoneMatch = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : null;
}

function looksLikeAddress(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 10) return false;
  const hasDigit = /\d/.test(cleaned);
  const hasStreetWord = /(st|ave|blvd|rd|dr|lane|ln|way|court|ct|place|pl|street|avenue|broadway|ny|usa|flushing|queens)/i.test(cleaned);
  return hasDigit && hasStreetWord;
}

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getLinkClassName(href: string): string {
  if (href.startsWith('tel:') || href.includes('google.com/maps') || href.startsWith('/zh/businesses/')) {
    return 'underline underline-offset-2';
  }
  if (
    href.startsWith('/zh/guides/') ||
    href.startsWith('/zh/news/') ||
    href.startsWith('/zh/forum/') ||
    href.startsWith('/zh/discover/') ||
    href.startsWith('/zh/services/')
  ) {
    // Match "相关来源" card title tone: stronger and cleaner.
    return 'text-text-primary fw-semibold hover:text-primary transition-colors';
  }
  return 'underline underline-offset-2';
}

function extractQuickReplyChips(text: string): string[] {
  if (!text) return [];
  const matches = [...text.matchAll(/`([^`\n]{4,100})`/g)];
  const candidates = matches
    .map((match) => (match[1] || '').trim())
    .filter(Boolean)
    .filter((item) => /改查|筛|优先|人均|订位/.test(item));
  return [...new Set(candidates)].slice(0, 6);
}

// ─── Voice input hook ────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setIsSupported(true);
      const recognition = new SR();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [onResult]);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, isSupported, toggle };
}

const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-5 w-full overflow-x-auto r-xl border border-border">
      <table className="w-full border-collapse text-[13px] leading-6 [&_th]:bg-primary/5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:fw-bold [&_th]:text-text-primary [&_th]:border-b [&_th]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:leading-6 [&_td]:align-top [&_td]:border-b [&_td]:border-border/50 [&_td]:break-words [&_td_p]:my-0 [&_tr:last-child_td]:border-b-0 [&_tr:last-child_td]:fw-semibold [&_tr:last-child_td]:bg-primary/5">
        {children}
      </table>
    </div>
  ),
  hr: () => <hr className="mt-5 mb-7 border-border" />,
  a: ({ href, children, ...props }) => {
    if (!href) {
      return <span>{children}</span>;
    }
    if (href.startsWith('tel:')) {
      return (
        <a href={href} {...props} className={`${getLinkClassName(href)} whitespace-nowrap`}>
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
        className={getLinkClassName(href)}
      >
        {children}
      </a>
    );
  },
  td: ({ children, ...props }) => {
    if (nodeContainsAnchor(children)) return <td {...props}>{children}</td>;
    const text = nodeToText(children).replace(/\s+/g, ' ').trim();
    if (text.length < 5 || /https?:\/\//.test(text)) return <td {...props}>{children}</td>;
    const phone = extractPhone(text);
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized) {
        return (
          <td {...props}>
            <a
              href={`tel:${normalized}`}
              className={`${getLinkClassName(`tel:${normalized}`)} whitespace-nowrap`}
              title={`拨打 ${phone}`}
            >
              {children}
            </a>
          </td>
        );
      }
    }

    if (looksLikeAddress(text)) {
      const mapUrl = buildGoogleMapsUrl(text);
      return (
        <td {...props}>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={getLinkClassName(mapUrl)}
            title="在 Google 地图中打开"
          >
            {children}
          </a>
        </td>
      );
    }

    if (/<br\s*\/?>/i.test(text)) {
      const parts = text.split(/<br\s*\/?>/i).map((part) => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        return (
          <td {...props}>
            {parts.map((part, idx) => (
              <span key={`${part}-${idx}`} className="block leading-5">
                {part}
              </span>
            ))}
          </td>
        );
      }
    }

    return <td {...props}>{children}</td>;
  },
};

interface Helper2ChatProps {
  initialQuery?: string;
}

export function Helper2Chat({ initialQuery }: Helper2ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [renderingAnswer, setRenderingAnswer] = useState(false);
  const [mapExpandedId, setMapExpandedId] = useState<string | null>(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationContext, setLocationContext] = useState('');
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const [quickReplyMode, setQuickReplyMode] = useState<Helper2QuickReplyMode>('fill');
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [autoAsked, setAutoAsked] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleVoiceResult = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);
  const voice = useVoiceInput(handleVoiceResult);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Scroll to top on initial page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setQuickReplyMode(readQuickReplyModeFromStorage());
  }, []);

  // Close location menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationMenuRef.current && !locationMenuRef.current.contains(e.target as Node)) setLocationMenuOpen(false);
    };
    if (locationMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [locationMenuOpen]);

  // Browser back closes expanded map
  useEffect(() => {
    if (!mapExpandedId) return;
    window.history.pushState({ mapExpanded: true }, '');
    const onPop = () => setMapExpandedId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mapExpandedId]);

  useEffect(() => {
    if (!loading && !renderingAnswer) {
      setLoadingStep(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1700);
    return () => clearInterval(timer);
  }, [loading, renderingAnswer]);

  useEffect(() => {
    if (initialQuery && !autoAsked) {
      setAutoAsked(true);
      void handleAsk(initialQuery);
    }
  }, [initialQuery, autoAsked]);

  const progressivelyRenderAnswer = useCallback(
    async (messageId: string, fullContent: string, meta: Pick<Message, 'sources' | 'usedWebFallback' | 'mapBusinesses' | 'quickReplies' | 'query'>) => {
      setRenderingAnswer(true);
      const total = fullContent.length;
      const targetMs = Math.min(12000, Math.max(4200, total * 12));
      const tickMs = 24;
      const estimatedTicks = Math.max(1, Math.floor(targetMs / tickMs));
      const step = Math.max(2, Math.ceil(total / estimatedTicks));
      let index = 0;
      while (index < total) {
        const currentChar = fullContent[index] || '';
        const extraPause = /[，。！？；：\n]/.test(currentChar) ? 26 : 0;
        await new Promise((resolve) => setTimeout(resolve, tickMs + extraPause));
        index = Math.min(index + step, total);
        const chunk = fullContent.slice(0, index);
        setMessages((prev) =>
          prev.map((message) => (message.id === messageId ? { ...message, content: chunk } : message)),
        );
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: fullContent,
                fullContent: undefined,
                sources: meta.sources,
                usedWebFallback: meta.usedWebFallback,
                mapBusinesses: meta.mapBusinesses,
                quickReplies: meta.quickReplies,
                query: meta.query,
              }
            : message,
        ),
      );
      setRenderingAnswer(false);
      inputRef.current?.focus();
    },
    [],
  );

  async function handleAsk(rawQuery: string) {
    let query = rawQuery.trim();
    if (!query || loading) return;
    // Append location context if set and not already in query
    const regionNames = ['法拉盛','日落公园','华埠','曼哈顿','艾姆赫斯特','可乐娜','布鲁克林','本森赫斯特','皇后区','flushing','chinatown','brooklyn'];
    const hasLocation = regionNames.some(r => query.includes(r));
    if (locationContext && !hasLocation) query = `${query} ${locationContext}`;

    const nextHistory = messages.map((message) => ({
      role: message.role,
      content: message.fullContent ?? message.content,
    })) as { role: 'user' | 'assistant'; content: string }[];

    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: query }]);
    setLoading(true);

    const result = await askHelper2(query, nextHistory);
    if (result.error || !result.data) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          content: result.error || '小帮手-2 暂时无法回答',
        },
      ]);
      setLoading(false);
      inputRef.current?.focus();
      return;
    }

    const data = result.data;
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        fullContent: data.answer,
      },
    ]);
    setLoading(false);
    await progressivelyRenderAnswer(assistantId, data.answer, {
      sources: data.sources,
      usedWebFallback: data.usedWebFallback,
      mapBusinesses: data.mapBusinesses,
      quickReplies: data.quickReplies,
      query,
    });
  }

  function handleNewChat() {
    setMessages([]);
    setInput('');
    setLoading(false);
    setRenderingAnswer(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
    inputRef.current?.focus();
  }

  return (
    <div>
      {/* New Chat button */}
      {messages.length > 0 && !loading && !renderingAnswer && (
        <div className="max-w-3xl mx-auto flex justify-end mb-3">
          <button type="button" onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs fw-medium text-text-muted hover:text-primary px-3 py-1.5 r-lg border border-border hover:border-primary/30 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            新对话
          </button>
        </div>
      )}

      <div className="space-y-4 mb-6 min-h-[220px]">
        {messages.length === 0 && !loading && !renderingAnswer && (
          <div className="max-w-5xl mx-auto">
            {/* Even section layout: same width + same card height */}
            <div className="grid gap-4 lg:grid-cols-2 auto-rows-fr">
              {ALL_CATEGORIES.map((cat) => (
                <div key={cat.label} className="h-full bg-bg-card border border-border r-xl p-3">
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <span className="text-base" aria-hidden="true">{cat.icon}</span>
                    <span className="text-xs fw-semibold text-text-primary">{cat.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.questions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void handleAsk(q)}
                        disabled={loading}
                        className="w-full text-left text-[13px] leading-snug text-text-primary bg-bg-card border border-border r-full px-4 py-2 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-text-muted mt-5">
              💡 也可以直接打字 — 我了解 12,000+ 本地商家、生活指南、社区活动等信息
            </p>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`${
                message.role === 'user' ? 'max-w-[90%]' : 'max-w-[96%]'
              } ${
                message.role === 'user'
                  ? 'bg-primary text-text-inverse r-xl r-base px-4 py-3'
                  : 'bg-bg-card border border-border r-xl r-base px-5 py-4'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">🧭</span>
                  <span className="text-xs fw-medium text-primary">小帮手-2</span>
                  {message.usedWebFallback && (
                    <span className="text-[10px] px-1.5 py-0.5 r-base bg-accent-blue-light text-secondary-dark">网页补充</span>
                  )}
                </div>
              )}

              {/* Map + Business list for business results */}
              {message.mapBusinesses && message.mapBusinesses.length > 0 && !message.fullContent && (() => {
                const mapBiz = message.mapBusinesses!.map((b: Record<string, unknown>) => ({
                  id: b.id as string, slug: b.slug as string,
                  name: (b.display_name as string) || '',
                  latitude: Number(b.latitude), longitude: Number(b.longitude),
                  address: (b.address_full as string) || '', phone: (b.phone as string) || undefined,
                  avg_rating: b.avg_rating as number | undefined, review_count: b.review_count as number | undefined,
                }));
                return (
                  <>
                    {/* Fullscreen expanded view */}
                    {mapExpandedId === message.id && (
                      <div className="fixed inset-0 z-[9999] bg-bg-card flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
                          <span className="text-sm fw-semibold">{message.mapBusinesses!.length} 个结果</span>
                          <button type="button" onClick={() => { setMapExpandedId(null); window.history.back(); }}
                            className="text-sm fw-semibold text-primary hover:text-primary/80">← 返回</button>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                          <div className="w-[360px] border-r border-border flex-shrink-0 overflow-y-auto hidden md:block">
                            {message.mapBusinesses!.slice(0, 15).map((b: Record<string, unknown>, i: number) => (
                              <a key={b.id as string} href={`/zh/businesses/${b.slug as string}`}
                                className="block px-4 py-3 border-b border-border-light hover:bg-primary/5">
                                <div className="flex items-start gap-2">
                                  <div className={`w-6 h-6 ${i < 3 ? 'bg-accent-red' : 'bg-primary'} r-full flex items-center justify-center text-text-inverse text-[10px] fw-bold flex-shrink-0`}>{i + 1}</div>
                                  <div>
                                    <div className="text-sm fw-bold">{(b.display_name as string) || ''}</div>
                                    <div className="text-xs text-text-secondary">{(b.avg_rating as number) || '—'}⭐ ({(b.review_count as number) || 0})</div>
                                    {b.phone ? <div className="text-xs text-text-secondary mt-0.5">📞 {String(b.phone)}</div> : null}
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                          <div className="flex-1 relative"><div className="absolute inset-0"><BusinessMapView key="expanded" businesses={mapBiz} height="100%" /></div></div>
                        </div>
                      </div>
                    )}
                    {/* Inline map — hidden when fullscreen is active */}
                    <div className="mb-4" style={{ display: mapExpandedId === message.id ? 'none' : undefined }}>
                      <div className="relative r-xl overflow-hidden border border-border">
                        <BusinessMapView key="inline" businesses={mapBiz} height="400px" />
                        <button type="button" onClick={() => setMapExpandedId(message.id)}
                          className="absolute top-3 left-3 z-[500] bg-bg-card border border-border r-lg px-2.5 py-1.5 text-xs fw-semibold text-text-secondary hover:text-primary hover:border-primary elev-sm transition-colors">
                          ⛶ 展开
                        </button>
                      </div>
                      {/* Business list below map */}
                      <div className="mt-3 space-y-1">
                        {message.mapBusinesses!.slice(0, expandedListId === message.id ? 15 : 5).map((b: Record<string, unknown>, i: number) => {
                          const name = (b.display_name as string) || '';
                          const rating = b.avg_rating as number | null;
                          const reviews = b.review_count as number | null;
                          const phone = b.phone as string | null;
                          const website = b.website_url as string | null;
                          const addr = (b.address_full as string || '').split(',').slice(0, 2).join(',');
                          const desc = (b.short_desc_zh as string) || (b.short_desc_en as string) || '';
                          const rankBg = i < 3 ? 'bg-accent-red' : 'bg-primary';
                          return (
                            <a key={b.id as string} href={`/zh/businesses/${b.slug as string}`}
                              className="flex items-start gap-3 px-3 py-3 r-xl hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/20">
                              <div className={`w-7 h-7 ${rankBg} r-full flex items-center justify-center text-text-inverse text-xs fw-bold flex-shrink-0 mt-0.5`}>{i + 1}</div>
                              <div className="flex-1 min-w-0 flex gap-4 items-center">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm fw-bold mb-0.5 truncate">{name}</div>
                                  <div className="flex items-center gap-1.5 text-xs text-text-primary flex-wrap">
                                    <span className="text-accent-yellow">{'★'.repeat(Math.round(rating || 0))}</span>
                                    <span className="fw-semibold">{rating}</span>
                                    <span className="text-border">·</span>
                                    <span>{(reviews || 0).toLocaleString()} 条评价</span>
                                  </div>
                                  {addr && <div className="text-xs text-text-primary mt-1">{addr}</div>}
                                  <div className="flex items-center gap-3 mt-0.5 text-xs text-text-primary flex-wrap">
                                    {phone && <span>📞 {phone}</span>}
                                    {website && <span className="text-primary truncate max-w-[160px]">🌐 {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}</span>}
                                  </div>
                                </div>
                                {desc && <div className="w-[40%] flex-shrink-0 hidden sm:block"><p className="text-xs leading-4 text-text-primary line-clamp-3">{desc}</p></div>}
                              </div>
                            </a>
                          );
                        })}
                        {message.mapBusinesses!.length > 5 && expandedListId !== message.id && (
                          <button type="button" onClick={() => setExpandedListId(message.id)}
                            className="w-full text-center text-xs text-primary fw-semibold py-2 hover:bg-primary/5 r-lg transition">
                            查看全部 {message.mapBusinesses!.length} 个结果 ↓
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {!message.fullContent && (() => {
                let content = message.content;
                // When map+list card already shows businesses, strip only the table (cards replace it)
                if (message.mapBusinesses && message.mapBusinesses.length > 1) {
                  // Remove markdown tables (replaced by business cards above)
                  content = content.replace(/\n*\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)*/gm, '\n');
                  // Remove header lines like "以下是..." / "共找到..."
                  content = content.replace(/\n*#{0,3}\s*(?:以下是|共找到)[^\n]*\n*/gi, '\n');
                  content = content.replace(/\n{3,}/g, '\n\n').trim();
                }
                // Don't render if content is empty after stripping
                if (!content || content.length < 5) return null;
                return (
                  <div className="text-[15px] leading-7 prose prose-sm max-w-none prose-headings:mb-4 prose-headings:mt-7 prose-p:my-4 prose-li:my-2.5 prose-ul:my-4 prose-ol:my-4 prose-hr:my-5 [&_h1]:text-lg [&_h1]:fw-bold [&_h2]:text-base [&_h2]:fw-bold [&_h3]:text-[15px] [&_h3]:fw-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-7 [&_li_p]:my-1.5 [&_strong]:fw-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {content}
                    </ReactMarkdown>
                  </div>
                );
              })()}
              {message.role === 'assistant' && (() => {
                const extractedChips = extractQuickReplyChips(message.content);
                const serverChips = message.quickReplies || [];
                const quickReplyChips = [...new Set([...serverChips, ...extractedChips])].slice(0, 4);
                if (quickReplyChips.length === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickReplyChips.map((chip) => (
                      <button
                        key={`${message.id}-${chip}`}
                        type="button"
                        onClick={() => {
                          if (quickReplyMode === 'send') {
                            void handleAsk(chip);
                            return;
                          }
                          setInput(chip);
                          inputRef.current?.focus();
                        }}
                        disabled={loading || renderingAnswer}
                        className="text-xs px-2.5 py-1 r-full border border-border bg-bg-page text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted mb-2">来源</p>
                  <div className="space-y-2">
                    {message.sources.slice(0, 8).map((source, i) => {
                      const href = source.isExternal ? source.url : `/zh${source.url}`;
                      const meta = sourceTypeMeta[source.type] || { icon: '📎', badgeClass: 'bg-border-light text-text-secondary border-border' };
                      return (
                        <a key={`${source.title}-${i}`} href={href} target="_blank" rel="noopener noreferrer"
                          className="block r-xl border border-border px-3.5 py-3 hover:bg-bg-page transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 text-[11px] fw-semibold px-2 py-0.5 r-full border ${meta.badgeClass}`}>
                              <span>{meta.icon}</span>
                              <span>{source.type}</span>
                            </span>
                            <span className="text-sm fw-semibold text-text-primary line-clamp-1">{source.title}</span>
                          </div>
                          {source.snippet && <p className="text-xs leading-5 text-text-secondary line-clamp-2">{source.snippet}</p>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feedback buttons */}
              {message.role === 'assistant' && !message.fullContent && (
                <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2">
                  <span className="text-xs text-text-muted">这个回答有帮助吗？</span>
                  <button type="button" className="text-lg hover:scale-125 transition-transform" title="有帮助">👍</button>
                  <button type="button" className="text-lg hover:scale-125 transition-transform" title="没帮助">👎</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {(loading || renderingAnswer) && (
          <div className="flex justify-start">
            <div className="bg-bg-card border border-border r-xl r-base px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🧭</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/40 r-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/40 r-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/40 r-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">
                  {loading ? LOADING_MESSAGES[loadingStep] : '正在逐步展示完整答案...'}
                </span>
              </div>
              <p className="mt-1 ml-6 text-[11px] text-text-muted/80">小提示：你可以继续补充预算、区域或时间范围，我会一起考虑。</p>
            </div>
          </div>
        )}

        <div ref={endRef} />
        </div>{/* end max-w-3xl messages wrapper */}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void handleAsk(input); }} className="sticky bottom-8 max-w-3xl mx-auto">
        <div className="bg-bg-card border-2 border-primary/20 r-xl elev-lg overflow-visible">
          {/* Row 1: Text input */}
          <div className="px-5 pt-4 pb-2">
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || renderingAnswer}
              placeholder={voice.isListening ? '正在听你说...' : '和小帮手聊聊本地生活、推荐、办事...'}
              className="w-full text-[15px] outline-none bg-transparent text-text-primary placeholder:text-text-muted/60"
            />
          </div>
          {/* Row 2: Controls */}
          <div className="flex items-center justify-between px-3 pb-3 pt-0.5">
            <div className="flex items-center gap-1.5">
              {/* "+" location button */}
              <div className="relative" ref={locationMenuRef}>
                <button type="button" onClick={() => setLocationMenuOpen(!locationMenuOpen)}
                  className={`h-8 w-8 flex items-center justify-center r-full border-2 transition-all ${
                    locationContext ? 'border-primary text-text-inverse bg-primary hover:bg-primary/90' : 'border-primary/40 text-primary hover:border-primary hover:bg-primary/10'
                  }`} title="设置位置">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
                {locationMenuOpen && (
                  <div className="absolute bottom-10 left-0 bg-bg-card border border-border r-xl elev-lg p-2 w-[280px] z-50">
                    <p className="text-[10px] text-text-muted px-2 pt-0.5 pb-2 fw-medium uppercase tracking-wide">设置位置</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { label: '法拉盛', value: '法拉盛' }, { label: '日落公园', value: '日落公园' },
                        { label: '曼哈顿华埠', value: '华埠' }, { label: '艾姆赫斯特', value: '艾姆赫斯特' },
                        { label: '布鲁克林', value: '布鲁克林' }, { label: '皇后区', value: '皇后区' },
                        { label: '可乐娜', value: '可乐娜' }, { label: '本森赫斯特', value: '本森赫斯特' },
                      ].map(t => (
                        <button key={t.value} type="button"
                          onClick={() => { setLocationContext(t.value); setLocationMenuOpen(false); }}
                          className={`text-left text-sm px-3 py-2 r-lg transition-colors ${
                            locationContext === t.value ? 'bg-primary/10 text-primary fw-medium' : 'text-text-primary hover:bg-bg-page'
                          }`}>📍 {t.label}</button>
                      ))}
                    </div>
                    {locationContext && (
                      <>
                        <div className="border-t border-border mt-1.5 mb-1" />
                        <button type="button" onClick={() => { setLocationContext(''); setLocationMenuOpen(false); }}
                          className="w-full text-left text-sm px-3 py-2 r-lg text-accent-red hover:bg-accent-red-light">✕ 清除位置</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {locationContext && (
                <span className="inline-flex items-center gap-1 text-xs fw-medium text-primary bg-primary/5 border border-primary/15 r-full px-2 py-0.5">
                  📍 {locationContext}
                  <button type="button" onClick={() => setLocationContext('')} className="hover:text-accent-red text-[10px]">✕</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {voice.isSupported && (
                <button type="button" onClick={voice.toggle} disabled={loading || renderingAnswer}
                  className={`h-9 w-9 flex items-center justify-center r-full transition-all ${
                    voice.isListening ? 'bg-accent-red text-text-inverse animate-pulse elev-md' : 'text-primary/70 hover:text-primary hover:bg-primary/10'
                  } disabled:opacity-50`} title={voice.isListening ? '停止' : '语音输入'}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    {voice.isListening
                      ? <path d="M6 6h12v12H6z" />
                      : <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0012 19a7.001 7.001 0 01-1 0V22h2v-3.07z" />
                    }
                  </svg>
                </button>
              )}
              <button type="submit" disabled={loading || renderingAnswer || !input.trim()}
                className={`h-9 w-9 flex items-center justify-center r-full transition-all ${
                  input.trim() ? 'bg-primary text-text-inverse elev-md hover:bg-primary/90' : 'bg-primary/10 text-primary/40'
                } disabled:opacity-40`} title="发送">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
