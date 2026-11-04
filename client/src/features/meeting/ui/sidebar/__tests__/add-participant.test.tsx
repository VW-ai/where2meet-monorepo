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

describe('AddParticipant under v2', () => {
  const textFor = (kind: 'join' | 'add') =>
    visible(
      renderToStaticMarkup(
        <AddParticipant onSubmit={() => {}} transport={{ kind, eventTitle: 'Friday drinks' }} />
      )
    ).text;

  it('asks someone joining about themselves, and tells them the mode stays theirs', () => {
    const text = textFor('join');
    expect(text).toContain('Join Friday drinks');
    expect(text).toContain('How are you getting there?');
    expect(text).toContain('Only you can change this later.');
    expect(text).toContain('Join plan');
  });

  it('asks the organizer about the person they are adding', () => {
    const text = textFor('add');
    expect(text).toContain('Add a person');
    expect(text).toContain('How is this person getting there?');
    expect(text).toContain('You can change this for them any time.');
    expect(text).toContain('Add person');
  });
});
