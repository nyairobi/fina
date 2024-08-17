/*
  Warnings:

  - You are about to drop the column `isDark` on the `ArcChart` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ArcPackType" AS ENUM ('MAIN', 'MAIN_STORY', 'SIDE_STORY', 'COLLAB');

-- CreateEnum
CREATE TYPE "ArcChartColor" AS ENUM ('LIGHT', 'DARK', 'COLORLESS');

-- AlterTable
ALTER TABLE "ArcChart" DROP COLUMN "isDark",
ADD COLUMN     "color" "ArcChartColor" NOT NULL DEFAULT E'LIGHT',
ADD COLUMN     "darkBg" TEXT NOT NULL DEFAULT E'',
ADD COLUMN     "lightBg" TEXT NOT NULL DEFAULT E'';

-- AlterTable
ALTER TABLE "ArcPack" ADD COLUMN     "type" "ArcPackType" NOT NULL DEFAULT E'MAIN';
