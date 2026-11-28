export interface PinLayer {
  /** The element pins render into. Each pin carries `data-lat` and `data-lng`. */
  container: HTMLDivElement;
  /** Moves every pin to its place, after pins are added or removed. */
  redraw: () => void;
  remove: () => void;
}

/**
 * HTML pins over a styled Google Map. An overlay view keeps them in the map's own
 * pane, so they pan with the map, and works without a Map ID, which Advanced
 * Markers need and which would turn the theme's `styles` off.
 */
export function createPinLayer(maps: typeof google.maps, map: google.maps.Map): PinLayer {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';

  class Layer extends maps.OverlayView {
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(container);
      // A tap on a pin opens its card and does not reach the map's click handler.
      maps.OverlayView.preventMapHitsFrom(container);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      for (const pin of container.querySelectorAll<HTMLElement>('[data-lat][data-lng]')) {
        const point = projection.fromLatLngToDivPixel(
          new maps.LatLng(Number(pin.dataset.lat), Number(pin.dataset.lng))
        );
        if (point) pin.style.transform = `translate(${point.x}px, ${point.y}px)`;
      }
    }

    onRemove() {
      container.remove();
    }
  }

  const layer = new Layer();
  layer.setMap(map);
  return { container, redraw: () => layer.draw(), remove: () => layer.setMap(null) };
}
