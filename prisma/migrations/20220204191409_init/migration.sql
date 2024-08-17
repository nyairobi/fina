-- CreateTable
CREATE TABLE "Server" (
    "name" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT E'en',

    CONSTRAINT "Server_pkey" PRIMARY KEY ("serverId")
);

-- CreateTable
CREATE TABLE "ServerInfo" (
    "modmailChId" TEXT,
    "serverId" TEXT NOT NULL,
    "wiki" TEXT[],
    "pollChId" TEXT,

    CONSTRAINT "ServerInfo_pkey" PRIMARY KEY ("serverId")
);

-- CreateTable
CREATE TABLE "Counter" (
    "counterId" SERIAL NOT NULL,
    "maxValue" INTEGER NOT NULL DEFAULT 1,
    "serverId" TEXT NOT NULL,
    "canSelfAward" BOOLEAN NOT NULL DEFAULT false,
    "commandName" TEXT NOT NULL DEFAULT E'rep',
    "pluralName" TEXT NOT NULL DEFAULT E'reputation points',
    "singuName" TEXT NOT NULL DEFAULT E'a reputation point',
    "summaryEmoji" TEXT NOT NULL DEFAULT E'⭐',
    "summaryName" TEXT NOT NULL DEFAULT E'Rep',

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("counterId")
);

-- CreateTable
CREATE TABLE "CounterPreset" (
    "counterId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "CounterPreset_pkey" PRIMARY KEY ("counterId","title")
);

-- CreateTable
CREATE TABLE "CounterEntry" (
    "userId" TEXT NOT NULL,
    "counterId" INTEGER NOT NULL,
    "title" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" INTEGER NOT NULL,
    "dstMsgUrl" TEXT NOT NULL,

    CONSTRAINT "CounterEntry_pkey" PRIMARY KEY ("dstMsgUrl")
);

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "mmr" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Post" (
    "dstMsgId" TEXT NOT NULL,
    "srcMsgId" TEXT,
    "localId" INTEGER NOT NULL DEFAULT 0,
    "dstChannelId" TEXT NOT NULL,
    "srcChannelId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("dstMsgId")
);

-- CreateTable
CREATE TABLE "PostChannel" (
    "channelId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT E'Post',
    "baseColor" TEXT NOT NULL DEFAULT E'#cccccc',

    CONSTRAINT "PostChannel_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "PostChannelRequirement" (
    "channelId" TEXT NOT NULL,
    "attachment" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[],

    CONSTRAINT "PostChannelRequirement_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "PostChannelVotingOption" (
    "channelId" TEXT NOT NULL,
    "upvoteId" TEXT,
    "downvoteId" TEXT,
    "onlyUpvotes" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostChannelVotingOption_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "PostChannelConfirmationOption" (
    "channelId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "PostChannelConfirmationOption_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "PostChannelSelection" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "inputName" TEXT NOT NULL,
    "outputName" TEXT NOT NULL,

    CONSTRAINT "PostChannelSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostChannelConfirmation" (
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "PostChannelConfirmation_pkey" PRIMARY KEY ("userId","channelId")
);

-- CreateTable
CREATE TABLE "Command" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "UserDeathInfo" (
    "userId" TEXT NOT NULL,
    "lostCells" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "deathCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserDeathInfo_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Trivia" (
    "triviaId" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "author" TEXT,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "thumb" TEXT,
    "image" TEXT,

    CONSTRAINT "Trivia_pkey" PRIMARY KEY ("triviaId")
);

-- CreateTable
CREATE TABLE "TriviaCategory" (
    "categoryId" SERIAL NOT NULL,
    "categoryName" TEXT NOT NULL,
    "serverId" TEXT,
    "color" TEXT,

    CONSTRAINT "TriviaCategory_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "Button" (
    "messageId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Button_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "Poll" (
    "messageId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "liveUpdate" BOOLEAN NOT NULL,
    "multichoice" BOOLEAN NOT NULL,
    "prompts" TEXT[],
    "timeoutMinutes" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("userId","messageId","emoji")
);

-- CreateTable
CREATE TABLE "_CommandToServer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerInfo.modmailChId_unique" ON "ServerInfo"("modmailChId");

-- CreateIndex
CREATE UNIQUE INDEX "Post.srcMsgId_unique" ON "Post"("srcMsgId");

-- CreateIndex
CREATE UNIQUE INDEX "TriviaCategory_serverId_unique" ON "TriviaCategory"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "_CommandToServer_AB_unique" ON "_CommandToServer"("A", "B");

-- CreateIndex
CREATE INDEX "_CommandToServer_B_index" ON "_CommandToServer"("B");

-- AddForeignKey
ALTER TABLE "ServerInfo" ADD CONSTRAINT "ServerInfo_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInfo"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterPreset" ADD CONSTRAINT "CounterPreset_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "Counter"("counterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterEntry" ADD CONSTRAINT "CounterEntry_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "Counter"("counterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterEntry" ADD CONSTRAINT "CounterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_dstChannelId_fkey" FOREIGN KEY ("dstChannelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannel" ADD CONSTRAINT "PostChannel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInfo"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelRequirement" ADD CONSTRAINT "PostChannelRequirement_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelVotingOption" ADD CONSTRAINT "PostChannelVotingOption_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelConfirmationOption" ADD CONSTRAINT "PostChannelConfirmationOption_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelSelection" ADD CONSTRAINT "PostChannelSelection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelConfirmation" ADD CONSTRAINT "PostChannelConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChannelConfirmation" ADD CONSTRAINT "PostChannelConfirmation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PostChannelConfirmationOption"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeathInfo" ADD CONSTRAINT "UserDeathInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trivia" ADD CONSTRAINT "Trivia_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TriviaCategory"("categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriviaCategory" ADD CONSTRAINT "TriviaCategory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInfo"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Poll"("messageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommandToServer" ADD FOREIGN KEY ("A") REFERENCES "Command"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommandToServer" ADD FOREIGN KEY ("B") REFERENCES "Server"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;
