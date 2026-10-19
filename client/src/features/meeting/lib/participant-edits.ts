import type { UpdateParticipantDTO } from '@/entities';

export function participantEdits({
  name,
  address,
}: {
  name: string;
  address: string;
}): UpdateParticipantDTO {
  return address ? { name, address } : { name };
}
