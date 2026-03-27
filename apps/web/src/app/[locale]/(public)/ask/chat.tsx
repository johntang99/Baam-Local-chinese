'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { askXiaoLin } from './actions';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { type: string; title: string; url: string; snippet?: string }[];
}

const SUGGESTED_QUESTIONS = [
  '法拉盛有哪些中文家庭医生？',
  '新移民第一个月要做什么？',
  '报税季有什么需要注意的？',
  '周末带孩子去哪玩？',
  '法拉盛有什么好吃的川菜？',
  '怎么申请驾照？',
];

interface AskChatProps {
  initialQuery?: string;
}

export function AskChat({ initialQuery }: AskChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAutoAsked, setHasAutoAsked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-ask if initial query is provided (from homepage search)
  useEffect(() => {
    if (initialQuery && !hasAutoAsked) {
      setHasAutoAsked(true);
      handleAsk(initialQuery);
    }
  }, [initialQuery, hasAutoAsked]);

  const handleAsk = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    const result = await askXiaoLin(q);

    if (result.error) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.error! }]);
    } else if (result.data) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.data!.answer,
        sources: result.data!.sources,
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      handleAsk(input);
    }
  };

  const sourceTypeColors: Record<string, string> = {
    '商家': 'bg-blue-100 text-blue-700',
    '指南': 'bg-green-100 text-green-700',
    '新闻': 'bg-red-100 text-red-700',
    '论坛': 'bg-purple-100 text-purple-700',
    '活动': 'bg-orange-100 text-orange-700',
    '达人': 'bg-pink-100 text-pink-700',
  };

  return (
    <div>
      {/* Messages */}
      <div className="space-y-4 mb-6 min-h-[200px]">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm mb-6">
              问我任何问题，我会从社区的新闻、指南、商家、论坛、达人和活动中找到答案
            </p>
            {/* Suggested questions inside chat component */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={loading}
                  className="text-xs bg-border-light text-text-secondary px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-3'
                : 'bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">🤖</span>
                  <span className="text-xs font-medium text-primary">小邻</span>
                </div>
              )}
              <div className="text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_hr]:my-3 [&_hr]:border-border">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted mb-2">参考来源：</p>
                  <div className="space-y-1.5">
                    {msg.sources.slice(0, 6).map((source, j) => (
                      <Link
                        key={j}
                        href={`/zh${source.url}`}
                        className="flex items-center gap-2 text-xs hover:bg-bg-page rounded px-2 py-1 -mx-2 transition-colors"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceTypeColors[source.type] || 'bg-gray-100 text-gray-700'}`}>
                          {source.type}
                        </span>
                        <span className="text-text-primary hover:text-primary truncate">{source.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">小邻正在查找...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="sticky bottom-4">
        <div className="flex gap-2 bg-bg-card border border-border rounded-xl p-2 shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问我任何本地生活问题..."
            disabled={loading}
            className="flex-1 h-10 px-3 text-sm outline-none bg-transparent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 px-5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex-shrink-0"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
