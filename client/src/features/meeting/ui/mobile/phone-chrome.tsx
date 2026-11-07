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
import catLogo from '@/components/cat/logo.svg';
import { useUIStore } from '../../model/ui-store';
import { useMeetingStore } from '../../model/meeting-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMapStore } from '../../model/map-store';
import { getHexColor, getInitials } from '../../lib/participant-colors';
import { useUiVersionStore } from '../../model/ui-version-store';
import { ParticipantAvatar } from '../sidebar/venue-v2-parts';
import { SettingsDropdown } from '../header/settings-dropdown';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import './phone-meeting.css';

const categoryIcons = [MapPin, Coffee, Utensils, Wine];

const messages = defineMessages({
  en: {
    categories: [
      { label: 'All spots', query: 'places to meet' },
      { label: 'Coffee', query: 'cafe' },
      { label: 'Restaurants', query: 'restaurant' },
      { label: 'Bars', query: 'bar' },
    ],
    home: 'Where2meet home',
    findSpot: 'Find a meeting spot',
    joinToFind: 'Join to find meeting spots',
    searchVenues: 'Search venues',
    venueCategories: 'Venue categories',
    collapse: 'Collapse meeting sheet',
    expand: 'Expand meeting sheet',
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    yourMeeting: 'Your meeting',
    planTitle: 'Plan where to meet',
    spotsToExplore: (n: number) => `${n} spots to explore together`,
    tagline: 'Add your people. Find your place.',
    travelTimes: 'Travel times to selected venue',
    noRoute: 'No route',
    sections: 'Meeting sections',
    peopleTab: 'People',
    placesTab: 'Places',
    shareWithGroup: 'Share with group',
  },
  zh: {
    categories: [
      { label: '全部', query: '适合见面的地方' },
      { label: '咖啡', query: '咖啡馆' },
      { label: '餐厅', query: '餐厅' },
      { label: '酒吧', query: '酒吧' },
    ],
    home: '返回 Where2Meet 首页',
    findSpot: '找个见面地点',
    joinToFind: '加入后即可查找见面地点',
    searchVenues: '搜索地点',
    venueCategories: '地点类别',
    collapse: '收起见面面板',
    expand: '展开见面面板',
    people: (n: number) => `${n} 位参与者`,
    yourMeeting: '你的见面',
    planTitle: '一起定个见面地点',
    spotsToExplore: (n: number) => `${n} 个地点，一起看看`,
    tagline: '拉上朋友，找到地方。',
    travelTimes: '到所选地点的路程时间',
    noRoute: '无路线',
    sections: '见面板块',
    peopleTab: '参与者',
    placesTab: '地点',
    shareWithGroup: '分享给大家',
  },
});

export function PhoneHeader({ eventId }: { eventId: string }) {
  const t = useMessages(messages);
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
        <Link href="/" aria-label={t.home} className="phone-logo">
          <Image src={catLogo} alt="" width={34} height={34} />
        </Link>
        <input
          aria-label={t.findSpot}
          placeholder={hasJoined ? t.findSpot : t.joinToFind}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!hasJoined}
          type="search"
          enterKeyHint="search"
        />
        <button type="submit" aria-label={t.searchVenues} disabled={!hasJoined || !query.trim()}>
          <Search size={21} />
        </button>
        <SettingsDropdown eventId={eventId} />
      </form>
      <nav className="phone-categories" aria-label={t.venueCategories}>
        {t.categories.map(({ label, query: value }, index) => {
          const Icon = categoryIcons[index];
          return (
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
          );
        })}
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
  const t = useMessages(messages);
  const { currentEvent, selectedVenue, searchedVenues } = useMeetingStore();
  const { activeView, setActiveView, showSidebar } = useUIStore();
  const { routes, isCalculatingRoutes } = useMapStore();
  const version = useUiVersionStore((state) => state.version);
  const participants = currentEvent?.participants ?? [];
  return (
    <div className="phone-sheet-heading md:hidden">
      <button
        className="phone-sheet-handle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="meeting-sheet-content"
        aria-label={expanded ? t.collapse : t.expand}
      >
        <span />
        {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      <div className="phone-meeting-meta">
        <Users size={14} />
        <span>{t.people(participants.length)}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{currentEvent?.title || t.yourMeeting}</span>
      </div>
      <div className="phone-sheet-title">
        <h2>{t.planTitle}</h2>
        <span className="phone-wordmark">
          where<span>2</span>meet
        </span>
      </div>
      <p className="phone-sheet-description">
        {selectedVenue
          ? selectedVenue.name
          : activeView === 'venue'
            ? t.spotsToExplore(searchedVenues.length)
            : t.tagline}
      </p>
      {selectedVenue && participants.length > 0 && (
        <div className="phone-travel-times" aria-label={t.travelTimes}>
          {participants.map((person) => (
            <div key={person.id}>
              {version === 'v2' ? (
                <ParticipantAvatar participant={person} large />
              ) : (
                <span
                  className="phone-avatar"
                  style={{ backgroundColor: getHexColor(person.color) }}
                  title={person.name}
                >
                  {getInitials(person.name)}
                </span>
              )}
              <span className="sr-only">{person.name}: </span>
              <span>
                {isCalculatingRoutes
                  ? '…'
                  : routes.find((route) => route.participantId === person.id)?.duration ||
                    t.noRoute}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="phone-sheet-tabs" aria-label={t.sections}>
        <button
          aria-pressed={activeView === 'participant'}
          onClick={() => {
            setActiveView('participant');
            showSidebar();
          }}
        >
          <Users size={16} />
          {t.peopleTab}
        </button>
        <button
          aria-pressed={activeView === 'venue'}
          onClick={() => {
            setActiveView('venue');
            showSidebar();
          }}
        >
          <MapPin size={16} />
          {t.placesTab}
        </button>
      </div>
    </div>
  );
}

export function PhoneShareButton() {
  const t = useMessages(messages);
  const openShareModal = useUIStore((state) => state.openShareModal);
  return (
    <div className="phone-share md:hidden">
      <button data-tutorial="share-button" onClick={openShareModal}>
        <Share2 size={19} />
        {t.shareWithGroup}
      </button>
    </div>
  );
}
