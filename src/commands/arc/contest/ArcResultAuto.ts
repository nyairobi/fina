import { Mutex } from 'async-mutex';
import Database from 'core/Database';
import { BaseReply, IModalCommand } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { finassert } from 'core/FinaError';
import { FinaReplyOptions } from 'core/FinaReplyOptions';
import { Logger } from 'core/Logger';
import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
import { Collection, MessageActionRow, Modal, TextInputComponent } from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';
import Tools from 'util/Tools';
import { ArcCommon, ArcTeam } from '../base/ArcCommon';
import { ArcSession, ArcSessionManager } from './ArcSession';
import { ArcSessionBasedCommand } from './ArcSessionBasedCommand';
import 'dotenv/config';
import { ArcRoundResult } from '../base/Types';

export default class ArcResult extends ArcSessionBasedCommand implements IModalCommand {
    public constructor() {
        super('ninja.nairobi.arc.result');
        this.keys = ['ninja.nairobi.arc.contest'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'result';
        return [
            new FinaCommandBuilder(this)
                .setName('result')
                .setDescription('Processes the result of the current contest')
                .addOption({
                    name: 'method',
                    type: 'String',
                    description:
                        // 'The method of scraping the scores. Use manual if all else fails (default: main)',
                        'The method of scraping the scores. Every method other than manual has been shut down by lowiro',
                    choices: [
                        // 'Official',
                        // ['BotArcApi (Main)', 'Main'],
                        // ['BotArcApi (Fallback)', 'Fallback'],
                        'Manual'
                    ],
                    required: false
                })
        ];
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const arcSession = ArcSessionManager.get(interaction.channelId);
        const method = (interaction.options.getString('method') ?? 'Official') as
            | 'Official'
            | 'Main'
            | 'Fallback'
            | 'Manual';

        if (method === 'Manual') {
            finassert(arcSession.rankBy !== 'Shiny pures', {
                message: 'Manual mode is only supported for contests ranked by score',
                gif: 'dead'
            });
            await reply(await this.printManualModal(arcSession.teams));
        } else {
            await this.scrape(reply, arcSession, method);
        }
    }

    public async processModal(
        reply: BaseReply,
        interaction: FinaModalInteraction
    ): Promise<void> {
        const arcSession = ArcSessionManager.get(interaction.channel.id);

        finassert(arcSession.awaitingResults, {
            message: 'This session is not awaiting results'
        });

        const teams = arcSession.teams;
        const textInputs = interaction.components.map((row) => row.components[0]);
        const roundResults: ArcRoundResult = [];

        const results = new Collection<ArcTeam, number[]>();

        textInputs.forEach((textInput) => {
            const team = teams.find((team) => team.userIds.includes(textInput.customId));

            finassert(team !== undefined, {
                message: `Unable to find <@${textInput.customId}>'s team`
            });

            const thisScore = parseInt(textInput.value.replace(/[^0-9]/g, ''));
            results.ensure(team, () => []).push(thisScore);
        });

        results.sort(
            (a, b) =>
                b.reduce(Tools.sum) - a.reduce(Tools.sum) ||
                Math.max(...b) - Math.max(...a)
        );

        for (const [team, scores] of results.entries()) {
            roundResults.push({ team, score: scores.reduce(Tools.sum), shinies: 0 });
        }

        await arcSession.addResults(reply, roundResults, null, false);
    }

    private async printManualModal(teams: ArcTeam[]): Promise<FinaReplyOptions> {
        const rows = [];
        const contestants = ArcTeam.allContestants(teams);
        for (const contestant of contestants) {
            rows.push(
                new MessageActionRow<TextInputComponent>().addComponents(
                    new TextInputComponent()
                        .setCustomId(contestant.userId)
                        .setMinLength(1)
                        .setMaxLength(10)
                        .setLabel(contestant.arcName)
                        .setPlaceholder("10'000'000")
                        .setStyle(TextInputStyles.SHORT)
                )
            );
        }
        const modal = new Modal()
            .setCustomId('scores')
            .setTitle('Results')
            .addComponents(...rows);
        return { modal };
    }

    private async scrape(
        reply: BaseReply,
        arcSession: ArcSession,
        method: 'Official' | 'Main' | 'Fallback'
    ) {
        const mutex = arcSession.mutex;
        const roundResults: ArcRoundResult = [];
        await mutex.runExclusive(async () => {
            if (!arcSession.awaitingResults) {
                await reply({
                    content: 'This session is not awaiting results',
                    ephemeral: true
                });
                await arcSession.continueRound();
            } else {
                for (const team of arcSession.teams) {
                    const dbArcUsers = await Database.arcUser.findMany({
                        where: {
                            OR: team.userIds.map((userId) => {
                                return {
                                    userId
                                };
                            })
                        }
                    });
                    let scoreSum = 0;
                    let shinySum = 0;
                    for (const dbArcUser of dbArcUsers) {
                        if (method === 'Official') {
                            const rawData = await ArcCommon.userInfo616(
                                `${dbArcUser.arcId}`
                            );

                            finassert(ArcCommon.isValid616UserResponse(rawData), {
                                message:
                                    'Unable to query the Arcaea Limited Api. Try again later or use a different method',
                                details: `${dbArcUser.arcId}: ${JSON.stringify(rawData)}`
                            });

                            const recentScore = rawData.data.last_played_song;
                            scoreSum += recentScore.score;
                            shinySum += recentScore.shiny_pure_count;

                            finassert(recentScore.song_id === arcSession.currentSong, {
                                message: `<@${dbArcUser.userId}>'s most recent song does not match - has it been uploaded online?`
                            });
                        } else {
                            const rawData = await ArcCommon.query(
                                '/user/info',
                                {
                                    usercode: dbArcUser.arcId
                                },
                                method === 'Main' ? 'GLOBAL' : 'LOCAL'
                            );

                            finassert(ArcCommon.isValidUserResponse(rawData), {
                                message:
                                    'Unable to query BotArcApi. Try again later or use a different method',
                                details: `${dbArcUser.arcId}: ${JSON.stringify(rawData)}`
                            });

                            const [recentScore] = rawData.content.recent_score;
                            scoreSum += recentScore.score;
                            shinySum += recentScore.shiny_perfect_count;

                            finassert(recentScore.song_id === arcSession.currentSong, {
                                message: `<@${dbArcUser.userId}>'s most recent song does not match - has it been uploaded online?`
                            });
                        }
                    }
                    roundResults.push({ team, score: scoreSum, shinies: shinySum });
                }

                if (arcSession.rankBy === 'Score') {
                    roundResults.sort((a, b) => {
                        finassert(a.score !== b.score, {
                            message: 'Draws are not allowed. Replay the match'
                        });
                        return b.score - a.score;
                    });
                } else {
                    roundResults.sort((a, b) => {
                        finassert(a.shinies !== b.shinies && a.score !== b.score, {
                            message: 'Draws are not allowed. Replay the match'
                        });
                        return b.shinies - a.shinies || b.score - a.score;
                    });
                    roundResults.forEach((result) => {
                        result.score = result.shinies;
                    });
                }

                await arcSession.addResults(
                    reply,
                    roundResults,
                    null,
                    method === 'Official'
                );
            }
        });
    }
}
