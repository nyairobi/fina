import { BaseReply } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaCommandInteraction } from 'core/Types';
import { GuildMember } from 'discord.js';
import {
    // ArcContestModifierTypeGroup,
    ArcContestType
} from 'commands/arc/base/Types';
import { ArcSessionManager } from './ArcSession';
import { ArcContestBase } from './ArcContestBase';

export class ArcContest1v1 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;
    private readonly TYPES = {
        // The values are the default numbers of rounds
        1: 10,
        3: 20,
        5: 30,
        7: 40
    };

    public createCommands(): FinaCommandResolvable {
        this.alias = '1v1';
        const contestTypes = Object.keys(this.TYPES);
        const command = new FinaCommandBuilder(this)
            .setName('1v1')
            .setDescription('Initiates a 1v1 contest')
            .addOption({
                name: 'type',
                description: 'The format of the contest',
                type: 'Integer',
                required: true,
                choices: contestTypes.map((rounds) => [
                    `Best-of-${rounds}`,
                    parseInt(rounds)
                ])
            });
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }
        this.addCommonOptions(command, true);

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = interaction.options.getInteger(
            'type',
            true
        ) as keyof typeof this.TYPES;
        const sourceChannel = interaction.channel;

        const chartCount =
            interaction.options.getInteger('chart-count') || this.TYPES[rounds];

        for (let i = 1; i <= this.MAX_CONTESTANTS; ++i) {
            const member = interaction.options.getMember(`contestant${i}`, true);
            if (member instanceof GuildMember) {
                members.push(member);
            }
        }
        const teamMembers = members.map((member) => [member]);

        const session = await ArcSessionManager.create({
            contestType: ArcContestType.Versus,
            chartCount,
            rounds,
            teamMembers,
            sourceChannel,
            command: this,
            ...this.getCommonOptions(interaction)
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContest2v2 extends ArcContestBase {
    private readonly TYPES = {
        // The values are the default numbers of rounds
        1: 10,
        3: 20,
        5: 30,
        7: 40
    };

    public createCommands(): FinaCommandResolvable {
        this.alias = '2v2';
        const contestTypes = Object.keys(this.TYPES);
        const command = new FinaCommandBuilder(this)
            .setName('2v2')
            .setDescription('Initiates a 2v2 contest')
            .addOption({
                name: 'type',
                description: 'The format of the contest',
                type: 'Integer',
                required: true,
                choices: contestTypes.map((rounds) => [
                    `Best-of-${rounds}`,
                    parseInt(rounds)
                ])
            });
        for (let i = 1; i <= 2; ++i) {
            for (let j = 1; j <= 2; ++j) {
                command.addOption({
                    name: `team${i}-contestant${j}`,
                    description: `Contestant #${j} of team #${i}`,
                    type: 'User',
                    required: true
                });
            }
        }
        this.addCommonOptions(command, true);

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const rounds = interaction.options.getInteger(
            'type',
            true
        ) as keyof typeof this.TYPES;

        const sourceChannel = interaction.channel;
        const chartCount =
            interaction.options.getInteger('chart-count') || this.TYPES[rounds];

        const teamMembers = [];
        for (let i = 1; i <= 2; ++i) {
            const members = [];
            for (let j = 1; j <= 2; ++j) {
                const member = interaction.options.getMember(
                    `team${i}-contestant${j}`,
                    true
                );
                if (member instanceof GuildMember) {
                    members.push(member);
                }
            }
            teamMembers.push(members);
        }

        const session = await ArcSessionManager.create({
            contestType: ArcContestType.Versus,
            chartCount,
            rounds,
            teamMembers,
            sourceChannel,
            command: this,
            ...this.getCommonOptions(interaction)
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestGroup extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 4;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'group';
        const command = new FinaCommandBuilder(this)
            .setName('group')
            .setDescription('Initiates a 1v1v1(v1) contest');
        for (let i = 1; i <= this.MAX_CONTESTANTS; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: i <= 3
            });
        }
        command.addOption({
            name: 'length',
            description: 'The number of rounds',
            type: 'Integer',
            required: false,
            choices: [
                ['x1', 1],
                ['x2', 2],
                ['x3', 3]
            ]
        });
        this.addCommonOptions(command, false);

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        for (let i = 1; i <= this.MAX_CONTESTANTS; ++i) {
            const member = interaction.options.getMember(`contestant${i}`);
            if (member instanceof GuildMember) {
                members.push(member);
            }
        }
        const length = interaction.options.getInteger('length') ?? 1;
        const sourceChannel = interaction.channel;
        const rounds = members.length * length;
        const chartCount =
            interaction.options.getInteger('chart-count') ?? Math.min(rounds * 10, 50);
        const teamMembers = members.map((member) => [member]);

        const session = await ArcSessionManager.create({
            contestType: ArcContestType.Group,
            chartCount,
            rounds,
            teamMembers,
            sourceChannel,
            command: this,
            ...this.getCommonOptions(interaction)
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}
