import type { UpdateEventDTO } from '@/entities';
import { fromLocalFields, type LocalFields } from '@/shared/lib/meeting-times';

export function eventEdits(
  title: string,
  opened: LocalFields,
  edited: LocalFields,
  timeZone: string | undefined
): UpdateEventDTO {
  const rescheduled =
    edited.date !== '' && (edited.date !== opened.date || edited.time !== opened.time);
  return rescheduled
    ? { title, meetingTime: fromLocalFields(edited.date, edited.time), meetingTimeZone: timeZone }
    : { title };
}
