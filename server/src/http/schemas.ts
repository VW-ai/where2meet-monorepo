import { z } from "zod";

export const eventParams = z.object({ id: z.string().regex(/^evt_\d{13,15}_[a-zA-Z0-9]{16}$/) });
export const participantParams = eventParams.extend({ participantId: z.uuid() });
export const createParticipantBody = z.object({
  name: z.string().min(1).max(50),
  address: z.string().min(1).max(255),
  fuzzyLocation: z.boolean().default(false),
});
export const createEventBody = z.object({
  title: z.string().min(1).max(100),
  meetingTime: z.iso.datetime().optional(),
});
export const updateEventBody = z
  .object({
    title: z.string().min(1).max(100).optional(),
    meetingTime: z.iso.datetime().nullable().optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.meetingTime !== undefined,
    "At least one field must be provided"
  );
export const participantBody = z
  .object({
    name: z.string().min(1).max(50).optional(),
    address: z.string().min(1).max(255).optional(),
    fuzzyLocation: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.address !== undefined || value.fuzzyLocation !== undefined,
    "At least one field must be provided"
  );

const location = z.object({ lat: z.number(), lng: z.number() }).strict();
export const participantResponse = z
  .object({
    id: z.uuid(),
    name: z.string(),
    address: z.string().nullable(),
    location: location.nullable(),
    color: z.string(),
    fuzzyLocation: z.boolean(),
    isOrganizer: z.boolean(),
  })
  .strict();
export const eventResponse = z
  .object({
    id: z.string(),
    title: z.string(),
    meetingTime: z.iso.datetime().nullable(),
    publishedVenueId: z.string().nullable(),
    publishedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    participants: z.array(participantResponse),
    mec: z.null(),
    settings: z.object({ allowParticipantsAfterPublish: z.literal(false) }).strict(),
  })
  .strict();
export const joinedParticipantResponse = participantResponse.extend({
  participantToken: z.string().regex(/^pt_[0-9a-f]{64}$/),
});
export const createResponse = eventResponse.extend({
  participantToken: z.string().regex(/^pt_[0-9a-f]{64}$/),
  organizerParticipantId: z.uuid(),
});
export const meResponse = z
  .object({
    participantId: z.uuid(),
    name: z.string(),
    isOrganizer: z.boolean(),
    color: z.string(),
    address: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .strict();
export const votesResponse = z
  .object({
    venues: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          address: z.string().nullable(),
          location,
          category: z.string().nullable(),
          rating: z.number().nullable(),
          priceLevel: z.number().nullable(),
          photoUrl: z.string().nullable(),
          voteCount: z.number().int().nonnegative(),
          voters: z.array(z.uuid()),
        })
        .strict()
    ),
    totalVotes: z.number().int().nonnegative(),
  })
  .strict();
export const userResponse = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    emailVerified: z.boolean(),
    defaultAddress: z.string().nullable(),
    defaultPlaceId: z.string().nullable(),
    defaultFuzzyLocation: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const sessionResponse = z.object({ user: userResponse }).strict();

export function response<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Response contract violation");
  return result.data;
}
