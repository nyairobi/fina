/*
  Warnings:

  - You are about to drop the `Command` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CommandToServer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CommandToServer" DROP CONSTRAINT "_CommandToServer_A_fkey";

-- DropForeignKey
ALTER TABLE "_CommandToServer" DROP CONSTRAINT "_CommandToServer_B_fkey";

-- DropTable
DROP TABLE "Command";

-- DropTable
DROP TABLE "_CommandToServer";

-- CreateTable
CREATE TABLE "CommandPackage" (
    "packageId" TEXT NOT NULL,
    "friendlyName" TEXT NOT NULL DEFAULT E'No name',
    "description" TEXT NOT NULL DEFAULT E'No description',

    CONSTRAINT "CommandPackage_pkey" PRIMARY KEY ("packageId")
);

-- CreateTable
CREATE TABLE "CommandKey" (
    "key" TEXT NOT NULL,
    "friendlyName" TEXT NOT NULL DEFAULT E'No name',
    "description" TEXT NOT NULL DEFAULT E'No description',
    "packageId" TEXT NOT NULL,

    CONSTRAINT "CommandKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_CommandKeyToServer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CommandKeyToServer_AB_unique" ON "_CommandKeyToServer"("A", "B");

-- CreateIndex
CREATE INDEX "_CommandKeyToServer_B_index" ON "_CommandKeyToServer"("B");

-- AddForeignKey
ALTER TABLE "CommandKey" ADD CONSTRAINT "CommandKey_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommandPackage"("packageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommandKeyToServer" ADD FOREIGN KEY ("A") REFERENCES "CommandKey"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommandKeyToServer" ADD FOREIGN KEY ("B") REFERENCES "Server"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;
