import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AddParticipant } from '../add-participant';

function visible(html: string) {
  return {
    inputs: [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map(([, id]) => id),
    text: html
      .split(/<[^>]+>/)
      .map((text) => text.trim())
      .filter(Boolean),
  };
}

describe('AddParticipant in add mode', () => {
  it('asks for a name and a starting location, with no option to hide the address', () => {
    expect(visible(renderToStaticMarkup(<AddParticipant onSubmit={() => {}} />))).toEqual({
      inputs: ['participant-name', 'participant-address'],
      text: [
        'Add Participant',
        'Name',
        'Starting location',
        'Pick a suggestion, or tap the target icon to use where you are now.',
        'Add Participant',
      ],
    });
  });
});

describe('AddParticipant in edit mode', () => {
  it('fills in the saved address', () => {
    const html = renderToStaticMarkup(
      <AddParticipant
        mode="edit"
        initialData={{ name: 'Bob Lee', address: '456 Oak Ave', placeId: '' }}
        onSubmit={() => {}}
      />
    );
    expect(html.match(/<input[^>]*id="participant-address"[^>]*value="([^"]*)"/)?.[1]).toBe(
      '456 Oak Ave'
    );
  });
});
