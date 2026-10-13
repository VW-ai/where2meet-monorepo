import {
  Briefcase,
  Cake,
  Coffee,
  Hand,
  Handshake,
  Heart,
  MapPin,
  Mountain,
  PartyPopper,
  Plane,
  Sun,
  Users,
  Utensils,
  type IconNode,
} from 'lucide';

const ICONS: Readonly<Record<string, IconNode>> = {
  'date-night': Heart,
  'team-meeting': Briefcase,
  'group-dinner': Utensils,
  'coffee-catch-up': Coffee,
  'weekend-hangout': Sun,
  'family-outing': Users,
  'team-offsite': Mountain,
  'long-distance-reunion': Plane,
  'team-welcome': PartyPopper,
  farewell: Hand,
  'client-meeting': Handshake,
  birthday: Cake,
};

export function occasionIcon(key: string): IconNode {
  return Object.hasOwn(ICONS, key) ? ICONS[key] : MapPin;
}
