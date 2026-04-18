'use client';

import { useState, useCallback, ReactNode } from 'react';
import { PostModal } from './post-modal';

interface DiscoverFeedClientProps {
  children: ReactNode;
  isLoggedIn: boolean;
  currentUserId?: string | null;
}

interface ModalState {
  slug: string;
  preview?: {
    title?: string;
    coverImage?: string;
    authorName?: string;
  };
}

export function DiscoverFeedClient({ children, isLoggedIn, currentUserId }: DiscoverFeedClientProps) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const handleClose = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <>
      <DiscoverFeedContext.Provider value={{ openModal: setModal }}>
        {children}
      </DiscoverFeedContext.Provider>

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

// Context for child cards to trigger modal
import { createContext, useContext } from 'react';

interface DiscoverFeedContextType {
  openModal: (state: ModalState) => void;
}

const DiscoverFeedContext = createContext<DiscoverFeedContextType | null>(null);

export function useDiscoverFeed() {
  return useContext(DiscoverFeedContext);
}
