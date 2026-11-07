-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('driving', 'walking', 'transit', 'bicycling');

-- AlterTable
ALTER TABLE "participant" ADD COLUMN     "travel_mode" "TravelMode" NOT NULL DEFAULT 'driving';
