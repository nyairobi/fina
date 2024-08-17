import Database, { DbArcChartOwnership } from 'core/Database';
import { FinaSlashCommand, BaseReply, IModalCommand } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaError, finassert } from 'core/FinaError';
import { FinaCommandInteraction, FinaModalInteraction, UserId } from 'core/Types';
import { MessageActionRow, TextInputComponent, Modal } from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';
import { ArcCommon } from '../base/ArcCommon';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

export class ArcSync extends FinaSlashCommand implements IModalCommand {
    public constructor(uid: string) {
        super(uid);
        this.setFlags('RequiresTerms', 'AlwaysEphemeral');
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'sync';
        return new FinaCommandBuilder(this)
            .setName('sync')
            .setDescription('Registers or syncs your Arcaea account')
            .addOption({
                name: 'sync-type',
                description: 'The data to sync',
                type: 'Integer',
                required: true,
                choices: [
                    ['Account info', -1],
                    ['Past charts', 0],
                    ['Present charts', 1],
                    ['Future/Beyond charts', 2],
                    ['Reset', -2]
                ]
            });
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const userId = interaction.user.id;
        const syncType = interaction.options.getInteger('sync-type', true);
        const dbArcUser = await Database.arcUser.findUnique({
            where: {
                userId: interaction.user.id
            }
        });

        if (dbArcUser === null) {
            finassert(syncType !== -2, {
                message: 'You do not have an Arcaea account set up',
                gif: 'dead'
            });
            finassert(syncType === -1, {
                message:
                    'You have to sync your account at least once before syncing your chart list',
                gif: 'angry'
            });
            const rows = [
                new MessageActionRow<TextInputComponent>().addComponents(
                    new TextInputComponent()
                        .setCustomId('arcid')
                        .setMinLength(9)
                        .setMaxLength(9)
                        .setLabel('Arcaea friend code')
                        .setStyle(TextInputStyles.SHORT)
                        .setRequired(true)
                )
            ];
            const modal = new Modal()
                .setCustomId('name-prompt')
                .setTitle('Arcaea usercode')
                .addComponents(...rows);

            await reply({ modal });
        } else {
            if (syncType === -1) {
                await reply(await this.syncAccountInfo(userId, `${dbArcUser.arcId}`));
            } else if (syncType === -2) {
                await reply(await this.deleteAccountInfo(userId));
            } else {
                if (process.env.CHARON_DISABLE_SYNC === '1') {
                    await reply({
                        content:
                            'Sync is currently unavailable. Use `/arc edit pack` in the meantime'
                    });
                } else {
                    await reply(
                        await this.syncCharts(userId, `${dbArcUser.arcId}`, syncType)
                    );
                }
            }
        }
    }

    public async processModal(
        reply: BaseReply,
        interaction: FinaModalInteraction
    ): Promise<void> {
        await this.nameModal(reply, interaction);
    }

    private async syncCharts(
        userId: UserId,
        arcId: string,
        difficulty: number
    ): Promise<FinaReplyOptions> {
        try {
            const rawData = (await ArcCommon.query(
                '/user/owned',
                { usercode: arcId, difficulty },
                'LOCAL'
            )) as any;
            const data = rawData.content.ownerships as {
                song_id: string;
                difficulty: number;
            }[];
            const dbPayload: DbArcChartOwnership[] = [];

            for (const item of data) {
                dbPayload.push({
                    userId,
                    apiName: item.song_id,
                    tier: item.difficulty
                });
            }

            await Database.arcChartOwnership.deleteMany({
                where: {
                    userId,
                    tier: difficulty
                }
            });

            if (difficulty === 2) {
                await Database.arcChartOwnership.deleteMany({
                    where: {
                        userId,
                        tier: 3
                    }
                });
            }

            await Database.arcChartOwnership.createMany({
                data: dbPayload,
                skipDuplicates: true
            });
        } catch (error: unknown) {
            throw new FinaError({
                message: 'Unable to query BotArcApi. Try again later',
                details:
                    error instanceof Error || typeof error === 'string'
                        ? error
                        : undefined,
                gif: 'dead'
            });
        }

        const dbOwnerships = await Database.arcChartOwnership.groupBy({
            by: ['tier'],
            where: {
                userId
            },
            _count: true
        });

        const pstCount =
            dbOwnerships.find((aggregate) => aggregate.tier === 0)?._count ?? 0;
        const prsCount =
            dbOwnerships.find((aggregate) => aggregate.tier === 1)?._count ?? 0;
        const ftrCount =
            dbOwnerships.find((aggregate) => aggregate.tier === 2)?._count ?? 0;
        const bydCount =
            dbOwnerships.find((aggregate) => aggregate.tier === 3)?._count ?? 0;

        return {
            title: 'Charts synchronized',
            fields: [
                {
                    name: 'Past charts',
                    value: `${pstCount}`
                },
                {
                    name: 'Present charts',
                    value: `${prsCount}`,
                    inline: true
                },
                {
                    name: 'Future charts',
                    value: `${ftrCount}`
                },
                {
                    name: 'Beyond charts',
                    value: `${bydCount}`,
                    inline: true
                }
            ],
            footer: {
                text: 'Powered by BotArcApi'
            },
            ephemeral: true
        };
    }

    private async fetchAccountInfo(userId: UserId, arcId: string) {
        const rawData = await ArcCommon.query(
            '/user/info',
            {
                usercode: arcId
            },
            'GLOBAL'
        );

        finassert(rawData.status !== -3, {
            message: `User ${arcId} does not exist`,
            gif: 'angry'
        });

        finassert(rawData.status === 0 && 'content' in rawData, {
            message: 'Unable to fetch user data',
            details: JSON.stringify(rawData, null, 4)
        });

        const accountInfo = rawData.content.account_info;

        const data = {
            userId,
            arcId: parseInt(arcId),
            arcName: accountInfo.name,
            ptt: accountInfo.rating / 100.0
        };

        return data;
    }

    private async fetchB30(arcId: string): Promise<number> {
        const rawData = await ArcCommon.b30616(arcId);

        finassert(ArcCommon.isValid616B30Response(rawData), {
            message:
                'Unable to query the official Arcaea Api. Try again later or use a different method',
            details: `${arcId} ${JSON.stringify(rawData)}`
        });

        const bestScores = rawData.data;
        let scoreSum = 0.0;
        for (const score of bestScores) {
            scoreSum += score.potential_value;
        }

        return scoreSum / 30.0;

        // const rawData = await ArcCommon.query(
        //     '/user/best30',
        //     {
        //         usercode: arcId
        //     },
        //     'GLOBAL'
        // );

        // finassert(ArcCommon.isValidResponse(rawData) && 'best30_avg' in rawData.content, {
        //     message: 'Unable to query best30',
        //     details: `${rawData}`,
        //     gif: 'angry'
        // });

        // return (rawData.content as any).best30_avg;
    }

    private async syncAccountInfo(
        userId: UserId,
        arcId: string
    ): Promise<FinaReplyOptions> {
        const data = {
            ...(await this.fetchAccountInfo(userId, arcId)),
            b30: await this.fetchB30(arcId),
            timestamp: new Date()
        };

        if (data.ptt < 0) {
            data.ptt = data.b30;
        }

        await Database.arcUser.upsert({
            where: {
                userId: data.userId
            },
            create: data,
            update: data
        });

        return {
            title: 'Profile updated',
            footer: {
                text: 'Powered by BotArcApi'
            },
            fields: [
                { name: 'Friend code', value: `${data.arcId}`, inline: true },
                { name: 'Username', value: data.arcName, inline: true },
                {
                    name: 'Potential',
                    value: `${data.ptt.toFixed(2)}`,
                    inline: false
                },
                { name: 'Best 30', value: `${data.b30?.toFixed(2)}`, inline: true }
            ],
            ephemeral: true
        };
    }

    private async deleteAccountInfo(userId: UserId): Promise<FinaReplyOptions> {
        try {
            const result = await Database.arcUser.delete({
                where: {
                    userId
                },
                select: {
                    arcId: true,
                    ownerships: true
                }
            });

            return {
                title: 'Profile deleted',
                content: `Deleted user ${result.arcId} and ${result.ownerships.length} records`,
                ephemeral: true
            };
        } catch (error: unknown) {
            return {
                title: 'Delete failed',
                content: `You don't have any Arcaea account data`,
                ephemeral: true
            };
        }
    }

    private async nameModal(reply: BaseReply, interaction: FinaModalInteraction) {
        const userId = interaction.user.id;
        const arcId = interaction.components.find(
            (row) => row.components[0].customId === 'arcid'
        )?.components[0].value;

        const placeholderPttStr = interaction.components.find(
            (row) => row.components[0].customId === 'ptt'
        )?.components[0].value;

        finassert(arcId !== undefined, { message: 'Invalid user code' });

        await reply(await this.syncAccountInfo(userId, arcId));
    }
}
