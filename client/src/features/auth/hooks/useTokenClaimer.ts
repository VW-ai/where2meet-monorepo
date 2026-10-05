import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { reconcileClaims, type ClaimSnapshot } from '@/lib/utils/token-claimer';

type View =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; snapshot: ClaimSnapshot; claiming: boolean };

export function useTokenClaimer() {
  const generation = useAuthStore((state) => state.accountGeneration);
  const userId = useAuthStore((state) => state.user?.id);
  const [state, setState] = useState<{ generation: number; view: View }>({
    generation,
    view: { kind: 'loading' },
  });
  const operation = useRef<AbortController | null>(null);
  const refresh = useCallback(
    async (claimPending = false) => {
      const auth = useAuthStore.getState();
      if (auth.accountGeneration !== generation || auth.user?.id !== userId) return;
      operation.current?.abort();
      const controller = new AbortController();
      operation.current = controller;
      const account = useAuthStore.getState().captureAccount();
      if (!account.userId) return;
      const scope = { ...account, signal: AbortSignal.any([account.signal, controller.signal]) };
      if (claimPending)
        setState((previous) =>
          previous.generation === generation && previous.view.kind === 'ready'
            ? { generation, view: { ...previous.view, claiming: true } }
            : previous
        );
      try {
        const snapshot = await reconcileClaims(scope, claimPending);
        if (scope.isCurrent() && !scope.signal.aborted)
          setState({ generation, view: { kind: 'ready', snapshot, claiming: false } });
      } catch (error) {
        if (scope.isCurrent() && !scope.signal.aborted)
          setState({
            generation,
            view: {
              kind: 'failed',
              message: error instanceof Error ? error.message : 'Could not load your events',
            },
          });
      }
    },
    [generation, userId]
  );

  useEffect(() => {
    void refresh();
    return () => operation.current?.abort();
  }, [refresh, userId]);

  const view = state.generation === generation ? state.view : { kind: 'loading' as const };
  const snapshot = view.kind === 'ready' ? view.snapshot : null;
  const userEvents = [...(snapshot?.events ?? [])].sort((left, right) => {
    const a = left.event;
    const b = right.event;
    if (a.publishedAt && b.publishedAt)
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  return {
    userEvents,
    unclaimedEvents: snapshot?.pending ?? [],
    isLoading: view.kind === 'loading',
    isClaiming: view.kind === 'ready' && view.claiming,
    error:
      view.kind === 'failed'
        ? view.message
        : snapshot?.failures.length
          ? 'Some events could not be claimed. You can try again.'
          : null,
    claimAllEvents: () => refresh(true),
  };
}
