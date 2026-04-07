'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askHelper2 } from './actions';
import {
  readQuickReplyModeFromStorage,
  writeQuickReplyModeToStorage,
  type Helper2QuickReplyMode,
} from '@/lib/helper2-preferences';

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
}

const sourceTypeMeta: Record<string, { icon: string; badgeClass: string }> = {
  '商家': { icon: '🏪', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  '指南': { icon: '📘', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
  '论坛': { icon: '💬', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  '笔记': { icon: '📝', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  '达人': { icon: '⭐', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  '新闻': { icon: '📰', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  '活动': { icon: '🎪', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  '网页': { icon: '🌐', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const SUGGESTED_QUESTIONS = [
  '帮我推荐法拉盛适合家庭聚餐的火锅店',
  '最近纽约 DMV 有什么变化？',
  '新移民来纽约第一个月先做什么？',
  '最近法拉盛有没有适合孩子的周末活动？',
  '如果站内没有，你也可以帮我查网页最新信息吗？',
];

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
    const maybeNode = node as { type?: unknown; props?: { children?: unknown } };
    if (maybeNode.type === 'a') return true;
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
    return 'text-text-primary font-semibold hover:text-primary transition-colors';
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
    <div className="my-7 overflow-x-auto rounded-lg border border-border bg-white/60">
      <table className="w-full min-w-[860px] border-collapse text-[13px] leading-6 [&_th]:whitespace-nowrap [&_th]:bg-bg-page [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-text-primary [&_th]:border [&_th]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-[13px] [&_td]:leading-6 [&_td]:align-top [&_td]:border [&_td]:border-border [&_td:nth-child(2)]:min-w-[160px] [&_td:nth-child(2)]:font-semibold [&_td:nth-child(3)]:whitespace-nowrap [&_td:nth-child(4)]:whitespace-nowrap [&_td:nth-child(5)]:whitespace-nowrap [&_td:nth-child(6)]:min-w-[170px] [&_td:nth-child(6)]:whitespace-normal [&_td:nth-child(7)]:min-w-[220px] [&_td:nth-child(7)]:whitespace-normal [&_td_p]:my-0">
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
    if (nodeContainsAnchor(children)) {
      return <td {...props}>{children}</td>;
    }
    const text = nodeToText(children).replace(/\s+/g, ' ').trim();
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
  const [quickReplyMode, setQuickReplyMode] = useState<Helper2QuickReplyMode>('fill');
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
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    setQuickReplyMode(readQuickReplyModeFromStorage());
  }, []);

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
    async (messageId: string, fullContent: string, meta: Pick<Message, 'sources' | 'usedWebFallback'>) => {
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
    const query = rawQuery.trim();
    if (!query || loading) return;

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
    });
  }

  return (
    <div>
      <div className="space-y-4 mb-6 min-h-[220px]">
        {messages.length === 0 && !loading && !renderingAnswer && (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm mb-6">
              这是一个新的中文聊天式本地助手。它会优先结合 Baam 站内内容回答，必要时再补充网页信息。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void handleAsk(question)}
                  disabled={loading}
                  className="text-xs bg-border-light text-text-secondary px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] ${
                message.role === 'user'
                  ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-3'
                  : 'bg-bg-card border border-border rounded-2xl rounded-bl-md px-5 py-4'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">🧭</span>
                  <span className="text-xs font-medium text-primary">小帮手-2</span>
                  {message.usedWebFallback && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">网页补充</span>
                  )}
                </div>
              )}

              <div className="text-[15px] leading-7 prose prose-sm max-w-none prose-headings:mb-4 prose-headings:mt-7 prose-p:my-4 prose-li:my-2.5 prose-ul:my-4 prose-ol:my-4 prose-hr:my-5 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-[15px] [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-7 [&_li_p]:my-1.5 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
              {message.role === 'assistant' && (() => {
                const quickReplyChips = extractQuickReplyChips(message.content);
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
                        className="text-xs px-2.5 py-1 rounded-full border border-border bg-bg-page text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted mb-2">相关来源</p>
                  <div className="space-y-2">
                    {message.sources.slice(0, 8).map((source, sourceIndex) => {
                      const href = source.isExternal ? source.url : `/zh${source.url}`;
                      const meta = sourceTypeMeta[source.type] || {
                        icon: '📎',
                        badgeClass: 'bg-border-light text-text-secondary border-border',
                      };
                      return (
                        <a
                          key={`${source.title}-${sourceIndex}`}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl border border-border px-3.5 py-3 hover:bg-bg-page transition"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
                              <span>{meta.icon}</span>
                              <span>{source.type}</span>
                            </span>
                            <span className="text-sm font-semibold text-text-primary line-clamp-1">{source.title}</span>
                          </div>
                          {source.snippet && (
                            <p className="text-xs leading-5 text-text-secondary line-clamp-2">{source.snippet}</p>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {(loading || renderingAnswer) && (
          <div className="flex justify-start">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🧭</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleAsk(input);
        }}
        className="sticky bottom-4"
      >
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              const nextMode: Helper2QuickReplyMode = quickReplyMode === 'send' ? 'fill' : 'send';
              setQuickReplyMode(nextMode);
              writeQuickReplyModeToStorage(nextMode);
            }}
            className="text-[11px] text-text-muted hover:text-text-primary transition"
          >
            快捷下一问：{quickReplyMode === 'send' ? '点击即发送' : '点击仅填充'}
          </button>
        </div>
        <div className="flex gap-2 bg-bg-card border border-border rounded-xl p-2 shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={loading || renderingAnswer}
            placeholder={voice.isListening ? '正在听你说...' : '和小帮手-2 聊聊本地生活、推荐、办事、最新信息...'}
            className="flex-1 h-10 px-3 text-sm outline-none bg-transparent"
          />
          {voice.isSupported && (
            <button
              type="button"
              onClick={voice.toggle}
              disabled={loading || renderingAnswer}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                voice.isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-bg-page text-text-secondary hover:bg-primary/10 hover:text-primary'
              } disabled:opacity-50`}
              title={voice.isListening ? '停止语音' : '语音输入'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                {voice.isListening ? (
                  <path d="M6 6h12v12H6z" />
                ) : (
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0112 19a7.001 7.001 0 01-1 0V22h2v-3.07z" />
                )}
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={loading || renderingAnswer || !input.trim()}
            className="h-10 px-5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex-shrink-0"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
