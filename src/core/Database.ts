import { PrismaClient } from '@prisma/client';

const instance = new PrismaClient({});

export default instance;

export {
    Server as DbGuild,
    ServerInfo as DbGuildInfo,
    Counter as DbCounter,
    CounterPreset as DbCounterPreset,
    CounterEntry as DbCounterEntry,
    User as DbUser,
    Post as DbPost,
    PostChannel as DbPostChannel,
    PostChannelField as DbPostChannelField,
    CommandKey as DbCommandKey,
    CommandPackage as DbCommandPackage,
    UserDeathInfo as DbUserDeathInfo,
    Trivia as DbTrivia,
    TriviaCategory as DbTriviaCategory,
    Poll as DbPoll,
    PollChoice as DbPollChoice,
    PollVote as DbPollVote,
    ArcChart as DbArcChart,
    ArcUser as DbArcUser,
    ArcChartOwnership as DbArcChartOwnership,
    ArcPack as DbArcPack
} from '@prisma/client';
