'use client';

import { EditEventModal } from './edit-event-modal';
import { PublishEventModal } from './publish-event-modal';
import { DeleteEventModal } from './delete-event-modal';
import { ShareModal } from './share-modal';

/**
 * ModalProvider - Renders all app modals
 * Add this component to the app layout or page layout
 */
export function ModalProvider() {
  return (
    <>
      <EditEventModal />
      <PublishEventModal />
      <DeleteEventModal />
      <ShareModal />
    </>
  );
}

// Export individual modals for direct use if needed
export { EditEventModal } from './edit-event-modal';
export { PublishEventModal } from './publish-event-modal';
export { DeleteEventModal } from './delete-event-modal';
export { ShareModal } from './share-modal';
