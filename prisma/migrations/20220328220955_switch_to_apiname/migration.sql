/*
  Warnings:

  - The primary key for the `ArcChart` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `emoji` on the `ArcChart` table. All the data in the column will be lost.
  - The primary key for the `ArcChartOwnership` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `name` on the `ArcChartOwnership` table. All the data in the column will be lost.
  - You are about to drop the column `emoji` on the `ArcPack` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ArcChartOwnership" DROP CONSTRAINT "ArcChartOwnership_name_tier_fkey";

-- AlterTable
ALTER TABLE "ArcChart" DROP CONSTRAINT "ArcChart_pkey",
DROP COLUMN "emoji",
ALTER COLUMN "apiName" DROP DEFAULT,
ADD CONSTRAINT "ArcChart_pkey" PRIMARY KEY ("apiName", "tier");

-- AlterTable
ALTER TABLE "ArcChartOwnership" DROP CONSTRAINT "ArcChartOwnership_pkey",
DROP COLUMN "name",
ALTER COLUMN "apiName" DROP DEFAULT,
ADD CONSTRAINT "ArcChartOwnership_pkey" PRIMARY KEY ("userId", "apiName", "tier");

-- AlterTable
ALTER TABLE "ArcPack" DROP COLUMN "emoji";

-- AddForeignKey
ALTER TABLE "ArcChartOwnership" ADD CONSTRAINT "ArcChartOwnership_apiName_tier_fkey" FOREIGN KEY ("apiName", "tier") REFERENCES "ArcChart"("apiName", "tier") ON DELETE CASCADE ON UPDATE CASCADE;
