-- Remove organizerTokenHash from Event table
-- Organizer is now identified via Participant.isOrganizer flag
-- Token stored only in Participant.tokenHash

-- Drop the unique constraint first
ALTER TABLE "event" DROP CONSTRAINT IF EXISTS "event_organizer_token_hash_key";

-- Remove the column
ALTER TABLE "event" DROP COLUMN "organizer_token_hash";
