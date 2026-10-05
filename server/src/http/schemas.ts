import { z } from "zod";
import type { PlaceSearch } from "../modules/places/index.js";

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
const searchLocation = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const category = z.enum([
  "cafe",
  "restaurant",
  "bar",
  "park",
  "library",
  "gym",
  "museum",
  "shopping",
  "things_to_do",
]);
export const venueParams = z.object({ id: z.string().min(1) });
export const directionsParams = eventParams.extend({ venueId: z.string().min(1) });
export const directionsQuery = z.object({
  travelMode: z.enum(["driving", "walking", "transit", "bicycling"]).default("driving"),
  participantId: z.uuid().optional(),
});
export const searchBody = z
  .object({
    center: searchLocation,
    searchRadius: z.number().min(100).max(50000).transform(Math.round),
    query: z.string().min(1).max(100).optional(),
    categories: z.tuple([category]).rest(category).optional(),
  })
  .transform((body, context): PlaceSearch => {
    const base = { center: body.center, radiusMeters: body.searchRadius };
    if (body.query !== undefined)
      return {
        ...base,
        terms: body.categories
          ? { kind: "both", query: body.query, categories: body.categories }
          : { kind: "query", query: body.query },
      };
    if (body.categories)
      return { ...base, terms: { kind: "categories", categories: body.categories } };
    context.addIssue({ code: "custom", message: "Query or categories are required" });
    return z.NEVER;
  });
export const venueResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    location,
    types: z.array(z.string()),
    rating: z.number().nullable(),
    userRatingsTotal: z.number().int().nonnegative().nullable(),
    priceLevel: z.number().int().min(0).max(4).nullable(),
    openNow: z.boolean().nullable(),
    photoUrl: z.string().nullable(),
  })
  .strict();
export const detailsResponse = venueResponse.extend({
  formattedPhoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  openingHours: z.array(z.string()).nullable(),
});
export const searchResponse = z
  .object({
    venues: z.array(venueResponse),
    totalResults: z.number().int().nonnegative(),
    searchCenter: location,
  })
  .strict();
const routeMetric = z.object({ value: z.number().nonnegative(), text: z.string() }).strict();
export const directionsResponse = z
  .object({
    venueId: z.string(),
    travelMode: directionsQuery.shape.travelMode,
    routes: z.array(
      z.union([
        z
          .object({
            participantId: z.uuid(),
            distance: routeMetric,
            duration: routeMetric,
            polyline: z.string(),
          })
          .strict(),
        z
          .object({
            participantId: z.uuid(),
            distance: z.null(),
            duration: z.null(),
            polyline: z.null(),
          })
          .strict(),
      ])
    ),
    outcomes: z.array(
      z
        .object({
          participantId: z.uuid(),
          status: z.enum(["found", "no-location", "no-route", "unavailable"]),
        })
        .strict()
    ),
  })
  .strict();
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

export const registerBody = z.object({
  email: z
    .email()
    .max(255)
    .transform((email) => email.toLowerCase().trim()),
  password: z.string().min(8),
  name: z.string().max(255).optional(),
});
export const loginBody = z.object({
  email: z.email().transform((email) => email.toLowerCase().trim()),
  password: z.string().min(1),
});
export const profileBody = z
  .object({
    name: z.string().max(255).nullable().optional(),
    avatarUrl: z.url().max(512).nullable().optional(),
    defaultAddress: z.string().nullable().optional(),
    defaultPlaceId: z.string().max(255).nullable().optional(),
    defaultFuzzyLocation: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.avatarUrl !== undefined ||
      value.defaultAddress !== undefined ||
      value.defaultPlaceId !== undefined ||
      value.defaultFuzzyLocation !== undefined,
    "At least one field must be provided"
  );
export const claimBody = z.object({
  eventId: eventParams.shape.id,
  participantToken: z.string().regex(/^pt_[0-9a-f]{64}$/),
});
const accountClaim = z
  .object({
    id: z.string(),
    role: z.enum(["organizer", "participant"]),
    participantId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const claimResponse = z
  .object({
    success: z.literal(true),
    userEvent: accountClaim.extend({ eventId: z.string() }),
  })
  .strict();
export const accountEventsResponse = z
  .object({
    events: z.array(
      accountClaim.extend({
        event: z
          .object({
            id: z.string(),
            title: z.string(),
            meetingTime: z.iso.datetime().nullable(),
            publishedAt: z.iso.datetime().nullable(),
            createdAt: z.iso.datetime(),
            participantCount: z.number().int().nonnegative(),
            participants: z.array(
              participantResponse.pick({ id: true, name: true, color: true, isOrganizer: true })
            ),
          })
          .strict(),
      })
    ),
  })
  .strict();

export function response<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Response contract violation");
  return result.data;
}
