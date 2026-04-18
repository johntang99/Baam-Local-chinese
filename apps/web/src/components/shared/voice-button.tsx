'use client';

import { useVoiceInput } from '@/hooks/use-voice-input';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceButton({ onResult, className }: VoiceButtonProps) {
  const { isListening, isSupported, toggleListening } = useVoiceInput(onResult);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`relative flex items-center justify-center transition-all ${
        isListening
          ? 'text-white bg-primary r-full shadow-lg scale-110'
          : 'text-text-muted hover:text-primary hover:bg-primary/5 r-full'
      } ${className || 'w-10 h-10'}`}
      title={isListening ? '点击停止' : '点击开始语音输入'}
    >
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <span className="absolute inset-0 r-full bg-primary/30 animate-ping" />
          <span className="absolute -inset-1 r-full border-2 border-primary/40 animate-pulse" />
        </>
      )}
      <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      {isListening && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-primary fw-semibold whitespace-nowrap">
          录音中...
        </span>
      )}
    </button>
  );
}
