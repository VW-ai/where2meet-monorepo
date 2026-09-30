'use client';

import { Input } from '@/shared/ui/input';
import { AppointmentPicker } from '@/shared/ui/appointment-picker';

interface HeroInputProps {
  title: string;
  meetingTime: string;
  onTitleChange: (value: string) => void;
  onMeetingTimeChange: (value: string) => void;
}

export function HeroInput({
  title,
  meetingTime,
  onTitleChange,
  onMeetingTimeChange,
}: HeroInputProps) {
  return (
    <div className="space-y-4 text-left">
      <Input
        aria-label="Occasion"
        placeholder="Dinner, date, lunch..."
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        required
        className="text-[15px] font-normal"
      />

      <AppointmentPicker
        date={meetingTime ? new Date(meetingTime) : undefined}
        onDateTimeChange={(date) => onMeetingTimeChange(date ? date.toISOString() : '')}
      />
    </div>
  );
}
