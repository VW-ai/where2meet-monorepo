import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Participant } from '@/entities';
import { ParticipantPill } from '../participant-pill';

const BOB: Participant = {
  id: 'p1',
  name: 'Bob Lee',
  address: null,
  location: null,
  color: 'teal',
  fuzzyLocation: false,
  isOrganizer: false,
};

function cardText(participant: Participant) {
  const html = renderToStaticMarkup(
    <ParticipantPill participant={participant} onEdit={() => {}} />
  );
  return html
    .split(/<[^>]+>/)
    .map((text) => text.trim())
    .filter(Boolean);
}

describe('ParticipantPill', () => {
  it('says "Approximate location" when the server hides the address', () => {
    expect(
      cardText({
        ...BOB,
        location: { lat: 40.7160306, lng: -74.0056271 },
        fuzzyLocation: true,
      })
    ).toEqual(['Bob Lee', 'Approximate location', 'BL']);
  });

  it('never shows the address of an approximate participant, even when a server still sends it', () => {
    expect(
      cardText({
        ...BOB,
        address: '456 Oak Ave',
        location: { lat: 40.7160306, lng: -74.0056271 },
        fuzzyLocation: true,
      })
    ).toEqual(['Bob Lee', 'Approximate location', 'BL']);
  });

  it('shows the address of an exact participant', () => {
    expect(
      cardText({ ...BOB, address: '456 Oak Ave', location: { lat: 40.7128, lng: -74.006 } })
    ).toEqual(['Bob Lee', '456 Oak Ave', 'BL']);
  });

  it('asks for a starting location when there is none', () => {
    expect(cardText(BOB)).toEqual(['Bob Lee', 'Add starting location', 'BL']);
  });
});
