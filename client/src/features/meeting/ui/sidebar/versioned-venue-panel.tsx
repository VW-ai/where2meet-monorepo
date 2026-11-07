'use client';

import type { ComponentType } from 'react';
import { useUiVersion, type UiVersion } from '@/features/meeting/model/ui-version-store';
import { VenueInfo } from './venue-info';
import { VenuePanel } from './venue-panel';

const VENUE_PANEL: Record<UiVersion, ComponentType> = { classic: VenueInfo, v2: VenuePanel };

export function VersionedVenuePanel() {
  const Panel = VENUE_PANEL[useUiVersion()];
  return <Panel />;
}
