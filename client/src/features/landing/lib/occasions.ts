import { Briefcase, Coffee, Heart, Sun, Users, Utensils, type LucideIcon } from 'lucide-react';

export interface HomeOccasion {
  label: string;
  /** Shown when the form is in Chinese (meetings in mainland China). */
  zh: string;
  icon: LucideIcon;
}

export const HOME_OCCASIONS: readonly HomeOccasion[] = [
  { label: 'Date night', zh: '约会', icon: Heart },
  { label: 'Team meeting', zh: '团队会议', icon: Briefcase },
  { label: 'Group dinner', zh: '聚餐', icon: Utensils },
  { label: 'Coffee catch-up', zh: '喝咖啡聊聊', icon: Coffee },
  { label: 'Weekend hangout', zh: '周末出去玩', icon: Sun },
  { label: 'Family outing', zh: '家庭出游', icon: Users },
];
