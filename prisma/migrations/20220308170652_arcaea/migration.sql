/*
  Warnings:

  - The primary key for the `Post` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `dstChannelId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `dstMsgId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `srcChannelId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `srcMsgId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `baseColor` on the `PostChannel` table. All the data in the column will be lost.
  - You are about to drop the column `command` on the `PostChannel` table. All the data in the column will be lost.
  - You are about to drop the column `acceptedTerms` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `PostChannelConfirmation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostChannelConfirmationOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostChannelRequirement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostChannelSelection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostChannelVotingOption` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `channelId` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `msgId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PostChannelVotingType" AS ENUM ('NO_VOTES', 'UP_DOWN', 'UP_ONLY');

-- CreateEnum
CREATE TYPE "PostVoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "PostFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'ATTACHMENT');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_dstChannelId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelConfirmation" DROP CONSTRAINT "PostChannelConfirmation_channelId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelConfirmation" DROP CONSTRAINT "PostChannelConfirmation_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelConfirmationOption" DROP CONSTRAINT "PostChannelConfirmationOption_channelId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelRequirement" DROP CONSTRAINT "PostChannelRequirement_channelId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelSelection" DROP CONSTRAINT "PostChannelSelection_channelId_fkey";

-- DropForeignKey
ALTER TABLE "PostChannelVotingOption" DROP CONSTRAINT "PostChannelVotingOption_channelId_fkey";

-- DropIndex
DROP INDEX "Post.srcMsgId_unique";

-- AlterTable
ALTER TABLE "Post" DROP CONSTRAINT "Post_pkey",
DROP COLUMN "dstChannelId",
DROP COLUMN "dstMsgId",
DROP COLUMN "srcChannelId",
DROP COLUMN "srcMsgId",
ADD COLUMN     "channelId" TEXT NOT NULL,
ADD COLUMN     "msgId" TEXT NOT NULL,
ALTER COLUMN "localId" DROP DEFAULT,
ALTER COLUMN "userId" DROP NOT NULL,
ADD CONSTRAINT "Post_pkey" PRIMARY KEY ("msgId");

-- AlterTable
ALTER TABLE "PostChannel" DROP COLUMN "baseColor",
DROP COLUMN "command",
ADD COLUMN     "allowEdits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowThreads" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT E'#999999',
ADD COLUMN     "commandName" TEXT NOT NULL DEFAULT E'post',
ADD COLUMN     "downvote" TEXT NOT NULL DEFAULT E'⬇️',
ADD COLUMN     "upvote" TEXT NOT NULL DEFAULT E'⬆️',
ADD COLUMN     "votingType" "PostChannelVotingType" NOT NULL DEFAULT E'NO_VOTES';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "acceptedTerms";

-- DropTable
DROP TABLE "PostChannelConfirmation";

-- DropTable
DROP TABLE "PostChannelConfirmationOption";

-- DropTable
DROP TABLE "PostChannelRequirement";

-- DropTable
DROP TABLE "PostChannelSelection";

-- DropTable
DROP TABLE "PostChannelVotingOption";

-- CreateTable
CREATE TABLE "PostVote" (
    "msgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PostVoteType" NOT NULL,

    CONSTRAINT "PostVote_pkey" PRIMARY KEY ("msgId","userId")
);

-- CreateTable
CREATE TABLE "PostChannelField" (
    "channelId" TEXT NOT NULL,
    "rank" SERIAL NOT NULL,
    "inputName" TEXT NOT NULL DEFAULT E'Default Title',
    "outputName" TEXT,
    "placeholder" TEXT NOT NULL DEFAULT E'',
    "type" "PostFieldType" NOT NULL,

    CONSTRAINT "PostChannelField_pkey" PRIMARY KEY ("channelId","rank")
);

-- CreateTable
CREATE TABLE "ArcUser" (
    "userId" TEXT NOT NULL,
    "arcId" INTEGER NOT NULL,
    "arcName" TEXT NOT NULL,
    "ptt" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ArcUser_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ArcPack" (
    "packName" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "ArcPack_pkey" PRIMARY KEY ("packName")
);

-- CreateTable
CREATE TABLE "ArcChart" (
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "chartConstant" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "packName" TEXT NOT NULL,
    "isDark" BOOLEAN NOT NULL DEFAULT false,
    "isWorld" BOOLEAN NOT NULL DEFAULT false,
    "coverArt" TEXT,

    CONSTRAINT "ArcChart_pkey" PRIMARY KEY ("name","tier")
);

-- CreateTable
CREATE TABLE "ArcChartOwnership" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "ArcChartOwnership_pkey" PRIMARY KEY ("userId","name","tier")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_msgId_fkey" FOREIGN KEY ("msgId") REFERENCES "Post"("msgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelField" ADD CONSTRAINT "PostChannelField_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcUser" ADD CONSTRAINT "ArcUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcChart" ADD CONSTRAINT "ArcChart_packName_fkey" FOREIGN KEY ("packName") REFERENCES "ArcPack"("packName") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcChartOwnership" ADD CONSTRAINT "ArcChartOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ArcUser"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcChartOwnership" ADD CONSTRAINT "ArcChartOwnership_name_tier_fkey" FOREIGN KEY ("name", "tier") REFERENCES "ArcChart"("name", "tier") ON DELETE CASCADE ON UPDATE CASCADE;
