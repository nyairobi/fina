import { Mutex } from 'async-mutex';
import Database from 'core/Database';
import { IMenuCommand, BaseReply, IButtonCommand } from 'core/FinaCommand';
import { finassert, FinaError } from 'core/FinaError';
import { FinaSendOptions } from 'core/FinaReplyOptions';
import {
    UserId,
    FinaMenuInteraction,
    ChannelId,
    FinaButtonInteraction
} from 'core/Types';
import {
    Message,
    Collection,
    MessageActionRow,
    MessageSelectMenu,
    TextChannel,
    MessageAttachment,
    ThreadChannel,
    MessageButton
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import { StringTools } from 'util/StringTools';
import Tools from 'util/Tools';
import {
    ArcContestType,
    ArcRoundResult,
    ArcSessionData,
    ArcSessionInputData,
    ArcChart,
    ArcContestBanPhaseType,
    ArcContestColorModifierTypeDuel,
    ArcContestColorModifierType
} from 'commands/arc/base/Types';
import { ArcRendererCard } from '../base/ArcRenderer';
import { ArcTeam, ArcCommon } from '../base/ArcCommon';

// TODO cleanup
export class ArcSession /*extends FinaComponentTarget*/
    implements IMenuCommand, IButtonCommand
{
    private _data: ArcSessionData;
    private _mutex: Mutex;

    /** Array of rounds, and each round is a sorted array of user references (winner first) */
    private _results: ArcRoundResult[];

    private _chartListMessage: Message | null;

    /** Round status */
    /** The number of charts that have been banned this round  */
    private _bannedThisRound: number;
    /** The API song_id of the song that's currently being played, or null during the ban/pick phase*/
    private _awaitingResultsOf: string | null;
    /** Whether the round is over */
    private _gameOver: boolean;

    public constructor(data: ArcSessionData) {
        // super('ninja.nairobi.components.arcsession');
        this._data = data;

        /* Sort charts by name, unless it's Light & Conflict */
        this._data.charts.sort((a, b) => {
            if (
                ArcCommon.isLightAndConflict(data.colorModifier) &&
                (a.color === 'DARK') !== (b.color === 'DARK')
            ) {
                return a.color === 'DARK' ? 1 : -1;
            } else {
                return a.name.localeCompare(b.name) || a.tier - b.tier;
            }
        });

        let banPhaseAltered = false;
        if (
            this._data.banPhase === ArcContestBanPhaseType.Classic &&
            data.charts.length < data.rounds * (data.teams.length + 1)
        ) {
            this._data.banPhase = ArcContestBanPhaseType.Normal;
            banPhaseAltered = true;
        }

        if (
            this._data.banPhase === ArcContestBanPhaseType.Normal &&
            data.charts.length < data.rounds * data.teams.length
        ) {
            this._data.banPhase = ArcContestBanPhaseType.FirstPhase;
            banPhaseAltered = true;
        }

        if (
            this._data.banPhase === ArcContestBanPhaseType.FirstPhase &&
            data.charts.length < data.rounds + data.teams.length
        ) {
            this._data.banPhase = ArcContestBanPhaseType.None;
            banPhaseAltered = true;
        }

        if (banPhaseAltered) {
            DiscordTools.sendMessage(this._data.command, {
                title: 'Warning',
                content: 'Insufficient number of charts for the requested ban phase type',
                channel: this._data.thread
            });
        }

        this._mutex = new Mutex();

        this._results = [];
        this._bannedThisRound = 0;
        this._awaitingResultsOf = null;
        this._chartListMessage = null;
        this._gameOver = false;
    }

    public async init() {
        this._chartListMessage = await DiscordTools.sendMessage(this._data.command, {
            forceRaw: true,
            files: await this.getChartListContent(),
            channelId: this._data.thread.id
        });

        /* Attempt to pin but ignore if it doesn't have permissions */
        this._chartListMessage.pin().catch(() => {});
    }

    public async start() {
        if (this._data.banPhase !== ArcContestBanPhaseType.None) {
            this.shiftContestantsIfNormalBan();
            await this.requestBan();
        } else {
            await this.requestPick();
        }
    }

    public get awaitingResults() {
        return this._awaitingResultsOf !== null;
    }

    public get currentSong() {
        return this._awaitingResultsOf;
    }

    public get teams() {
        return this._data.teams;
    }

    public get roundNumber() {
        return this._results.length + 1;
    }

    public get thread() {
        return this._data.thread;
    }

    public get rankBy() {
        return this._data.rankBy;
    }

    public get mutex() {
        return this._mutex;
    }

    public get gameOver() {
        return this._gameOver;
    }

    private shiftContestants() {
        /* Move the current contestant to the end of the q */
        const firstContestant = this.teams.shift();
        finassert(firstContestant !== undefined, {
            message: 'Fatal error',
            details: 'Empty contestant queue'
        });
        this.teams.push(firstContestant);
    }

    private shiftContestantsIfNormalBan() {
        if (this._data.banPhase === ArcContestBanPhaseType.Normal) {
            this._bannedThisRound++;
            this.shiftContestants();
        }
    }

    private async showRoundResults(
        reply: BaseReply,
        roundResults: ArcRoundResult,
        attachment: MessageAttachment | null,
        copium616: boolean
    ) {
        const fields = [];

        if (roundResults.every((result) => result.score !== undefined)) {
            for (const result of roundResults) {
                fields.push({
                    name: `${result.score?.toLocaleString('de-DE').replace(/\./g, "'")}`,
                    value: `${result.team}`
                });
            }
        } else {
            const titles = ['1st', '2nd', '3rd', '4th'];
            for (const result of roundResults) {
                fields.push({
                    name: `${titles.shift() ?? 'unknown'} place`,
                    value: `${result.team}`
                });
            }
        }
        const disclaimer =
            'This service utilizes API functionality provided by and with permission from lowiro. It is not affiliated with or endorsed by lowiro.';

        await reply({
            title: `Round ${this.roundNumber - 1} – results`,
            image: { url: attachment?.url ?? undefined },
            fields,
            footer: copium616 ? { text: disclaimer } : undefined
        });
    }

    public async addResults(
        reply: BaseReply,
        results: ArcRoundResult,
        attachment: MessageAttachment | null,
        copium616: boolean
    ) {
        finassert(this.awaitingResults, {
            message: 'This session is not awaiting results'
        });

        this._results.push(results);
        this._bannedThisRound = 0;
        this._awaitingResultsOf = null;

        if (this._data.contestType !== ArcContestType.Group) {
            this._data.teams = results
                .map((result) => result.team)
                .slice()
                .reverse();
        } else {
            this.shiftContestants();
        }

        await this.showRoundResults(reply, results, attachment, copium616);
        await this.showStandings();

        if (this._gameOver) {
            await DiscordTools.sendMessage(this._data.command, {
                title: 'This match is over',
                channel: this._data.thread
            });
        } else {
            this.shiftContestantsIfNormalBan();
            if (this._data.banPhase === ArcContestBanPhaseType.FirstPhase) {
                this._bannedThisRound = this.teams.length;
            }
            this.continueRound();
        }
    }

    /**
     * For Light&Conflict: ask the first player for their desired color
     */
    public async lightAndConflictQueryUser() {
        const playerId = this.teams[1].userIds[0];
        finassert(typeof playerId === 'string', {
            message: 'Invalid teams in the session',
            gif: 'dead'
        });

        const buttonL = new MessageButton()
            .setCustomId('lnc-light')
            .setEmoji('434677515471028234')
            .setStyle('PRIMARY');
        const buttonC = new MessageButton()
            .setCustomId('lnc-dark')
            .setEmoji('504123064397856778')
            .setStyle('SECONDARY');

        const row = new MessageActionRow().addComponents(buttonL, buttonC);

        await DiscordTools.sendMessage(this._data.command, {
            content: `<@${playerId}>, choose your affiliation:`,
            forceRaw: true,
            components: [row],
            channel: this._data.thread
        });
    }

    private async showStandings() {
        const standings: Collection<ArcTeam, number> = new Collection();
        for (const team of this.teams) {
            standings.set(team, 0);
        }
        if (this._data.contestType === ArcContestType.Group) {
            if (this.roundNumber > this._data.rounds) {
                this._gameOver = true;
            }
            for (const result of this._results) {
                const POINTS = [10, 7, 5, 4];
                for (let i = 0; i < result.length; ++i) {
                    const team = result[i].team;
                    const points = POINTS[i];
                    standings.set(team, (standings.get(team) ?? 0) + points);
                }
            }
        } else {
            for (const [winner] of this._results) {
                const newScore = (standings.get(winner.team) ?? 0) + 1;
                standings.set(winner.team, newScore);
                if (newScore > this._data.rounds / 2.0) {
                    this._gameOver = true;
                }
            }
        }

        const standingsArray = Array.from(standings.entries()).sort(
            ([, score1], [, score2]) => score2 - score1
        );

        const fields = standingsArray.map(([team, score]) => {
            return {
                name: `${score} point${score === 1 ? '' : 's'}`,
                value: `${team}`
            };
        });

        await DiscordTools.sendMessage(this._data.command, {
            title: `Standings after ${this.roundNumber - 1} round${
                this.roundNumber - 1 === 1 ? '' : 's'
            }`,
            fields,
            channel: this._data.thread
        });

        if (this._gameOver) {
            const name = ArcSession.getThreadName(
                standingsArray.map((standing) => standing[0])
            );
            const results = standingsArray
                .map((standing) => `${standing[1]}`)
                .reduce((prev, curr) => `${prev}–${curr}`);
            await this._data.thread.setName(`[${results}] ${name}`);
        }
    }

    private async getChartListContent() {
        return await ArcRendererCard.render(this._data.charts);
    }

    // private getChartListContent(): EmbedFieldData[] {
    //     const chartToLine = (arcChart: ArcChart) =>
    //         `<:m:${emoji.shift()}> **${arcChart.name}** ${ArcSession.difficultyString(
    //             arcChart.tier
    //         )} [${(arcChart.chartConstant / 10.0).toFixed(1)}]`;
    //     const unbannedLines = this._data.charts
    //         .filter((chart) => !chart.banned)
    //         .map((arcChart) => chartToLine(arcChart));
    //     const unbannedChunks = Tools.splitArrayIntoChunks(unbannedLines, 20);
    //     const bannedLines = this._data.charts
    //         .filter((chart) => chart.banned)
    //         .map((arcChart) => `~~${chartToLine(arcChart)}~~`);

    //     console.log(
    //         unbannedChunks.map((chunk) =>
    //             chunk.map((xd) => xd.length).reduce((acc, next) => acc + next)
    //         )
    //     );

    //     const res = unbannedChunks.map((lines, idx) => {
    //         const value = lines.reduce((previous, current) => `${previous}\n${current}`);
    //         if (unbannedChunks.length === 1) {
    //             return {
    //                 name: 'Available charts',
    //                 value
    //             };
    //         } else {
    //             return {
    //                 name: `Page ${idx + 1}`,
    //                 value
    //             };
    //         }
    //     });
    //     if (bannedLines.length > 0) {
    //         res.push({
    //             name: 'Banned charts',
    //             value: bannedLines.reduce(
    //                 (previous, current) => `${previous}\n${current}`
    //             )
    //         });
    //     }

    //     return res;
    // }

    private async refreshChartList(chart: ArcChart) {
        if (this._chartListMessage !== null) {
            const attachments = Array.from(this._chartListMessage.attachments.values());
            const CHUNK_SIZE = 5;
            const idx = this._data.charts.findIndex(
                (searchedChart) => searchedChart === chart
            );
            const chunkIdx = Math.floor(idx / CHUNK_SIZE);
            const chunkCharts = this._data.charts.slice(
                chunkIdx * CHUNK_SIZE,
                (chunkIdx + 1) * CHUNK_SIZE
            );
            const render = await ArcRendererCard.render(chunkCharts);
            finassert(render.length === 1, {
                message: 'Unable to render the chart list',
                details: 'No attachments',
                gif: 'dead'
            });
            attachments[chunkIdx] = render[0].setName(`list${chunkIdx}.png`);

            await DiscordTools.editMessage(null, {
                files: attachments,
                forceRaw: true,
                message: this._chartListMessage
            }).catch(() => {
                throw new FinaError({
                    message: 'Unable to render the chart list',
                    details: 'Unable to edit message',
                    gif: 'dead'
                });
            });
        }
    }

    public static difficultyString(difficultyValue: number) {
        const difficultyNames = ['PST', 'PRS', 'FTR', 'BYD'];
        return difficultyNames[difficultyValue] ?? 'Unknown';
    }

    private createChartMenu(command: 'pick' | 'ban', memberIds: UserId[], team: ArcTeam) {
        const rows: MessageActionRow[] = [];
        const charts = this._data.charts.filter((arcChart) => {
            if (team.allegiance !== 'none') {
                /* Finale songs count as light */
                const chartColor = arcChart.color === 'DARK' ? 'dark' : 'light';
                return command === 'pick'
                    ? /* Pick from your side */
                      chartColor === team.allegiance
                    : /* Ban the opposite */
                      chartColor !== team.allegiance;
            } else {
                return true;
            }
        });

        /* Split the unbanned charts into sublists of 25 (25 is the SelectMenu limit) */
        const chartSublists = Tools.splitArrayIntoChunks(charts, 25);

        for (const chartSublist of chartSublists) {
            const options = chartSublist
                .filter((chart) => chart.status === 'ready')
                .map((chart) => {
                    return {
                        label: chart.name,
                        description: ArcSession.difficultyString(chart.tier),
                        value: `${chart.apiName}/${chart.tier}`
                    };
                });
            const menu = new MessageSelectMenu()
                .setCustomId(`${command}/${memberIds.join('-')}:${rows.length}`)
                .setOptions(options);

            if (options.length > 0) {
                if (chartSublists.length > 1) {
                    menu.setPlaceholder(
                        `${options.at(0)!.label} – ${options.at(-1)!.label}`
                    );
                }

                rows.push(new MessageActionRow().addComponents(menu));
            }
        }
        return rows;
    }

    private async requestPick() {
        const team = this.teams[0];
        const name = team.toString(' and ');
        await DiscordTools.sendMessage(this._data.command, {
            content: `${name}'s turn to <:pick1:967819409039179816><:pick2:967819409035001856>`,
            forceRaw: true,
            components: this.createChartMenu('pick', team.userIds, team),
            channel: this._data.thread
        });
    }

    private async requestBan() {
        const team = this.teams[0];
        const name = team.toString(' and ');
        await DiscordTools.sendMessage(this._data.command, {
            content: `${name}'s turn to <:ban1:967818524598882314><:ban2:967818533851521084>`,
            forceRaw: true,
            components: this.createChartMenu('ban', team.userIds, team),
            channel: this._data.thread
        });
    }

    public async continueRound() {
        if (
            this._bannedThisRound === this.teams.length ||
            this._data.banPhase === ArcContestBanPhaseType.None
        ) {
            await this.requestPick();
        } else {
            await this.requestBan();
        }
    }

    private async processPickOrBan(
        reply: BaseReply,
        interaction: FinaMenuInteraction,
        command: 'pick' | 'ban'
    ) {
        if (this.awaitingResults) {
            await interaction.message.delete();
            throw new FinaError({
                message: 'This session is awaiting results',
                gif: 'dead'
            });
        }

        const slashIdx = interaction.customId.indexOf('/');
        const colonIdx = interaction.customId.indexOf(':');
        if (slashIdx > 0 && colonIdx > 0) {
            const userIds = interaction.customId.slice(slashIdx + 1, colonIdx).split('-');
            finassert(userIds.includes(interaction.user.id), {
                message: "It's not your turn!",
                gif: 'permissions'
            });
        }
        const matchArray = interaction.values[0].match(/(.+)\/(.+)/);
        finassert(matchArray !== null, { message: 'Invalid interaction' });
        const chartApiName = matchArray[1];
        const chartTier = parseInt(matchArray[2]);
        const chart = this._data.charts.find(
            (chart) => chart.apiName === chartApiName && chart.tier === chartTier
        );
        finassert(chart !== undefined, { message: 'Unable to find the chart' });
        finassert(chart.status === 'ready', {
            message: 'This chart has already been banned',
            gif: 'angry'
        });

        /* Just an extra check because L&C menus should be filtered already anyway */
        if (ArcCommon.isLightAndConflict(this._data.colorModifier)) {
            const team = this.teams.find((team) =>
                team.userIds.some((userId) => userId === interaction.user.id)
            );
            finassert(team !== undefined, {
                message: 'Unable to find your team',
                gif: 'dead'
            });
            const chartColor = chart.color === 'DARK' ? 'dark' : 'light';
            if (command === 'pick') {
                finassert(team.allegiance === chartColor, {
                    message: 'You cannot pick an enemy chart',
                    gif: 'permissions'
                });
            } else {
                finassert(team.allegiance !== chartColor, {
                    message: 'You cannot ban a friendly chart',
                    gif: 'permissions'
                });
            }
        }

        chart.status = command === 'pick' ? 'picked' : 'banned';
        await reply({ cancel: true });
        interaction.message.delete();

        let res: FinaSendOptions = {
            content: `<@${interaction.user.id}> has banned **${
                chart.name
            }** [${ArcSession.difficultyString(chart.tier)}]`,
            channel: this._data.thread
        };

        if (command === 'ban') {
            res.title = 'Chart banned';
            res.color = 'DARK_RED';
        } else {
            if (chart.coverArt) {
                res.files = [new MessageAttachment(chart.coverArt, 'cover.png')];
                res.image = { url: 'attachment://cover.png' };
            }
            res.content = `${res.content?.replace('banned', 'chosen')}.\nGood luck!`;
            res.title = 'Chart picked';
            res.color = 'DARK_GREEN';
        }
        await DiscordTools.sendMessage(this._data.command, res);

        await this.refreshChartList(chart);

        if (command === 'ban') {
            this._bannedThisRound++;
            this.shiftContestants();
            await this.continueRound();
        } else {
            // New round
            this._awaitingResultsOf = chartApiName;
        }
    }

    public async processMenu(
        reply: BaseReply,
        interaction: FinaMenuInteraction
    ): Promise<void> {
        /* There is still a race condition but it's extremely unlikely to happen */
        finassert(!this._mutex.isLocked(), {
            message: 'This menu is already being processed'
        });
        await this._mutex.runExclusive(async () => {
            if (interaction.customId.startsWith('ban')) {
                await this.processPickOrBan(reply, interaction, 'ban');
            } else if (interaction.customId.startsWith('pick')) {
                await this.processPickOrBan(reply, interaction, 'pick');
            } else {
                throw new FinaError({ message: 'Unknown interaction' });
            }
        });
    }

    public async processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> {
        const playerId = this.teams[1].userIds[0];
        let lightId;
        let darkId;

        finassert(playerId === interaction.user.id, {
            message: "It's not your turn!",
            gif: 'permissions'
        });

        if (interaction.customId === 'lnc-light') {
            this.teams[1].allegiance = 'light';
            this.teams[0].allegiance = 'dark';
            lightId = this.teams[1].userIds[0];
            darkId = this.teams[0].userIds[0];
            await reply({ content: 'You have chosen Light.', ephemeral: true });
        } else {
            this.teams[1].allegiance = 'dark';
            this.teams[0].allegiance = 'light';
            lightId = this.teams[0].userIds[0];
            darkId = this.teams[1].userIds[0];
            await reply({ content: 'You have chosen Conflict.', ephemeral: true });
        }

        await interaction.message.delete();

        await DiscordTools.sendMessage(this._data.command, {
            title: 'Allegiance',
            fields: [
                { name: 'Light', value: `<@${lightId}>`, inline: true },
                { name: 'Conflict', value: `<@${darkId}>`, inline: true }
            ],
            channel: this._data.thread
        });

        await this.start();
    }

    public static getThreadName(teams: ArcTeam[]) {
        return teams
            .map((team) =>
                team.contestants
                    .map((contestant) => StringTools.trim(contestant.arcName, 20))
                    .join(', ')
            )
            .reduce((previous, current) => `${previous} vs ${current}`);
    }
}

export class ArcSessionManager {
    private static readonly TIMEOUT = 2 * 3600_000;
    private static _sessions: Collection<ChannelId, ArcSession> = new Collection();

    public static async create(data: ArcSessionInputData) {
        finassert(!Tools.hasDuplicates(data.teamMembers.flat()), {
            message: 'The list of contestants cannot have duplicates'
        });

        const [teams, charts] = await Promise.all([
            this.createTeams(data),
            this.createChartList(data)
        ]);
        const thread = await this.createThread(data, teams);

        const session = new ArcSession({
            ...data,
            teams,
            charts,
            thread
        });

        await session.init();

        this._sessions.set(thread.id, session);

        setTimeout(() => {
            this._sessions.delete(thread.id);
        }, this.TIMEOUT);

        await this.sendWelcomeMessage(data, thread);

        if (ArcCommon.isLightAndConflict(data.colorModifier)) {
            await session.lightAndConflictQueryUser();
        } else {
            await session.start();
        }

        return session;
    }

    public static get(threadId: ChannelId) {
        const session = this._sessions.get(threadId);

        finassert(session !== undefined, {
            message: `There is no Arcaea session in this channel. 
            Make sure you are in the thread, in full view (split view is bugged)`,
            gif: 'angry'
        });

        return session;
    }

    private static async createTeams(data: ArcSessionInputData) {
        const teams: ArcTeam[] = [];
        for (const teamMembers of data.teamMembers) {
            const dbArcUsers = await Database.arcUser.findMany({
                where: {
                    OR: teamMembers.map((member) => {
                        return { userId: member.id };
                    })
                }
            });
            for (const member of teamMembers) {
                const found = dbArcUsers.find(
                    (dbArcUser) => dbArcUser.userId === member.id
                );
                finassert(found !== undefined, {
                    message: `<@${member.id}> has not bound their Arcaea profile `
                });
            }

            teams.push(new ArcTeam(dbArcUsers));
        }

        /* Sort teams by ptt/b30, lowest first (for the initial round) */
        if (data.orderBy === 'Potential') {
            teams.sort(ArcTeam.pttComparator);
        } else if (data.orderBy === 'Best 30') {
            teams.sort(ArcTeam.b30Comparator);
        } else {
            Tools.shuffle(teams);
        }

        return teams;
    }

    private static async createChartList(data: ArcSessionInputData) {
        let commonCharts = (
            await ArcCommon.getCommonCharts(
                data.teamMembers.flat(),
                data.minDifficulty,
                data.maxDifficulty,
                data.difficultyModifier,
                data.colorModifier
            )
        ).map((dbArcChart) => {
            return { ...dbArcChart, status: 'ready' } as ArcChart;
        });

        if (ArcCommon.isLightAndConflict(data.colorModifier)) {
            if (
                data.colorModifier ===
                ArcContestColorModifierTypeDuel.LightAndConflictReverse
            ) {
                // Switcharoo
                for (const chart of commonCharts) {
                    if (chart.color === 'DARK' && chart.lightBg !== '') {
                        chart.color = 'LIGHT';
                    } else if (chart.color !== 'DARK' && chart.darkBg !== '') {
                        chart.color = 'DARK';
                    }
                }
            }

            const lightCharts = commonCharts.filter(
                (arcChart) => arcChart.color !== 'DARK'
            );
            const darkCharts = commonCharts.filter(
                (arcChart) => arcChart.color === 'DARK'
            );
            const symmetricSize = Math.min(lightCharts.length, darkCharts.length);

            // Make sure chartCount is even
            if (data.chartCount % 2 === 1) {
                data.chartCount--;
            }

            const actualSize = Math.min(symmetricSize, data.chartCount / 2);

            finassert(actualSize * 2 >= data.rounds, {
                message: 'Insufficient number of charts for this contest type'
            });

            Tools.shuffle(lightCharts);
            Tools.shuffle(darkCharts);

            return [
                ...lightCharts.slice(0, actualSize),
                ...darkCharts.slice(0, actualSize)
            ];
        } else {
            finassert(Math.min(commonCharts.length, data.chartCount) >= data.rounds, {
                message: 'Insufficient number of charts for this contest type'
            });

            Tools.shuffle(commonCharts);

            return commonCharts.slice(0, data.chartCount);
        }
    }

    private static async createThread(data: ArcSessionInputData, teams: ArcTeam[]) {
        finassert(data.sourceChannel instanceof TextChannel, {
            message: 'This command does not work inside threads'
        });

        const name = ArcSession.getThreadName(teams);
        const thread = await data.sourceChannel.threads.create({
            type: 'GUILD_PUBLIC_THREAD',
            autoArchiveDuration: 60,
            name
        });

        for (const contestant of data.teamMembers.flat()) {
            try {
                await thread.members.add(contestant);
            } catch (error) {
                await thread.delete().catch();
                throw new FinaError({
                    message: `Unable to add <@${contestant.id}> to the thread`
                });
            }
        }

        return thread;
    }

    private static async sendWelcomeMessage(
        data: ArcSessionInputData,
        thread: ThreadChannel
    ) {
        await DiscordTools.sendMessage(null, {
            channel: thread,
            title: thread.name,
            fields: [
                {
                    name: 'Contest type',
                    value: ArcContestType[data.contestType],
                    inline: true
                },
                {
                    name: 'Max rounds',
                    value: `${data.rounds}`,
                    inline: true
                },
                {
                    name: 'Min difficulty',
                    value: `${(data.minDifficulty / 10.0).toFixed(1)}`,
                    inline: true
                },
                {
                    name: 'Max difficulty',
                    value: `${(data.maxDifficulty / 10.0).toFixed(1)}`,
                    inline: true
                },
                {
                    name: 'Ordered by',
                    value: data.orderBy,
                    inline: true
                },
                {
                    name: 'Ranked by',
                    value: data.rankBy,
                    inline: true
                },
                {
                    name: 'Ban phase',
                    value: data.banPhase,
                    inline: true
                },
                {
                    name: 'Modifier',
                    value: data.colorModifier,
                    inline: true
                },
                {
                    name: '\u200b',
                    value: '\u200b',
                    inline: true
                }
            ]
        });
    }
}
