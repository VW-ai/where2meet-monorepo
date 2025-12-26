import { api } from '@/lib/api';

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

      if (key.startsWith('organizer_token_')) {
        const eventId = key.replace('organizer_token_', '');
        const token = localStorage.getItem(key);
        if (token) {
          unclaimed.push({ eventId, tokenType: 'organizer', token });
        }
      } else if (key.startsWith('participant_token_')) {
        const eventId = key.replace('participant_token_', '');
        const token = localStorage.getItem(key);
        if (token) {
          unclaimed.push({ eventId, tokenType: 'participant', token });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning localStorage for tokens:', error);
  }

  return unclaimed;
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
        await api.auth.claimToken({
          eventId: token.eventId,
          token: token.token,
          tokenType: token.tokenType,
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
