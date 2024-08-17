import { ArcChartOwnership } from '@prisma/client';
import Database from 'core/Database';
import {
    FinaSlashCommand,
    IMenuCommand,
    BaseReply,
    IAutocompleteCommand
} from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaCommandGroup } from 'core/FinaCommandGroup';
import { finassert } from 'core/FinaError';
import { UserId, FinaCommandInteraction, FinaMenuInteraction } from 'core/Types';
import {
    MessageSelectMenu,
    MessageActionRow,
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    CacheType
} from 'discord.js';
import Tools from 'util/Tools';
import { ArcSession } from '../contest/ArcSession';

//ARC EDIT PACK
// private createPackList(dbPacks: DbArcPack[], customId: string) {
//     const menu = new MessageSelectMenu()
//         .setCustomId(customId)
//         .setMinValues(1)
//         .setMaxValues(dbPacks.length);

//     for (const dbPack of dbPacks) {
//         menu.addOptions({
//             label: dbPack.packName,
//             value: dbPack.packName
//         });
//     }

//     return new MessageActionRow().addComponents(menu);
// }

// public async processMenu(
//     reply: BaseReply,
//     interaction: FinaMenuInteraction
// ): Promise<void> {
//     for (const packName of interaction.values) {
//         const dbArcCharts = await Database.arcChart.findMany({
//             where: {
//                 packName: {
//                     startsWith: packName
//                 }
//             }
//         });

//         await Database.arcChartOwnership.createMany({
//             data: dbArcCharts.map((dbArcChart) => {
//                 return {
//                     userId: interaction.user.id,
//                     name: dbArcChart.name,
//                     tier: dbArcChart.tier
//                 };
//             }),
//             skipDuplicates: true
//         });
//     }

//     await reply({
//         title: 'Packs registered',
//         content: `If you don't have individual charts (e.g. BYD, pack appends, MA),
//             you can toggle them using \`/arc edit\``,
//         ephemeral: true
//     });
// }

export class ArcEdit extends FinaCommandGroup {
    public constructor(uid: string) {
        super(uid);
        this.name = 'edit';
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];

        this.setFlags('RequiresTerms', 'AlwaysEphemeral');
        this.addSubcommand(ArcEditPack);
    }
}

// TODO TEMPORARY
// const dbPacks = (
//     await Database.arcPack.findMany({
//         orderBy: {
//             packName: 'asc'
//         }
//     })
// )
//     .filter(
//         (dbPack) =>
//             dbPack.packName.indexOf('-') < 0 || dbPack.packName.indexOf('A-D') > 0
//     )
//     .map((dbPack) => {
//         if (dbPack.packName.indexOf('A-D') > 0) {
//             dbPack.packName = dbPack.packName.slice(0, -6);
//         }
//         return dbPack;
//     });
// const dbPackChunks = Tools.splitArrayIntoChunks(dbPacks, 25);

// const rows = dbPackChunks.map((dbPacks) =>
//     this.createPackList(dbPacks, 'songpack-select')
// );

// await reply({
//     content: 'Select the song packs you own',
//     forceRaw: true,
//     components: rows,
//     ephemeral: true
// });

export class ArcEditPack
    extends FinaSlashCommand
    implements IMenuCommand, IAutocompleteCommand
{
    public constructor(uid: string) {
        super(uid);
        this.setFlags('RequiresTerms', 'AlwaysEphemeral');
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'pack';

        return new FinaCommandBuilder(this)
            .setName('pack')
            .setDescription('Edits your chart list')
            .addOption({
                name: 'pack',
                description: 'The song pack to edit',
                type: 'String',
                required: true,
                autocomplete: true
            })
            .addOption({
                name: 'difficulty',
                description: 'The difficulty',
                type: 'Integer',
                required: true,
                choices: [
                    ['Past', 0],
                    ['Present', 1],
                    ['Future/Beyond', 2]
                ]
            });
    }

    private async createSongLists(packName: string, userId: UserId, targetTier: number) {
        const dbPackCharts = await Database.arcChart.findMany({
            where: {
                packName,
                OR: [targetTier === 2 ? { tier: { gte: 2 } } : { tier: targetTier }]
            },
            orderBy: [{ name: 'asc' }, { apiName: 'asc' }]
        });

        finassert(dbPackCharts.length > 0, { message: 'Invalid song pack', gif: 'dead' });

        const dbOwnedCharts = await Database.arcChartOwnership.findMany({
            where: {
                userId,
                chart: {
                    packName
                }
            }
        });

        const packCharts = dbPackCharts.map((dbPackChart) => {
            return {
                ...dbPackChart,
                owned: dbOwnedCharts.some(
                    (dbOwnership) =>
                        dbOwnership.apiName === dbPackChart.apiName &&
                        dbOwnership.tier === dbPackChart.tier
                )
            };
        });

        packCharts.sort((a, b) => a.name.localeCompare(b.name) || a.tier - b.tier);

        const packChartSlices = Tools.splitArrayIntoChunks(packCharts, 25);

        const rows: MessageActionRow[] = [];
        packChartSlices.forEach((charts, idx) => {
            const menu = new MessageSelectMenu()
                .setCustomId(`${packName}/${idx}/${targetTier}`)
                .setMinValues(0)
                .setMaxValues(charts.length)
                .setPlaceholder('Select your charts');

            for (const chart of charts) {
                menu.addOptions({
                    label: chart.name,
                    value: `${chart.apiName}/${chart.tier}`,
                    description: ArcSession.difficultyString(chart.tier),
                    default: chart.owned
                });
            }
            rows.push(new MessageActionRow().addComponents(menu));
        });

        return rows;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const packName = interaction.options.getString('pack', true);
        const tier = interaction.options.getInteger('difficulty', true);

        const components = await this.createSongLists(
            packName,
            interaction.user.id,
            tier
        );

        await reply({
            content: '\u200b',
            forceRaw: true,
            components,
            ephemeral: true
        });
    }

    public async processMenu(
        reply: BaseReply,
        interaction: FinaMenuInteraction
    ): Promise<void> {
        const userId = interaction.user.id;
        const [packName, rawIndex, rawTargetTier] = interaction.customId.split('/');
        const index = parseInt(rawIndex);
        const targetTier = parseInt(rawTargetTier);

        const currentSublist = await Database.arcChart.findMany({
            where: {
                packName,
                OR: [targetTier === 2 ? { tier: { gte: 2 } } : { tier: targetTier }]
            },
            orderBy: [{ name: 'asc' }, { apiName: 'asc' }],
            skip: index * 25,
            take: 25
        });
        const newSongs: ArcChartOwnership[] = interaction.values.map((str) => {
            const [apiName, rawTier] = str.split('/');
            return {
                apiName,
                tier: parseInt(rawTier),
                userId
            };
        });

        await Database.arcChartOwnership.deleteMany({
            where: {
                OR: currentSublist.map((chart) => {
                    return {
                        apiName: chart.apiName,
                        tier: chart.tier,
                        userId
                    };
                })
            }
        });
        await Database.arcChartOwnership.createMany({
            data: newSongs
        });

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

        await reply({
            title: 'Charts "synchronized"',
            content: `Past charts: **${pstCount}**
            Present charts: **${prsCount}**
            Future charts: **${ftrCount}**
            Beyond charts: **${bydCount}**`,
            ephemeral: true
        });
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction<CacheType>
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        const input = interaction.options.getFocused().toString().toLowerCase();

        const dbPacks = (
            await Database.arcPack.findMany({
                orderBy: {
                    packName: 'asc'
                }
            })
        ).filter((dbPack) => dbPack.packName.toLowerCase().indexOf(input) >= 0);

        return dbPacks.map((songPack) => {
            return {
                name: songPack.packName,
                value: songPack.packName
            };
        });
    }
}
