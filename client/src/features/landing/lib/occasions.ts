import { Briefcase, Coffee, Heart, Sun, Users, Utensils, type LucideIcon } from 'lucide-react';

export interface HomeOccasion {
  /** The occasion's key in `src/content/taxonomy.yaml`, which the guides under the form match posts by. */
  key: string;
  label: string;
  icon: LucideIcon;
}

export const HOME_OCCASIONS: readonly HomeOccasion[] = [
  { key: 'date-night', label: 'Date night', icon: Heart },
  { key: 'team-meeting', label: 'Team meeting', icon: Briefcase },
  { key: 'group-dinner', label: 'Group dinner', icon: Utensils },
  { key: 'coffee-catch-up', label: 'Coffee catch-up', icon: Coffee },
  { key: 'weekend-hangout', label: 'Weekend hangout', icon: Sun },
  { key: 'family-outing', label: 'Family outing', icon: Users },
];
