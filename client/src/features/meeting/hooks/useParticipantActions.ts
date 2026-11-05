'use client';

import { useCallback } from 'react';
import type { Participant, ParticipantResponse } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { eventClient, participantClient } from '@/features/meeting/api';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useParticipantStore } from '@/features/meeting/model/participant-store';
import { useToastStore } from '@/features/meeting/model/toast-store';
import { APIError } from '@/lib/api/client';
import { analyticsEvents } from '@/lib/analytics/events';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import type { TravelMode } from '@/shared/types/map';

const messages = defineMessages({
  en: {
    modeFailed: (name: string) => `Couldn't change how ${name} is getting there. Try again.`,
    myModeFailed: "Couldn't change how you're getting there. Try again.",
    onlyThem: (name: string) => `Only ${name} can change this now.`,
    claimed: (name: string) => `You're in as ${name}. Check how you're getting there.`,
    undo: 'Undo',
    taken: (name: string) => `Someone else just took ${name}. Join as someone new instead.`,
    claimFailed: "That didn't work. Try again.",
    undoFailed: "Couldn't undo that. Try again.",
    removed: (name: string) => `${name} removed.`,
    removeFailed: (name: string) => `Couldn't remove ${name}. Try again.`,
    takenOver: (name: string) => `${name} has taken this over, so they stay.`,
  },
  zh: {
    modeFailed: (name: string) => `没能修改${name}的出行方式，请重试。`,
    myModeFailed: '没能修改你的出行方式，请重试。',
    onlyThem: (name: string) => `现在只有${name}能修改。`,
    claimed: (name: string) => `你已是${name}，看看打算怎么过去。`,
    undo: '撤销',
    taken: (name: string) => `${name}刚刚被别人认领了，你可以以新成员身份加入。`,
    claimFailed: '操作没有成功，请重试。',
    undoFailed: '没能撤销，请重试。',
    removed: (name: string) => `已移除${name}。`,
    removeFailed: (name: string) => `没能移除${name}，请重试。`,
    takenOver: (name: string) => `${name}已经自己接管了，所以会留下。`,
  },
});

function patchParticipant(id: string, fields: Partial<Participant>) {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  useParticipantStore.getState().updateParticipant(id, fields);
  if (!currentEvent) return;
  setCurrentEvent({
    ...currentEvent,
    participants: currentEvent.participants.map((p) => (p.id === id ? { ...p, ...fields } : p)),
  });
}

// The stream may already have brought either change
function putInEvent(person: Participant) {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  if (!currentEvent || currentEvent.participants.some((p) => p.id === person.id)) return;
  useParticipantStore.getState().addParticipant(person);
  setCurrentEvent({ ...currentEvent, participants: [...currentEvent.participants, person] });
}

function takeOutOfEvent(id: string) {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  useParticipantStore.getState().removeParticipant(id);
  if (currentEvent) {
    setCurrentEvent({
      ...currentEvent,
      participants: currentEvent.participants.filter((p) => p.id !== id),
    });
  }
  const { selectedParticipantId, setSelectedParticipantId } = useMapStore.getState();
  if (selectedParticipantId === id) setSelectedParticipantId(null);
}

// A visitor has no stream, so their list is as old as the page
async function refreshEvent(eventId: string) {
  try {
    useMeetingStore.getState().setCurrentEvent(await eventClient.get(eventId));
  } catch (error) {
    console.error('Error refreshing the event:', error);
  }
}

/** What every way of getting a token ends with: the viewer is now this person, with no reload. */
export function signInAsParticipant(
  eventId: string,
  { participantToken, ...participant }: ParticipantResponse
): Participant {
  if (participantToken) {
    useAuthStore.getState().setParticipantInfo(eventId, participant.id, participantToken);
  }
  return participant;
}

// Only the newest change to a person's mode may put the old one back
const latestModeChange = new Map<string, number>();

export function useChangeParticipantMode() {
  const t = useMessages(messages);

  return useCallback(
    async (person: Participant, mode: TravelMode) => {
      const eventId = useMeetingStore.getState().currentEvent?.id;
      const auth = useAuthStore.getState();
      const token = auth.isOrganizerMode ? auth.organizerToken : auth.participantToken;
      if (!eventId || !token || person.travelMode === mode) return;

      const change = (latestModeChange.get(person.id) ?? 0) + 1;
      latestModeChange.set(person.id, change);
      patchParticipant(person.id, { travelMode: mode });

      try {
        const updated = await participantClient.update(
          eventId,
          person.id,
          { travelMode: mode },
          token
        );
        if (latestModeChange.get(person.id) === change) patchParticipant(person.id, updated);
      } catch (error) {
        console.error('Error changing travel mode:', error);
        if (latestModeChange.get(person.id) !== change) return;
        patchParticipant(person.id, { travelMode: person.travelMode });
        const mine = (auth.organizerParticipantId || auth.currentParticipantId) === person.id;
        useToastStore.getState().showToast({
          message:
            error instanceof APIError && error.status === 403
              ? t.onlyThem(person.name)
              : mine
                ? t.myModeFailed
                : t.modeFailed(person.name),
        });
      }
    },
    [t]
  );
}

export function useClaimParticipant() {
  const t = useMessages(messages);

  return useCallback(
    async (person: Participant) => {
      const eventId = useMeetingStore.getState().currentEvent?.id;
      if (!eventId) return;
      const { showToast } = useToastStore.getState();

      const undo = async () => {
        const token = useAuthStore.getState().participantToken;
        if (!token) return;
        try {
          const updated = await participantClient.unclaim(eventId, person.id, token);
          useAuthStore.getState().clearParticipantInfo(eventId);
          patchParticipant(person.id, updated);
          useMapStore.getState().setSelectedParticipantId(null);
          void refreshEvent(eventId);
        } catch (error) {
          console.error('Error undoing a claim:', error);
          showToast({ message: t.undoFailed });
        }
      };

      try {
        const response = await participantClient.claim(eventId, person.id);
        patchParticipant(person.id, signInAsParticipant(eventId, response));
        useMapStore.getState().setSelectedParticipantId(person.id);
        void refreshEvent(eventId);
        analyticsEvents.joinEvent(eventId, person.id);
        showToast({
          message: t.claimed(person.name),
          action: { label: t.undo, run: () => void undo() },
        });
      } catch (error) {
        console.error('Error claiming a participant:', error);
        if (error instanceof APIError && error.code === 'PARTICIPANT_NOT_CLAIMABLE') {
          patchParticipant(person.id, { claimable: false });
          showToast({ message: t.taken(person.name) });
          void refreshEvent(eventId);
        } else {
          showToast({ message: t.claimFailed });
        }
      }
    },
    [t]
  );
}

/** A row nobody has claimed holds no votes or token, so taking it out can be undone in full. */
export function useRemoveAddedPerson() {
  const t = useMessages(messages);

  const undoAdd = useCallback(
    async (person: Participant) => {
      const eventId = useMeetingStore.getState().currentEvent?.id;
      const token = useAuthStore.getState().organizerToken;
      if (!eventId || !token) return;
      const { showToast } = useToastStore.getState();
      const current = useMeetingStore
        .getState()
        .currentEvent?.participants.find((p) => p.id === person.id);
      if (current && !current.claimable) {
        showToast({ message: t.takenOver(person.name) });
        return;
      }
      try {
        await participantClient.remove(eventId, person.id, token);
        takeOutOfEvent(person.id);
      } catch (error) {
        console.error('Error undoing an add:', error);
        showToast({ message: t.undoFailed });
      }
    },
    [t]
  );

  const removeWithUndo = useCallback(
    async (person: Participant) => {
      const eventId = useMeetingStore.getState().currentEvent?.id;
      const token = useAuthStore.getState().organizerToken;
      if (!eventId || !token) return;
      const { showToast } = useToastStore.getState();

      const putBack = async () => {
        if (!person.address) return;
        try {
          putInEvent(
            await participantClient.add(
              eventId,
              { name: person.name, address: person.address, travelMode: person.travelMode },
              token
            )
          );
        } catch (error) {
          console.error('Error undoing a removal:', error);
          showToast({ message: t.undoFailed });
        }
      };

      try {
        await participantClient.remove(eventId, person.id, token);
        takeOutOfEvent(person.id);
        showToast({
          message: t.removed(person.name),
          action: { label: t.undo, run: () => void putBack() },
        });
      } catch (error) {
        console.error('Error removing a participant:', error);
        showToast({ message: t.removeFailed(person.name) });
      }
    },
    [t]
  );

  return { undoAdd, removeWithUndo };
}
