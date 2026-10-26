-- CreateEnum
CREATE TYPE "MapProvider" AS ENUM ('google', 'amap');

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "map_provider" "MapProvider" NOT NULL DEFAULT 'google';
