'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Continuous Chinese speech-to-text using Web Speech API.
 * - Click once to start, again to stop
 * - Auto-stops after 20s of true silence (no audio activity at all)
 * - Restarts recognition instances to survive Chrome session endings
 * - Uses interimResults + speech lifecycle events for reliable idle detection
 */
export function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const wantRef = useRef(false);
  const currentRecRef = useRef<SpeechRecognition | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearRestartTimer();
    clearIdleTimer();
  }, [clearRestartTimer, clearIdleTimer]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      wantRef.current = false;
      const rec = currentRecRef.current;
      currentRecRef.current = null;
      if (rec) { try { rec.stop(); } catch {} }
      setIsListening(false);
      clearAllTimers();
    }, 20000);
  }, [clearIdleTimer, clearAllTimers]);

  const scheduleRestart = useCallback((delay = 300) => {
    clearRestartTimer();
    if (!wantRef.current) return;
    restartTimerRef.current = setTimeout(() => {
      if (!wantRef.current || currentRecRef.current || isStartingRef.current) return;
      createAndStart();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRestartTimer]);

  const createAndStart = useCallback(() => {
    if (!wantRef.current || currentRecRef.current || isStartingRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    isStartingRef.current = true;

    const rec = new SR();
    currentRecRef.current = rec;
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;   // Key fix: get interim results so we detect active speech
    rec.maxAlternatives = 1;

    // Reset idle timer on ALL speech lifecycle events — not just onresult
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rec as any;
    r.onstart = () => { isStartingRef.current = false; resetIdleTimer(); };
    r.onaudiostart = () => { resetIdleTimer(); };
    r.onsoundstart = () => { resetIdleTimer(); };
    r.onspeechstart = () => { resetIdleTimer(); };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      resetIdleTimer();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        // Only send final text to parent — not interim
        if (result.isFinal) {
          const text = result[0]?.transcript?.trim();
          if (text) onResultRef.current(text);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const err = e?.error || '';
      // Recoverable errors — restart
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') {
        currentRecRef.current = null;
        isStartingRef.current = false;
        if (wantRef.current) scheduleRestart(500);
        else { setIsListening(false); clearAllTimers(); }
        return;
      }
      // Hard failure (permission denied, etc)
      wantRef.current = false;
      currentRecRef.current = null;
      isStartingRef.current = false;
      setIsListening(false);
      clearAllTimers();
    };

    rec.onend = () => {
      currentRecRef.current = null;
      isStartingRef.current = false;
      if (wantRef.current) {
        scheduleRestart(300);
      } else {
        setIsListening(false);
        clearAllTimers();
      }
    };

    try {
      rec.start();
    } catch {
      currentRecRef.current = null;
      isStartingRef.current = false;
      if (wantRef.current) scheduleRestart(500);
      else setIsListening(false);
    }
  }, [resetIdleTimer, clearAllTimers, scheduleRestart]);

  const startListening = useCallback(() => {
    if (wantRef.current) return;
    wantRef.current = true;
    setIsListening(true);
    resetIdleTimer();
    createAndStart();
  }, [createAndStart, resetIdleTimer]);

  const stopListening = useCallback(() => {
    wantRef.current = false;
    clearAllTimers();
    const rec = currentRecRef.current;
    currentRecRef.current = null;
    isStartingRef.current = false;
    if (rec) { try { rec.stop(); } catch {} }
    setIsListening(false);
  }, [clearAllTimers]);

  const toggleListening = useCallback(() => {
    if (wantRef.current) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      const rec = currentRecRef.current;
      currentRecRef.current = null;
      if (rec) { try { rec.stop(); } catch {} }
    };
  }, []);

  return { isListening, isSupported, startListening, stopListening, toggleListening };
}
