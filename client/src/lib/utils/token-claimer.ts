import { userClient } from '@/features/user/api';

export interface UnclaimedToken {
  eventId: string;
  tokenType: 'organizer' | 'participant';
  token: string;
}

export interface ClaimResult {
  success: boolean;
  claimed: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
}

/**
 * Scans localStorage for unclaimed event tokens
 * Returns array of tokens that need to be claimed
 *
 * NOTE: Only returns pt_ tokens (current backend format)
 * Obsolete ot_ tokens from old backend versions are ignored
 */
export function scanLocalStorageForTokens(): UnclaimedToken[] {
  // SSR check
  if (typeof window === 'undefined') {
    return [];
  }

  const unclaimed: UnclaimedToken[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Only scan for participant_token_ keys
      // Backend only accepts pt_ tokens (participant tokens for everyone, including organizers)
      if (key.startsWith('participant_token_')) {
        const eventId = key.replace('participant_token_', '');
        const token = localStorage.getItem(key);

        // Validate token format: must start with pt_ and be 67 chars total
        if (token && token.startsWith('pt_') && token.length === 67) {
          unclaimed.push({ eventId, tokenType: 'participant', token });
        } else {
          console.warn(`[Token Scanner] Invalid token format for ${eventId}, skipping`);
        }
      }

      // Skip organizer_token_ keys - these are from old backend version (ot_ prefix)
      // Current backend only uses pt_ tokens for everyone
    }
  } catch (error) {
    console.error('Error scanning localStorage for tokens:', error);
  }

  return unclaimed;
}

/**
 * Removes obsolete organizer tokens (ot_ prefix) from localStorage
 * These are from an old backend version and are no longer valid
 *
 * IMPORTANT: Only removes tokens with ot_ prefix, not pt_ prefix
 */
export function cleanupObsoleteTokens(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  let cleaned = 0;

  try {
    const keysToRemove: string[] = [];

    // Find organizer_token_ keys that have obsolete ot_ prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('organizer_token_')) {
        const token = localStorage.getItem(key);

        // Only remove if token has ot_ prefix (old format)
        // Keep tokens with pt_ prefix (new format - valid)
        if (token && token.startsWith('ot_')) {
          keysToRemove.push(key);
          // Also remove associated participant ID
          const eventId = key.replace('organizer_token_', '');
          keysToRemove.push(`organizer_participant_id_${eventId}`);
        }
      }
    }

    // Remove them
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      cleaned++;
    });

    if (cleaned > 0) {
      console.warn(`[Token Cleanup] Removed ${cleaned} obsolete ot_ tokens from localStorage`);
    }
  } catch (error) {
    console.error('Error cleaning up obsolete tokens:', error);
  }

  return cleaned;
}

/**
 * Claims all provided tokens and cleans up localStorage
 * Handles partial failures gracefully
 */
export async function claimAllTokens(tokens: UnclaimedToken[]): Promise<ClaimResult> {
  if (tokens.length === 0) {
    return { success: true, claimed: 0, failed: 0, errors: [] };
  }

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        // Call API to claim token
        await userClient.claimEvent({
          eventId: token.eventId,
          participantToken: token.token,
        });

        // Clean up localStorage on success
        localStorage.removeItem(`${token.tokenType}_token_${token.eventId}`);
        if (token.tokenType === 'organizer') {
          localStorage.removeItem(`organizer_participant_id_${token.eventId}`);
        } else {
          localStorage.removeItem(`participant_id_${token.eventId}`);
        }

        return { success: true, eventId: token.eventId };
      } catch (error) {
        return {
          success: false,
          eventId: token.eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  // Aggregate results
  let claimed = 0;
  let failed = 0;
  const errors: Array<{ eventId: string; error: string }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      claimed++;
    } else {
      failed++;
      const errorMessage =
        result.status === 'fulfilled'
          ? result.value.error
          : result.reason?.message || 'Unknown error';
      errors.push({ eventId: tokens[index].eventId, error: errorMessage });
    }
  });

  return {
    success: failed === 0,
    claimed,
    failed,
    errors,
  };
}
