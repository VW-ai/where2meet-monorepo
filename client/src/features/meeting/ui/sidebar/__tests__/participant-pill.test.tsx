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
  it('shows the address of a participant who added one', () => {
    expect(
      cardText({ ...BOB, address: '456 Oak Ave', location: { lat: 40.7128, lng: -74.006 } })
    ).toEqual(['Bob Lee', '456 Oak Ave', 'BL']);
  });

  it('asks for a starting location when there is none', () => {
    expect(cardText(BOB)).toEqual(['Bob Lee', 'Add starting location', 'BL']);
  });
});
