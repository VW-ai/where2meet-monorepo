import { Cake, Hand, Handshake, MapPin, PartyPopper, type IconNode } from 'lucide';
import { OCCASIONS } from '@/content/blog/posts';

const ICONS: Readonly<Record<string, IconNode>> = {
  ...Object.fromEntries(Object.entries(OCCASIONS).map(([key, { icon }]) => [key, icon])),
  'team-welcome': PartyPopper,
  farewell: Hand,
  'client-meeting': Handshake,
  birthday: Cake,
};

/** An occasion's icon. `taxonomy.yaml` can add occasions, so an unknown key gets a pin. */
export function occasionIcon(key: string): IconNode {
  return Object.hasOwn(ICONS, key) ? ICONS[key] : MapPin;
}
