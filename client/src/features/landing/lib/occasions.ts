import { Briefcase, Coffee, Heart, Sun, Users, Utensils, type LucideIcon } from 'lucide-react';

export interface HomeOccasion {
  /** The occasion's key in `src/content/taxonomy.yaml`, which the guides under the form match posts by. */
  key: string;
  label: string;
  /** Shown when the form is in Chinese (meetings in mainland China). */
  zh: string;
  icon: LucideIcon;
}

export const HOME_OCCASIONS: readonly HomeOccasion[] = [
  { key: 'date-night', label: 'Date night', zh: '约会', icon: Heart },
  { key: 'team-meeting', label: 'Team meeting', zh: '团队会议', icon: Briefcase },
  { key: 'group-dinner', label: 'Group dinner', zh: '聚餐', icon: Utensils },
  { key: 'coffee-catch-up', label: 'Coffee catch-up', zh: '喝咖啡聊聊', icon: Coffee },
  { key: 'weekend-hangout', label: 'Weekend hangout', zh: '周末出去玩', icon: Sun },
  { key: 'family-outing', label: 'Family outing', zh: '家庭出游', icon: Users },
];
