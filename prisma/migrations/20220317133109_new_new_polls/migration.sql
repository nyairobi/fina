/*
  Warnings:

  - You are about to drop the column `multichoice` on the `Poll` table. All the data in the column will be lost.
  - You are about to drop the column `prompts` on the `Poll` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Poll` table. All the data in the column will be lost.
  - The primary key for the `PollVote` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `emoji` on the `PollVote` table. All the data in the column will be lost.
  - Added the required column `channelId` to the `Poll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `PollVote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Poll" DROP COLUMN "multichoice",
DROP COLUMN "prompts",
DROP COLUMN "startTime",
ADD COLUMN     "channelId" TEXT NOT NULL,
ADD COLUMN     "maxChoices" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minChoices" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rolePoll" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "endTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_pkey",
DROP COLUMN "emoji",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "PollVote_pkey" PRIMARY KEY ("userId", "messageId", "key");

-- CreateTable
CREATE TABLE "PollChoice" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollChoice_pkey" PRIMARY KEY ("messageId","key")
);

-- AddForeignKey
ALTER TABLE "PollChoice" ADD CONSTRAINT "PollChoice_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Poll"("messageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_messageId_key_fkey" FOREIGN KEY ("messageId", "key") REFERENCES "PollChoice"("messageId", "key") ON DELETE CASCADE ON UPDATE CASCADE;
