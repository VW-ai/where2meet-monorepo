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
    <div className="space-y-6">
      {/* Title Input */}
      <div className="transform transition-all hover:scale-[1.01]">
        <Input
          label="What's the occasion?"
          placeholder="Team lunch, Study session, Weekend hangout..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          className="text-base"
        />
      </div>

      {/* Meeting Time Input */}
      <div className="transform transition-all hover:scale-[1.01]">
        <AppointmentPicker
          label="When are you meeting?"
          date={meetingTime ? new Date(meetingTime) : undefined}
          onDateTimeChange={(date) => onMeetingTimeChange(date ? date.toISOString() : '')}
          className="text-base"
        />
      </div>
    </div>
  );
}
