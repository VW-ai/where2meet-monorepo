import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParticipantPill } from '../participant-pill';

describe('ParticipantPill location display', () => {
  it('shows an approximate location when the public address is redacted', () => {
    const markup = renderToStaticMarkup(
      <ParticipantPill
        participant={{
          id: 'guest',
          name: 'Private guest',
          address: null,
          location: { lat: 32.73, lng: -117.15 },
          fuzzyLocation: true,
          isOrganizer: false,
          color: 'bg-coral-500',
        }}
        onAddLocation={() => {}}
      />
    );

    expect(markup).toContain('Approximate location');
    expect(markup).not.toContain('Add starting location');
  });
});
