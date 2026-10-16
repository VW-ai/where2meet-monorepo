import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AddParticipant } from '../add-participant';

function editForm({
  address,
  hasHiddenAddress,
  fuzzyLocation,
}: {
  address: string;
  hasHiddenAddress: boolean;
  fuzzyLocation: boolean;
}) {
  const html = renderToStaticMarkup(
    <AddParticipant
      mode="edit"
      initialData={{ name: 'Bob Lee', address, placeId: '', fuzzyLocation }}
      hasHiddenAddress={hasHiddenAddress}
      onSubmit={() => {}}
    />
  );
  return {
    addressValue: html.match(/<input[^>]*id="participant-address"[^>]*value="([^"]*)"/)?.[1],
    help: html.match(/<p id="participant-address-help"[^>]*>([^<]*)<\/p>/)?.[1],
  };
}

describe('AddParticipant in edit mode', () => {
  it('leaves the address empty and explains why when the server keeps it private', () => {
    expect(editForm({ address: '', hasHiddenAddress: true, fuzzyLocation: true })).toEqual({
      addressValue: '',
      help: 'The exact address stays private. Leave this empty to keep it, or pick a new address.',
    });
  });

  it('warns that an empty field shows the saved address once approximate is off', () => {
    expect(editForm({ address: '', hasHiddenAddress: true, fuzzyLocation: false })).toEqual({
      addressValue: '',
      help: 'Leave this empty to show the saved address to everyone, or pick a new address.',
    });
  });

  it('shows a saved address the server returned', () => {
    expect(
      editForm({ address: '456 Oak Ave', hasHiddenAddress: false, fuzzyLocation: true })
    ).toEqual({
      addressValue: '456 Oak Ave',
      help: 'Pick a suggestion, or tap the target icon to use where you are now.',
    });
  });
});
