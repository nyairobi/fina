import Database from 'core/Database';
import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { finassert } from 'core/FinaError';
import { FinaCommandInteraction } from 'core/Types';
import { GuildMember, ThreadChannel, ThreadMember } from 'discord.js';
import Tools from 'util/Tools';
import {
    ArcContestColorModifierType,
    ArcContestColorModifierTypeCommon,
    ArcContestDifficultyModifierType
} from 'commands/arc/base/Types';
import { ArcRendererCard } from '../base/ArcRenderer';
import { ArcCommon } from '../base/ArcCommon';

export class ArcRoll extends FinaSlashCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.arc.roll'];
        this.setFlags('RequiresTerms');
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'roll';
        const command = new FinaCommandBuilder(this)
            .setName('roll')
            .setDescription('Picks a random song');

        for (const option of ArcCommon.getCommonDifficultyOptions()) {
            command.addOption(option);
        }
        command.addOption(
            {
                name: 'count',
                type: 'Integer',
                description: 'The number of charts (default: 1)',
                required: false
            },
            ...[1, 2, 3, 4, 5]
        );

        for (const option of ArcCommon.getCommonModifierOptions(false)) {
            command.addOption(option);
        }

        command.addOption({
            name: 'hidden',
            type: 'Boolean',
            description:
                'Whether to send this message privately (default: true outside of threads)',
            required: false
        });

        return command;
    }

    private ccToDifficulty(cc: number) {
        const diff = `${Math.floor(cc / 10.0)}`;
        if (cc > 90 && cc % 10 >= 7) {
            return `${diff}⁺`;
        } else {
            return diff;
        }
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        let minDifficulty = interaction.options.getNumber('min-difficulty') ?? 80;
        const maxDifficulty = interaction.options.getNumber('max-difficulty') ?? 126;
        const count = interaction.options.getInteger('count') ?? 1;
        const difficultyModifier = (interaction.options.getString(
            'difficulty-modifier'
        ) ?? ArcContestDifficultyModifierType.All) as ArcContestDifficultyModifierType;
        const colorModifier = (interaction.options.getString('side-modifier') ??
            ArcContestColorModifierTypeCommon.None) as ArcContestColorModifierType;
        const hidden =
            interaction.options.getBoolean('hidden') ??
            !(interaction.channel instanceof ThreadChannel);
        const userId = interaction.user.id;
        const targetMembers: (GuildMember | ThreadMember)[] = [];

        if (minDifficulty > maxDifficulty) {
            minDifficulty = 10;
        }

        if (interaction.channel instanceof ThreadChannel) {
            const threadMembers = await interaction.channel.members.fetch(true);
            targetMembers.push(
                ...Array.from(threadMembers.values()).filter(
                    (member) => member.id !== interaction.client.user?.id
                )
            );
        } else {
            const dbArcUser = await Database.arcUser.findUnique({
                where: {
                    userId
                },
                include: {
                    ownerships: true
                }
            });

            finassert(dbArcUser !== null, {
                message: 'You have not connected an Arcaea profile. Use `/arc sync`'
            });

            finassert(dbArcUser.ownerships.length > 0, {
                message: 'You have not synced your charts. Use `/arc sync`'
            });

            targetMembers.push(interaction.member);
        }

        const dbCharts = await ArcCommon.getCommonCharts(
            targetMembers,
            minDifficulty,
            maxDifficulty,
            difficultyModifier,
            colorModifier
        );

        finassert(dbCharts.length > 0, {
            message: 'Insufficient number of charts in this difficulty range'
        });

        Tools.shuffle(dbCharts);

        const [attachment] = await ArcRendererCard.render(
            dbCharts.slice(0, count).map((dbChart) => {
                return { ...dbChart, status: 'ready' };
            }),
            Math.min(count, dbCharts.length)
        );

        const minDifficultyStr = this.ccToDifficulty(minDifficulty);
        const maxDifficultyStr = this.ccToDifficulty(maxDifficulty);

        let difficultyInfo = minDifficultyStr;
        if (minDifficultyStr !== maxDifficultyStr) {
            difficultyInfo += ` ~ ${maxDifficultyStr}`;
        }

        await reply({
            title: `Random chart${count > 1 ? 's' : ''} (${difficultyInfo})`,
            files: [attachment],
            image: { url: `attachment://${attachment.name}` },
            ephemeral: hidden
        });
    }
}
