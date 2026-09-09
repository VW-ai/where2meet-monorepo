/*
  Warnings:

  - The primary key for the `venue` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `event_id` on the `venue` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `venue` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "venue" DROP CONSTRAINT "venue_event_id_fkey";

-- DropForeignKey
ALTER TABLE "vote" DROP CONSTRAINT "vote_venue_id_event_id_fkey";

-- DropIndex
DROP INDEX "venue_event_id_idx";

-- AlterTable
ALTER TABLE "venue" DROP CONSTRAINT "venue_pkey",
DROP COLUMN "event_id",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "venue_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
