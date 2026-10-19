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

function editForm({ address, hasHiddenAddress }: { address: string; hasHiddenAddress: boolean }) {
  const html = renderToStaticMarkup(
    <AddParticipant
      mode="edit"
      initialData={{ name: 'Bob Lee', address, placeId: '' }}
      hasHiddenAddress={hasHiddenAddress}
      onSubmit={() => {}}
    />
  );
  return {
    addressValue: html.match(/<input[^>]*id="participant-address"[^>]*value="([^"]*)"/)?.[1],
    help: html.match(/<p id="participant-address-help"[^>]*>([^<]*)<\/p>/)?.[1],
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
  it('leaves the address empty and explains that a new address is visible to the group', () => {
    expect(editForm({ address: '', hasHiddenAddress: true })).toEqual({
      addressValue: '',
      help: 'The exact address stays private. Pick a new address to change the starting point. The group will see the new one.',
    });
  });

  it('shows a saved address the server returned', () => {
    expect(editForm({ address: '456 Oak Ave', hasHiddenAddress: false })).toEqual({
      addressValue: '456 Oak Ave',
      help: 'Pick a suggestion, or tap the target icon to use where you are now.',
    });
  });
});
