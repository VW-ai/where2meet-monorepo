UPDATE "participant"
SET "address" = NULL, "formatted_address" = NULL, "lat" = NULL, "lng" = NULL
WHERE "fuzzy_location" = true;

-- AlterTable
ALTER TABLE "participant" DROP COLUMN "fuzzy_location";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "default_fuzzy_location";
