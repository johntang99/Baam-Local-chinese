'use client';

import { ReactNode, Children } from 'react';

interface MasonryGridProps {
  children: ReactNode;
  columns?: number;
}

export function MasonryGrid({ children, columns = 3 }: MasonryGridProps) {
  // Distribute children across columns in left-to-right order
  const items = Children.toArray(children);
  const cols: ReactNode[][] = Array.from({ length: columns }, () => []);

  items.forEach((child, i) => {
    cols[i % columns].push(child);
  });

  return (
    <div className="flex gap-3 sm:gap-4">
      {cols.map((colItems, colIndex) => (
        <div key={colIndex} className="flex-1 min-w-0 space-y-3 sm:space-y-4">
          {colItems}
        </div>
      ))}
    </div>
  );
}
