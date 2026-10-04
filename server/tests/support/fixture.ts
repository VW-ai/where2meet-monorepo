import { createHash } from "node:crypto";

export const eventId = "evt_1700000000000_0123456789abcdef";
export const participantId = "11111111-1111-4111-8111-111111111111";
export const guestId = "22222222-2222-4222-8222-222222222222";
export const userId = "usr_0123456789abcdef0123456789abcdef";
export const participantToken = `pt_${"a".repeat(64)}`;
export const guestToken = `pt_${"b".repeat(64)}`;
export const sessionToken = `st_${"c".repeat(64)}`;
export const expiredSessionToken = `st_${"d".repeat(64)}`;
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

export function fixture() {
  const createdAt = "2025-12-29T12:34:56.789Z";
  return {
    version: 1,
    events: [
      {
        id: eventId,
        title: "Imported meeting",
        meetingTime: null,
        publishedVenueId: null,
        publishedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    participants: [
      {
        id: participantId,
        eventId,
        name: "Original organizer",
        address: null,
        formattedAddress: null,
        lat: null,
        lng: null,
        fuzzyLocation: false,
        color: "coral",
        isOrganizer: true,
        tokenHash: hashToken(participantToken),
        createdAt,
      },
      {
        id: guestId,
        eventId,
        name: "Original guest",
        address: "Example address",
        formattedAddress: "Example address",
        lat: "32.1234567",
        lng: "-117.1234567",
        fuzzyLocation: true,
        color: "mint",
        isOrganizer: false,
        tokenHash: hashToken(guestToken),
        createdAt,
      },
    ],
    users: [
      {
        id: userId,
        email: "fixture@example.test",
        name: "Original user",
        avatarUrl: null,
        emailVerified: false,
        defaultAddress: null,
        defaultPlaceId: null,
        defaultFuzzyLocation: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    userSessions: [
      {
        id: "ses_0123456789abcdef0123456789abcdef",
        userId,
        tokenHash: hashToken(sessionToken),
        expiresAt: "2099-01-01T00:00:00.123Z",
        createdAt,
      },
      {
        id: "ses_fedcba9876543210fedcba9876543210",
        userId,
        tokenHash: hashToken(expiredSessionToken),
        expiresAt: "2020-01-01T00:00:00.456Z",
        createdAt,
      },
    ],
    venues: [
      {
        id: "fixture_place",
        name: "Existing cafe",
        address: "Cafe address",
        lat: "32.2345678",
        lng: "-117.2345678",
        category: "cafe",
        rating: "4.5",
        priceLevel: 2,
        photoUrl: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    votes: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        eventId,
        participantId: guestId,
        venueId: "fixture_place",
        createdAt,
      },
    ],
    userIdentities: [
      {
        id: "ident_0123456789abcdef0123456789abcdef",
        userId,
        provider: "email",
        providerId: "fixture@example.test",
        passwordHash: "$2b$12$abcdefghijklmnopqrstuu012345678901234567890123456789012",
        createdAt,
      },
    ],
    userEvents: [
      {
        id: "ue_0123456789abcdef0123456789abcdef",
        userId,
        eventId,
        participantId,
        role: "organizer",
        createdAt,
      },
    ],
  };
}
