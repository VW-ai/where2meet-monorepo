'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Link, Share2, Download } from 'lucide-react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { invitationFor, shareText } from '@/features/invitation/model/invitation';
import { analyticsEvents } from '@/lib/analytics/events';

type ShareMode = 'draft' | 'published';

async function invitationFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new File([await response.blob()], 'invitation.png', { type: 'image/png' });
  } catch {
    return null;
  }
}

export function ShareModal() {
  const { isShareModalOpen, closeShareModal } = useUIStore();
  const { currentEvent, venueById, hydrateVenue } = useMeetingStore();
  const mode: ShareMode = currentEvent?.publishedAt ? 'published' : 'draft';
  const publishedVenueId = currentEvent?.publishedVenueId ?? null;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const [copied, setCopied] = useState(false);
  const [cardLoaded, setCardLoaded] = useState(false);
  const [cardFile, setCardFile] = useState<File | null>(null);

  // Reset copied state when modal opens
  useEffect(() => {
    if (isShareModalOpen) {
      setCopied(false);
      setCardLoaded(false);
      setCardFile(null);
    }
  }, [isShareModalOpen]);

  useEffect(() => {
    if (isShareModalOpen && publishedVenueId) hydrateVenue(publishedVenueId);
  }, [isShareModalOpen, publishedVenueId, hydrateVenue]);

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeShareModal();
      }
    },
    [closeShareModal]
  );

  useEffect(() => {
    if (isShareModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isShareModalOpen, handleEscape]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/meet/${currentEvent?.id || ''}`;
  const inviteUrl = `/meet/${currentEvent?.id || ''}/invite.png`;
  const invitation = currentEvent
    ? invitationFor(currentEvent, (publishedVenueId && venueById[publishedVenueId]) || null, origin)
    : null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-secure contexts or unsupported browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);

      // Track share event in analytics
      if (currentEvent?.id) {
        analyticsEvents.shareEvent(currentEvent.id, 'link');
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCardLoad = async () => {
    setCardLoaded(true);
    if (canShare) setCardFile(await invitationFile(inviteUrl));
  };

  const handleShare = async () => {
    if (!currentEvent || !invitation) return;
    const data: ShareData = { title: invitation.title, text: shareText(invitation), url: shareUrl };
    if (cardFile && navigator.canShare?.({ files: [cardFile] })) data.files = [cardFile];
    try {
      await navigator.share(data);
      analyticsEvents.shareEvent(currentEvent.id, 'social');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to share:', err);
    }
  };

  if (!isShareModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeShareModal}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            {mode === 'published' ? 'Invitation' : 'Share Event'}
          </h2>
          <button
            onClick={closeShareModal}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {mode === 'published' && invitation ? (
            <>
              <p className="text-sm text-muted-foreground">
                Send this to everyone who&apos;s coming.
              </p>

              <div className="relative aspect-[40/21] overflow-hidden rounded-xl border border-border bg-gray-50">
                {!cardLoaded && <div className="absolute inset-0 animate-pulse bg-gray-100" />}
                <img
                  src={inviteUrl}
                  alt={`Invitation for ${invitation.title}`}
                  width={1200}
                  height={630}
                  onLoad={handleCardLoad}
                  className={`w-full h-auto transition-opacity duration-300 ${cardLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
              <p className="text-sm text-muted-foreground">{shareText(invitation)}</p>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                {canShare && (
                  <button
                    onClick={handleShare}
                    className="col-span-2 sm:flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap bg-coral-500 text-white rounded-full hover:bg-coral-600 transition-all duration-200"
                  >
                    <Share2 className="w-4 h-4" />
                    Share…
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="sm:flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-mint-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Copy link
                </button>
                <a
                  href={inviteUrl}
                  download="invitation.png"
                  className="sm:flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Download image
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Share this link with participants so they can join and vote on venues.
              </p>

              {/* Event Title */}
              {currentEvent?.title && (
                <div className="p-3 bg-coral-50 rounded-xl border border-coral-100">
                  <p className="text-sm font-medium text-coral-700">{currentEvent.title}</p>
                </div>
              )}
            </>
          )}

          {/* Share Link */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-border overflow-hidden">
              <Link className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate font-mono min-w-0">{shareUrl}</span>
            </div>
            {mode === 'draft' && (
              <button
                onClick={handleCopy}
                className={`p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
                  copied ? 'bg-mint-500 text-white' : 'bg-coral-500 text-white hover:bg-coral-600'
                }`}
                aria-label={copied ? 'Copied!' : 'Copy link'}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            )}
          </div>

          {/* Success message */}
          {copied && (
            <p className="text-sm text-mint-600 text-center animate-in fade-in duration-200">
              Link copied to clipboard!
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-6">
          <button
            onClick={closeShareModal}
            className="w-full px-4 py-3 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
