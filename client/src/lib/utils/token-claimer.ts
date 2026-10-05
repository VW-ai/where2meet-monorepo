import { userClient } from '@/features/user/api';
import type { UserEventResponse } from '@/features/auth/types';

export interface UnclaimedToken {
  eventId: string;
  tokenType: 'organizer' | 'participant';
  token: string;
}

export interface ClaimScope {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

export interface ClaimResult {
  success: boolean;
  claimed: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
}

export interface ClaimSnapshot {
  events: UserEventResponse[];
  pending: UnclaimedToken[];
  failures: ClaimResult['errors'];
}

export function scanLocalStorageForTokens(): UnclaimedToken[] {
  if (typeof window === 'undefined') return [];
  const candidates = new Map<string, UnclaimedToken>();
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    const match = key?.match(/^(organizer|participant)_token_(.+)$/);
    if (!key || !match) continue;
    const token = localStorage.getItem(key);
    if (!token || !/^pt_[0-9a-f]{64}$/.test(token)) continue;
    const eventId = match[2];
    const tokenType = match[1] === 'organizer' ? 'organizer' : 'participant';
    if (!candidates.has(eventId) || tokenType === 'organizer') {
      candidates.set(eventId, { eventId, tokenType, token });
    }
  }
  return [...candidates.values()];
}

function requireCurrent(scope: ClaimScope) {
  scope.signal.throwIfAborted();
  if (!scope.isCurrent()) throw new DOMException('Account changed', 'AbortError');
}

export async function claimAllTokens(
  tokens: UnclaimedToken[],
  scope: ClaimScope
): Promise<ClaimResult> {
  const errors: ClaimResult['errors'] = [];
  let claimed = 0;
  for (const token of tokens) {
    requireCurrent(scope);
    try {
      await userClient.claimEvent(
        { eventId: token.eventId, participantToken: token.token },
        scope.signal
      );
      requireCurrent(scope);
      claimed++;
    } catch (error) {
      requireCurrent(scope);
      errors.push({
        eventId: token.eventId,
        error: error instanceof Error ? error.message : 'Claim failed',
      });
    }
  }
  return { success: errors.length === 0, claimed, failed: errors.length, errors };
}

export async function reconcileClaims(
  scope: ClaimScope,
  claimPending = false
): Promise<ClaimSnapshot> {
  requireCurrent(scope);
  let { events } = await userClient.getEvents(scope.signal);
  requireCurrent(scope);
  const discover = () => {
    const linked = new Set(events.map((entry) => entry.event.id));
    return scanLocalStorageForTokens().filter((candidate) => !linked.has(candidate.eventId));
  };
  let failures: ClaimResult['errors'] = [];
  const pending = discover();
  if (claimPending && pending.length > 0) {
    failures = (await claimAllTokens(pending, scope)).errors;
    requireCurrent(scope);
    ({ events } = await userClient.getEvents(scope.signal));
    requireCurrent(scope);
  }
  return { events, pending: discover(), failures };
}

export async function claimAfterAuthentication(scope: ClaimScope): Promise<void> {
  const deadline = new AbortController();
  const signal = AbortSignal.any([scope.signal, deadline.signal]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      reconcileClaims({ ...scope, signal }, true).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          deadline.abort();
          resolve();
        }, 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
