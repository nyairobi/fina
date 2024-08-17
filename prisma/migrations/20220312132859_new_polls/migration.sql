/*
  Warnings:

  - You are about to drop the column `timeoutMinutes` on the `Poll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Poll" DROP COLUMN "timeoutMinutes",
ADD COLUMN     "freeToInsert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageURL" TEXT,
ALTER COLUMN "endTime" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "liveUpdate" SET DEFAULT false,
ALTER COLUMN "multichoice" SET DEFAULT false,
ALTER COLUMN "title" SET DEFAULT E'Untitled';
