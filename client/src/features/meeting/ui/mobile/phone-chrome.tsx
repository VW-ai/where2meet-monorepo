'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Coffee,
  MapPin,
  Search,
  Share2,
  Users,
  Utensils,
  Wine,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import catLogo from '@/components/cat/image.png';
import { useUIStore } from '../../model/ui-store';
import { useMeetingStore } from '../../model/meeting-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMapStore } from '../../model/map-store';
import { getHexColor, getInitials } from '../../lib/participant-colors';
import { SettingsDropdown } from '../header/settings-dropdown';
import './phone-meeting.css';

const categories = [
  { label: 'All spots', query: 'places to meet', icon: MapPin },
  { label: 'Coffee', query: 'cafe', icon: Coffee },
  { label: 'Restaurants', query: 'restaurant', icon: Utensils },
  { label: 'Bars', query: 'bar', icon: Wine },
];

export function PhoneHeader({ eventId }: { eventId: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const ui = useUIStore();
  const { isOrganizerMode, isParticipantMode } = useAuthStore();
  const hasJoined = isOrganizerMode || isParticipantMode;
  function search(value: string) {
    if (!hasJoined || !value.trim()) return;
    ui.setSearchQuery(value.trim());
    ui.setActiveView('venue');
    ui.showSidebar();
    ui.triggerSearchExecution();
  }
  return (
    <header className="phone-header md:hidden">
      <form
        className="phone-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          search(query);
          (document.activeElement as HTMLElement)?.blur();
        }}
      >
        <Link href="/" aria-label="Where2meet home" className="phone-logo">
          <Image src={catLogo} alt="" width={34} height={34} />
        </Link>
        <input
          aria-label="Find a meeting spot"
          placeholder={hasJoined ? 'Find a meeting spot' : 'Join to find meeting spots'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!hasJoined}
          type="search"
          enterKeyHint="search"
        />
        <button type="submit" aria-label="Search venues" disabled={!hasJoined || !query.trim()}>
          <Search size={21} />
        </button>
        <SettingsDropdown eventId={eventId} />
      </form>
      <nav className="phone-categories" aria-label="Venue categories">
        {categories.map(({ label, query: value, icon: Icon }) => (
          <button
            key={label}
            type="button"
            aria-pressed={category === label}
            disabled={!hasJoined}
            onClick={() => {
              setCategory(label);
              setQuery(value);
              search(value);
            }}
          >
            <Icon size={19} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export function PhoneSheetHeading({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { currentEvent, selectedVenue, searchedVenues } = useMeetingStore();
  const { activeView, setActiveView, showSidebar } = useUIStore();
  const { routes, isCalculatingRoutes } = useMapStore();
  const participants = currentEvent?.participants ?? [];
  return (
    <div className="phone-sheet-heading md:hidden">
      <button
        className="phone-sheet-handle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="meeting-sheet-content"
        aria-label={expanded ? 'Collapse meeting sheet' : 'Expand meeting sheet'}
      >
        <span />
        {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      <div className="phone-meeting-meta">
        <Users size={14} />
        <span>
          {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{currentEvent?.title || 'Your meeting'}</span>
      </div>
      <div className="phone-sheet-title">
        <h2>Meet in the middle</h2>
        <span className="phone-wordmark">
          where<span>2</span>meet
        </span>
      </div>
      <p className="phone-sheet-description">
        {selectedVenue
          ? selectedVenue.name
          : activeView === 'venue'
            ? `${searchedVenues.length} spots to explore together`
            : 'Add your people. Find your place.'}
      </p>
      {selectedVenue && participants.length > 0 && (
        <div className="phone-travel-times" aria-label="Travel times to selected venue">
          {participants.map((person) => (
            <div key={person.id}>
              <span
                className="phone-avatar"
                style={{ backgroundColor: getHexColor(person.color) }}
                title={person.name}
              >
                {getInitials(person.name)}
              </span>
              <span className="sr-only">{person.name}: </span>
              <span>
                {isCalculatingRoutes
                  ? '…'
                  : routes.find((route) => route.participantId === person.id)?.duration ||
                    'No route'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="phone-sheet-tabs" aria-label="Meeting sections">
        <button
          aria-pressed={activeView === 'participant'}
          onClick={() => {
            setActiveView('participant');
            showSidebar();
          }}
        >
          <Users size={16} />
          People
        </button>
        <button
          aria-pressed={activeView === 'venue'}
          onClick={() => {
            setActiveView('venue');
            showSidebar();
          }}
        >
          <MapPin size={16} />
          Places
        </button>
      </div>
    </div>
  );
}

export function PhoneShareButton() {
  const openShareModal = useUIStore((state) => state.openShareModal);
  return (
    <div className="phone-share md:hidden">
      <button data-tutorial="share-button" onClick={openShareModal}>
        <Share2 size={19} />
        Share with group
      </button>
    </div>
  );
}
