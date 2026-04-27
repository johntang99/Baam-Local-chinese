'use client';

import { useState, useCallback, ReactNode } from 'react';
import { PostModal } from '@/components/discover/post-modal';

interface ModalState {
  slug: string;
  preview?: {
    title?: string;
    coverImage?: string;
    authorName?: string;
  };
}

interface ShareSectionClientProps {
  children: ReactNode;
  isLoggedIn: boolean;
  currentUserId?: string | null;
}

export function ShareSectionClient({ children, isLoggedIn, currentUserId }: ShareSectionClientProps) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const handleClose = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <>
      <ShareModalContext.Provider value={{ openModal: setModal }}>
        {children}
      </ShareModalContext.Provider>

      {modal && (
        <PostModal
          slug={modal.slug}
          preview={modal.preview}
          isLoggedIn={isLoggedIn}
          currentUserId={currentUserId}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// Context for homepage cards to trigger modal
import { createContext, useContext } from 'react';

interface ShareModalContextType {
  openModal: (state: ModalState) => void;
}

const ShareModalContext = createContext<ShareModalContextType | null>(null);

export function useShareModal() {
  return useContext(ShareModalContext);
}

/** A link that opens modal on desktop, navigates on mobile */
export function ShareCardLink({ href, slug, title, coverImage, authorName, className, style, children }: {
  href: string;
  slug: string;
  title?: string;
  coverImage?: string;
  authorName?: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const modal = useShareModal();

  const handleClick = (e: React.MouseEvent) => {
    if (!modal) return; // no context, fall through to link
    const isDesktop = window.innerWidth >= 768;
    if (!isDesktop) return; // mobile: normal navigation

    e.preventDefault();
    modal.openModal({
      slug,
      preview: { title, coverImage, authorName },
    });
  };

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
