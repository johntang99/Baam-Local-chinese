'use client';

import { useRef, useState, useCallback } from 'react';

interface VideoHoverCardProps {
  thumbnailUrl?: string;
  videoUrl: string;
  alt?: string;
}

export function VideoHoverCard({ thumbnailUrl, videoUrl, alt }: VideoHoverCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleEnter = useCallback(() => {
    setHovering(true);
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleLeave = useCallback(() => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  return (
    <div
      className="w-full h-full relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Thumbnail — visible when not hovering */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={alt || ''}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${hovering ? 'opacity-0' : 'opacity-100'}`}
        />
      )}

      {/* Video — plays on hover */}
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        preload="none"
        className={`w-full h-full object-cover transition-opacity duration-300 ${hovering ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Play icon — hidden when hovering */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${hovering ? 'opacity-0' : 'opacity-100'}`}>
        <div className="w-9 h-9 r-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
