'use client';

import { useEffect } from 'react';

const HISTORY_KEY = 'baam-browsing-history';
const MAX_HISTORY = 50;

interface HistoryEntry {
  title: string;
  url: string;
  source: string;
  time: string;
}

export function BrowsingTracker({ title, source }: { title: string; source: string }) {
  useEffect(() => {
    if (!title) return;
    try {
      const url = window.location.pathname;
      const existing: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      // Remove duplicate if same URL visited again
      const filtered = existing.filter(h => h.url !== url);
      const entry: HistoryEntry = {
        title,
        url,
        source,
        time: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
      filtered.unshift(entry);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
    } catch { /* localStorage might be unavailable */ }
  }, [title, source]);

  return null;
}
