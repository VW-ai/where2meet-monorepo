import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event, Participant } from '@/entities';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { AddPersonForm } from '../add-person-form';

vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  const build = (init: Parameters<typeof actual.createStore>[0]) => {
    const api = actual.createStore(init);
    const hook = (selector = (state: unknown) => state) => selector(api.getState());
    return Object.assign(hook, api);
  };
  return {
    ...actual,
    create: (init?: Parameters<typeof actual.createStore>[0]) => (init ? build(init) : build),
  };
});

const MOM: Participant = {
  id: 'mom',
  name: 'Mom',
  address: 'Astoria',
  location: { lat: 40.77, lng: -73.93 },
  color: 'teal',
  isOrganizer: false,
  travelMode: 'driving',
  claimable: true,
};

const text = (kind: 'add' | 'join') =>
  renderToStaticMarkup(
    <AddPersonForm kind={kind} onSubmit={() => {}} onCancel={() => {}} isSubmitting={false} />
  )
    .split(/<[^>]+>/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .replaceAll('&#x27;', "'");

describe('AddPersonForm when it opens', () => {
  beforeEach(() => {
    useMeetingStore.setState({
      currentEvent: { id: 'e', title: 'Friday drinks', participants: [MOM] } as Event,
    });
  });

  it('asks the organizer only for a name, with the link as the other way in', () => {
    const html = renderToStaticMarkup(
      <AddPersonForm kind="add" onSubmit={() => {}} onCancel={() => {}} isSubmitting={false} />
    );
    expect(html).toContain('placeholder="Who&#x27;s coming?"');
    expect(html).not.toContain('type="submit"');
    expect(text('add')).toBe('Or send them the link instead');
  });

  it('offers a visitor the rows already on the list, then joining as someone new', () => {
    expect(text('join')).toBe(
      "Join Friday drinks Already on the list? M Mom From Astoria That's me Or join as someone new"
    );
  });

  it('shows no submit button to a visitor until there is something to submit', () => {
    const html = renderToStaticMarkup(
      <AddPersonForm kind="join" onSubmit={() => {}} onCancel={() => {}} isSubmitting={false} />
    );
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain('disabled');
  });
});
