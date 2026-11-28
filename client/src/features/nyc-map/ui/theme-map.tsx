'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { List } from 'lucide-react';
import { loadGoogleMaps } from '@/shared/lib/google-maps/loader';
import { mapStyle } from '../lib/map-style';
import { createPinLayer, type PinLayer } from '../lib/pin-layer';
import { fetchLocations } from '../lib/place-locations';
import { NYC_PATH, themePath, type LiveTheme, type ThemePlace } from '../model/themes';
import { ICON_VIEWBOX, ThemeIcon } from './icons';
import { ListSheet, PlaceSheet } from './place-sheet';
import { gridBackground, themeStyle } from './theme-style';

const NYC_CENTER = { lat: 40.73, lng: -73.95 };
const PIN_HEIGHT = 44;
const DESKTOP = '(min-width: 768px)';

type Locations = ReadonlyMap<string, google.maps.LatLngLiteral>;
type MapState =
  | { status: 'loading' }
  | { status: 'ready'; maps: typeof google.maps; map: google.maps.Map; layer: PinLayer }
  | { status: 'failed' };

/** A full-screen NYC map in the theme's style, with its pins, card and list. */
export function ThemeMap({
  theme,
  themes,
}: {
  theme: LiveTheme;
  themes: readonly { slug: string; name: string }[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<MapState>({ status: 'loading' });
  const [locations, setLocations] = useState<Locations | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const selected = theme.places.find((place) => place.placeId === selectedId) ?? null;

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    let active = true;
    let cleanup = () => {};
    loadGoogleMaps()
      .then((maps) => {
        if (!active) return;
        const map = new maps.Map(element, {
          center: NYC_CENTER,
          zoom: 11,
          minZoom: 9,
          styles: mapStyle(theme.palette),
          backgroundColor: theme.palette.land,
          disableDefaultUI: true,
          zoomControl: window.matchMedia(DESKTOP).matches,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        const layer = createPinLayer(maps, map);
        const listener = map.addListener('click', () => setSelectedId(null));
        cleanup = () => {
          listener.remove();
          layer.remove();
        };
        setState({ status: 'ready', maps, map, layer });
        return fetchLocations(
          maps,
          theme.places.map((place) => place.placeId)
        ).then((found) => {
          if (!active) return;
          setLocations(found);
          fitPlaces(maps, map, found, headerRef.current?.offsetHeight ?? 0);
        });
      })
      .catch((error) => {
        console.error('[nyc-map] Google Maps failed:', error);
        if (active) setState({ status: 'failed' });
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [theme]);

  // React added or removed pins, so place them on the map again.
  useLayoutEffect(() => {
    if (state.status === 'ready') state.layer.redraw();
  }, [state, locations]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelectedId(null);
      setListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = useCallback(
    (place: ThemePlace) => {
      setSelectedId(place.placeId);
      setListOpen(false);
      const location = locations?.get(place.placeId);
      if (state.status !== 'ready' || !location) return;
      state.map.panTo(location);
      // On a phone the card covers the lower half, so the pin moves up into the free part.
      if (!window.matchMedia(DESKTOP).matches) state.map.panBy(0, window.innerHeight * 0.22);
    },
    [locations, state]
  );

  const shown = locations ? theme.places.filter((place) => locations.has(place.placeId)) : [];

  return (
    <div
      className="fixed inset-0 overflow-hidden text-[var(--ink)]"
      style={{ ...themeStyle(theme), backgroundColor: theme.palette.land }}
    >
      <div
        ref={mapRef}
        className="absolute inset-0"
        aria-label={`Map of ${theme.title}`}
        role="region"
      />
      {theme.pattern === 'grid' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply"
          style={gridBackground(theme.palette.road, 22)}
        />
      )}

      {state.status === 'ready' &&
        locations &&
        createPortal(
          shown.map((place, index) => {
            const location = locations.get(place.placeId)!;
            return (
              <Pin
                key={place.placeId}
                theme={theme}
                place={place}
                location={location}
                index={index}
                selected={place.placeId === selectedId}
                onSelect={select}
              />
            );
          }),
          state.layer.container
        )}

      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 grid gap-2 p-3 md:p-4"
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-3 justify-self-start rounded-[22px] bg-white py-2.5 pl-2.5 pr-4 shadow-[0_4px_16px_rgba(20,30,40,0.14)] md:max-w-[34rem]">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-[var(--soft)]">
            <ThemeIcon
              name={theme.art}
              fill={theme.palette.pin}
              detail={
                theme.palette.pinDetail === '#ffffff' ? theme.palette.ink : theme.palette.pinDetail
              }
              className="h-11 w-11"
            />
          </span>
          <div className="min-w-0">
            <h1
              className="font-bold leading-[1.05] tracking-[-0.2px] text-balance"
              style={{
                fontFamily: 'var(--display)',
                fontSize: 'calc(clamp(19px, 4.6vw, 24px) * var(--display-scale))',
              }}
            >
              {theme.title}
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--muted)]">{theme.line}</p>
          </div>
        </div>
        <nav
          aria-label="Themes"
          className="pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1.5 pt-0.5 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          <Link href={NYC_PATH} className={`${chip} bg-white text-[var(--muted)]`}>
            All themes
          </Link>
          {themes.map(({ slug, name }) => {
            const current = slug === theme.slug;
            return (
              <Link
                key={slug}
                href={themePath({ slug })}
                aria-current={current ? 'page' : undefined}
                className={`${chip} ${current ? 'bg-[var(--ink)] text-white' : 'bg-white text-[var(--ink)]'}`}
              >
                {name}
              </Link>
            );
          })}
        </nav>
      </header>

      {state.status === 'failed' && (
        <p
          role="status"
          className="absolute left-1/2 top-1/2 z-10 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 text-center text-sm shadow-[0_4px_16px_rgba(20,30,40,0.14)]"
        >
          The map didn&apos;t load. The list still has every place.
        </p>
      )}

      {!selected && !listOpen && (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-20 inline-flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(20,30,40,0.3)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <List size={17} aria-hidden="true" />
          List · {theme.places.length} places
        </button>
      )}

      <ListSheet
        theme={theme}
        open={listOpen}
        onClose={() => setListOpen(false)}
        onSelect={select}
      />
      {selected && (
        <PlaceSheet theme={theme} place={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

const chip =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold shadow-[0_2px_8px_rgba(20,30,40,0.12)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

function Pin({
  theme,
  place,
  location,
  index,
  selected,
  onSelect,
}: {
  theme: LiveTheme;
  place: ThemePlace;
  location: google.maps.LatLngLiteral;
  index: number;
  selected: boolean;
  onSelect: (place: ThemePlace) => void;
}) {
  const { width, height } = ICON_VIEWBOX[theme.marker];
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      data-lat={location.lat}
      data-lng={location.lng}
      className="absolute left-0 top-0"
      style={{ zIndex: selected ? 2 : 1 }}
    >
      <button
        type="button"
        aria-label={place.label}
        aria-pressed={selected}
        onClick={() => onSelect(place)}
        className="absolute bottom-0 block -translate-x-1/2 cursor-pointer origin-bottom border-0 bg-transparent p-0 transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(.23,1,.32,1)] hover:scale-110 focus:outline-none focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] aria-pressed:scale-[1.3] motion-reduce:transition-none"
        style={{
          width: (PIN_HEIGHT * width) / height,
          height: PIN_HEIGHT,
          opacity: shown ? 1 : 0,
          transitionDelay: shown ? `${Math.min(index * 35, 400)}ms` : undefined,
        }}
      >
        <ThemeIcon
          name={theme.marker}
          fill={theme.palette.pin}
          detail={theme.palette.pinDetail}
          className="h-full w-full drop-shadow-[0_3px_4px_rgba(20,30,40,0.3)]"
        />
      </button>
    </div>
  );
}

/** Zooms to show every pin below the header. */
function fitPlaces(
  maps: typeof google.maps,
  map: google.maps.Map,
  locations: Locations,
  headerHeight: number
) {
  if (locations.size === 0) return;
  const bounds = new maps.LatLngBounds();
  for (const location of locations.values()) bounds.extend(location);
  map.fitBounds(bounds, { top: headerHeight + PIN_HEIGHT + 8, bottom: 88, left: 32, right: 32 });
}
