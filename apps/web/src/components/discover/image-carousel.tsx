'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageCarouselProps {
  images: string[];
  title?: string;
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const child = scrollRef.current.children[index] as HTMLElement;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setActiveIndex(index);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);
    setActiveIndex(Math.min(newIndex, images.length - 1));
  }, [images.length]);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="rounded-xl overflow-hidden mb-6">
        <img src={images[0]} alt={title || ''} className="w-full max-h-[600px] object-contain bg-gray-50" />
      </div>
    );
  }

  return (
    <div className="mb-6 relative">
      {/* Scrollable images */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-xl"
        style={{ scrollbarWidth: 'none' }}
      >
        {images.map((img, i) => (
          <div key={i} className="w-full flex-shrink-0 snap-center">
            <img
              src={img}
              alt={`${title || ''} ${i + 1}`}
              className="w-full max-h-[600px] object-contain bg-gray-50"
            />
          </div>
        ))}
      </div>

      {/* Arrow buttons */}
      {activeIndex > 0 && (
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {activeIndex < images.length - 1 && (
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`rounded-full transition-all ${
              i === activeIndex
                ? 'w-5 h-2 bg-primary'
                : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
        {activeIndex + 1} / {images.length}
      </div>
    </div>
  );
}
