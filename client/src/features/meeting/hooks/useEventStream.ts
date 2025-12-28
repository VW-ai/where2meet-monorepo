'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SSEEventData, SSEConnectionState } from '@/shared/types/sse';
import { handleSSEEvent } from '@/features/meeting/lib/sse-handlers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_DELAY = 30000; // 30 seconds

interface UseEventStreamOptions {
  enabled?: boolean;
  onConnectionStateChange?: (state: SSEConnectionState) => void;
  onConnect?: () => void; // Called when SSE connection is established (for snapshot reconciliation)
}

/**
 * Hook to manage Server-Sent Events (SSE) connection for real-time updates
 *
 * @param eventId - The event ID to subscribe to
 * @param token - Authentication token (organizerToken or participantToken)
 * @param options - Additional configuration options
 * @returns Connection state and control functions
 */
export function useEventStream(
  eventId: string | null,
  token: string | null,
  options: UseEventStreamOptions = {}
) {
  const { enabled = true, onConnectionStateChange, onConnect } = options;

  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isManualDisconnect = useRef(false);

  // Update connection state and notify callback
  const updateConnectionState = useCallback(
    (state: SSEConnectionState) => {
      setConnectionState(state);
      onConnectionStateChange?.(state);
    },
    [onConnectionStateChange]
  );

  // Parse and handle SSE events
  const handleMessage = useCallback(
    (event: MessageEvent, eventType?: string, contextEventId?: string) => {
      try {
        const parsedData = JSON.parse(event.data);

        // Store last event ID for reconnection
        if (event.lastEventId) {
          setLastEventId(event.lastEventId);
        }

        // Handle system events (connected, heartbeat)
        if (eventType === 'connected') {
          console.log(`[SSE] System event (connected):`, parsedData);
          // Trigger snapshot reconciliation on connect
          onConnect?.();
          return;
        }
        if (eventType === 'heartbeat') {
          console.log(`[SSE] System event (heartbeat):`, parsedData);
          return;
        }

        // For application events, use the SSE event type (from event: line)
        // instead of requiring it in the JSON payload
        if (eventType) {
          // Add eventId to payload if missing (handlers expect it)
          const dataWithEventId = {
            ...parsedData,
            eventId: parsedData.eventId || contextEventId,
          };

          // Construct the expected SSEEventData format
          const sseEvent = {
            type: eventType,
            data: dataWithEventId,
          } as SSEEventData;

          console.log(
            '[SSE] Handling application event:',
            eventType,
            'with eventId:',
            dataWithEventId.eventId
          );
          handleSSEEvent(sseEvent);
        } else {
          // Fallback: check if data has type field (old format)
          if (parsedData && typeof parsedData === 'object' && 'type' in parsedData) {
            handleSSEEvent(parsedData as SSEEventData);
          } else {
            console.warn('[SSE] Event has no type (neither SSE event: nor data.type):', parsedData);
          }
        }
      } catch (error) {
        console.error('[SSE] Failed to parse event:', error);
      }
    },
    [onConnect]
  );

  // Connect to SSE stream using fetch (EventSource doesn't support headers)
  const connect = useCallback(() => {
    if (!eventId || !token || !enabled) {
      console.log('[SSE] Skipping connect:', { eventId: !!eventId, token: !!token, enabled });
      return;
    }

    // Don't reconnect if already connected or connecting
    if (
      connectionState === 'connected' ||
      connectionState === 'connecting' ||
      eventSourceRef.current
    ) {
      console.log('[SSE] Already connected or connecting, state:', connectionState);
      return;
    }

    console.log('[SSE] Starting connection to event:', eventId);
    updateConnectionState('connecting');

    const url = `${BACKEND_URL}/api/events/${eventId}/stream`;
    const controller = new AbortController();
    const connectTime = Date.now();

    console.log('[SSE] Fetching:', url);

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        console.log('[SSE] Response received:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });

        if (!response.ok) {
          console.error(`[SSE] Connection failed: ${response.status} ${response.statusText}`);
          throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const openTime = Date.now();
        console.log(`[SSE] Connection established (took ${openTime - connectTime}ms)`);
        updateConnectionState('connected');
        reconnectAttempts.current = 0;

        // Trigger snapshot reconciliation on connection
        onConnect?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let messageCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              const closeTime = Date.now();
              const duration = closeTime - openTime;
              console.log(
                `[SSE] Stream ended after ${duration}ms, received ${messageCount} messages`
              );
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEventType: string | undefined;
            let currentData: string | undefined;

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEventType = line.slice(7);
                console.log('[SSE] Event type:', currentEventType);
              } else if (line.startsWith('data: ')) {
                currentData = line.slice(6);
                messageCount++;
                console.log(`[SSE] Message #${messageCount}:`, currentData.substring(0, 100));
              } else if (line.startsWith('id: ')) {
                const sseEventId = line.slice(4);
                console.log('[SSE] Event ID:', sseEventId);
                setLastEventId(sseEventId);
              } else if (line.startsWith(':')) {
                // Comment/heartbeat
                console.log('[SSE] Heartbeat comment');
              } else if (line === '') {
                // Empty line separates messages - process the event
                if (currentData) {
                  try {
                    const event = { data: currentData } as MessageEvent;
                    // Pass the connection's eventId (not SSE event ID)
                    handleMessage(event, currentEventType, eventId);
                  } catch (error) {
                    console.error('[SSE] Failed to handle message:', error);
                  }
                  currentData = undefined;
                  currentEventType = undefined;
                }
              } else if (line.trim()) {
                console.log('[SSE] Unknown line:', line);
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('[SSE] Read error:', error);
          } else {
            console.log('[SSE] Connection aborted by client');
          }
        }

        // Connection closed
        console.log('[SSE] Cleaning up connection');
        eventSourceRef.current = null;

        if (!isManualDisconnect.current) {
          console.log('[SSE] Connection lost, will reconnect');
          updateConnectionState('error');
          reconnect();
        } else {
          console.log('[SSE] Manual disconnect, not reconnecting');
          updateConnectionState('disconnected');
        }
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          console.error('[SSE] Connection error:', error.message);
          eventSourceRef.current = null;

          if (!isManualDisconnect.current) {
            console.log('[SSE] Will attempt reconnect after error');
            updateConnectionState('error');
            reconnect();
          } else {
            updateConnectionState('disconnected');
          }
        }
      });

    // Store abort controller as eventSource for cleanup
    eventSourceRef.current = { close: () => controller.abort() } as EventSource;
  }, [eventId, token, enabled, connectionState, lastEventId, handleMessage, updateConnectionState]);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateConnectionState('disconnected');
    reconnectAttempts.current = 0;
  }, [updateConnectionState]);

  // Reconnect with exponential backoff
  const reconnect = useCallback(() => {
    // Check if we've exceeded max reconnection attempts
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      updateConnectionState('error');
      return;
    }

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), MAX_BACKOFF_DELAY);
    reconnectAttempts.current += 1;

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      isManualDisconnect.current = false;
      connect();
    }, delay);
  }, [connect, updateConnectionState]);

  // Monitor network status and reconnect when online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online - reconnecting SSE');
      reconnectAttempts.current = 0; // Reset reconnection attempts
      isManualDisconnect.current = false;
      connect();
    };

    const handleOffline = () => {
      console.log('Network offline - disconnecting SSE');
      disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, disconnect]);

  // Automatically connect when eventId and token are available
  useEffect(() => {
    if (eventId && token && enabled && connectionState === 'disconnected') {
      isManualDisconnect.current = false;
      connect();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      disconnect();
    };
  }, [eventId, token, enabled]); // Don't include connect/disconnect to avoid reconnection loops

  return {
    connectionState,
    connect,
    disconnect,
    reconnect,
    lastEventId,
  };
}
