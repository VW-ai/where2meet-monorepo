import type { Palette } from '../model/themes';

/**
 * A Google Maps `styles` array in the theme's colors. Business and transit icons are
 * hidden so the theme's own pins are the only markers. Styles need a map with no Map ID.
 */
export function mapStyle(palette: Palette): google.maps.MapTypeStyle[] {
  return [
    { elementType: 'geometry', stylers: [{ color: palette.land }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: palette.label }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: palette.land }, { weight: 3 }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    // Town names outside the city crowd a map zoomed out to five boroughs; neighborhoods stay.
    {
      featureType: 'administrative.locality',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'administrative.province',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'landscape.man_made',
      elementType: 'geometry',
      stylers: [{ color: palette.built }],
    },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: palette.park }] },
    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: palette.road }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    {
      featureType: 'road.arterial',
      elementType: 'labels.text',
      stylers: [{ visibility: 'simplified' }],
    },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: palette.water }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },
  ];
}
