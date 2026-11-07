import { useEffect, type RefObject } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import {
  CLASSIC_SEARCH_CIRCLE_STYLE,
  clampSearchRadius,
  fitPadding,
  isInUncoveredMap,
} from './map-common';
import {
  SEARCH_AREA_RED,
  SEARCH_MOVE_HANDLE,
  SEARCH_SIZE_HANDLE,
  searchHandleBearings,
} from './map-pins';
import { pinMarkerOptions } from './use-map-pins';

const messages = defineMessages({
  en: { move: 'Move search area', resize: 'Resize search area' },
  zh: { move: '移动搜索范围', resize: '调整搜索范围' },
});

const OUTLINE_POINTS = 120;
const OUTLINE_OPACITY = 0.75;
const HANDLE_Z_INDEX = 200;

type Handle = 'move' | 'size';

function outlinePath(center: google.maps.LatLng, radius: number): google.maps.LatLng[] {
  const { computeOffset } = google.maps.geometry.spherical;
  const path = Array.from({ length: OUTLINE_POINTS }, (_, index) =>
    computeOffset(center, radius, (index * 360) / OUTLINE_POINTS)
  );
  return [...path, path[0]];
}

/**
 * The redesign's look for the search area: a dashed outline and two handles. The Google circle stays
 * the one source of truth: handles write to it, its listeners write to the store as before, and
 * whatever moves it, the group's center included, redraws this.
 */
export function useSearchArea(
  map: google.maps.Map | null,
  circleRef: RefObject<google.maps.Circle | null>,
  mecCircleRef: RefObject<google.maps.Circle | null>,
  enabled: boolean
) {
  const t = useMessages(messages);
  const { move: moveTitle, resize: resizeTitle } = t;

  useEffect(() => {
    const circle = circleRef.current;
    if (!map || !circle || !enabled) return;
    const { computeOffset, computeDistanceBetween } = google.maps.geometry.spherical;

    circle.setOptions({
      fillColor: SEARCH_AREA_RED,
      fillOpacity: 0.06,
      strokeOpacity: 0,
      editable: false,
      draggable: false,
      clickable: false,
      zIndex: 2,
    });
    mecCircleRef.current?.setVisible(false);

    const dashes: google.maps.IconSequence[] = [
      {
        icon: {
          path: 'M 0,0 0,7',
          scale: 1,
          strokeColor: SEARCH_AREA_RED,
          strokeOpacity: OUTLINE_OPACITY,
          strokeWeight: 2,
        },
        offset: '0',
        repeat: '13px',
      },
    ];
    const outline = new google.maps.Polyline({
      map,
      clickable: false,
      strokeColor: SEARCH_AREA_RED,
      strokeOpacity: 0,
      strokeWeight: 2,
      icons: dashes,
      zIndex: 3,
    });

    const handleMarker = (image: typeof SEARCH_MOVE_HANDLE, title: string) =>
      new google.maps.Marker({
        ...pinMarkerOptions(image),
        map,
        title,
        draggable: true,
        crossOnDrag: false,
        cursor: 'grab',
        zIndex: HANDLE_Z_INDEX,
        visible: false,
      });
    const handles: Record<Handle, google.maps.Marker> = {
      move: handleMarker(SEARCH_MOVE_HANDLE, moveTitle),
      size: handleMarker(SEARCH_SIZE_HANDLE, resizeTitle),
    };
    let bearings: Record<Handle, number | null> = { move: null, size: null };
    let dragging: Handle | null = null;

    const placeHandle = (handle: Handle) => {
      const center = circle.getCenter();
      const bearing = bearings[handle];
      handles[handle].setVisible(bearing !== null);
      if (!center || bearing === null || dragging === handle) return;
      handles[handle].setPosition(computeOffset(center, circle.getRadius(), bearing));
    };

    const redraw = () => {
      const center = circle.getCenter();
      if (!center) return;
      const radius = circle.getRadius();
      outline.setPath(outlinePath(center, radius));
      if (!dragging) {
        const padding = fitPadding(useUIStore.getState().isVenueInfoOpen);
        bearings = searchHandleBearings((bearing) =>
          isInUncoveredMap(
            computeOffset(center, radius, bearing).toJSON(),
            map.getBounds(),
            map.getDiv(),
            padding
          )
        );
      }
      placeHandle('move');
      placeHandle('size');
    };

    const startDrag = (handle: Handle) => {
      dragging = handle;
      outline.setOptions({ icons: [], strokeOpacity: OUTLINE_OPACITY });
    };
    const endDrag = () => {
      dragging = null;
      outline.setOptions({ icons: dashes, strokeOpacity: 0 });
      redraw();
    };
    const dragTo = (handle: Handle, position: google.maps.LatLng) => {
      const center = circle.getCenter();
      const bearing = bearings[handle];
      if (!center || bearing === null) return;
      if (handle === 'move') {
        circle.setCenter(computeOffset(position, circle.getRadius(), bearing + 180));
      } else {
        circle.setRadius(clampSearchRadius(computeDistanceBetween(center, position)));
      }
    };

    const { addListener } = google.maps.event;
    const listeners = [
      addListener(circle, 'center_changed', redraw),
      addListener(circle, 'radius_changed', redraw),
      addListener(map, 'idle', redraw),
    ];
    (['move', 'size'] as const).forEach((handle) => {
      const marker = handles[handle];
      listeners.push(
        marker.addListener('dragstart', () => startDrag(handle)),
        marker.addListener('drag', ({ latLng }: google.maps.MapMouseEvent) => {
          if (latLng) dragTo(handle, latLng);
        }),
        marker.addListener('dragend', endDrag)
      );
    });
    redraw();

    return () => {
      listeners.forEach((listener) => listener.remove());
      outline.setMap(null);
      handles.move.setMap(null);
      handles.size.setMap(null);
      mecCircleRef.current?.setVisible(true);
      const participants = useMeetingStore.getState().currentEvent?.participants ?? [];
      circle.setOptions({
        ...CLASSIC_SEARCH_CIRCLE_STYLE,
        clickable: true,
        draggable: !participants.some(hasStartingPoint),
      });
    };
  }, [map, circleRef, mecCircleRef, enabled, moveTitle, resizeTitle]);
}
