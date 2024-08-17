import { BaseReply } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { FinaCommandInteraction } from 'core/Types';
import { GuildMember } from 'discord.js';
import {
    ArcContestType,
    ArcContestBanPhaseType,
    ArcContestColorModifierTypeDuel,
    ArcContestDifficultyModifierType,
    ArcContestColorModifierTypeCommon
} from 'commands/arc/base/Types';
import { ArcContestBase } from './ArcContestBase';
import { ArcSessionManager } from './ArcSession';

//
// Light & Conflict (Swiss)
//

export class ArcContestCustomLNCR1 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round1';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round1')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 3;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 80,
            maxDifficulty: 96,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Light
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestCustomLNCR2 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round2';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round2')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 3;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 80,
            maxDifficulty: 96,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Dark
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestCustomLNCR3 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round3';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round3')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 3;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 90,
            maxDifficulty: 99,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Light
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestCustomLNCR4 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round4';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round4')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 3;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 90,
            maxDifficulty: 99,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Dark
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestCustomLNCR5 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round5';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round5')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 5;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 97,
            maxDifficulty: 106,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Light
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestCustomLNCR6 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-round6';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-round6')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 5;
        const sourceChannel = interaction.channel;
        const chartCount = 10;

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
            minDifficulty: 97,
            maxDifficulty: 106,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.FirstPhase,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeCommon.Dark
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestLightAndConflict extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict')
            .setDescription('Initiates a round of Light & Conflict');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 5;
        const sourceChannel = interaction.channel;
        const chartCount = 20;

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
            minDifficulty: 97,
            maxDifficulty: 120,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.Normal,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeDuel.LightAndConflict
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

//
// Light & Conflict R (Round Robin)
//
export class ArcContestLightAndConflictR3 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-r';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-r')
            .setDescription('Initiates a round of Light & Conflict R');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 3;
        const sourceChannel = interaction.channel;
        const chartCount = 20;

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
            minDifficulty: 90,
            maxDifficulty: 120,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.Normal,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeDuel.LightAndConflictReverse
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}

export class ArcContestLightAndConflictR5 extends ArcContestBase {
    private readonly MAX_CONTESTANTS = 2;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'light-and-conflict-r';
        const command = new FinaCommandBuilder(this)
            .setName('light-and-conflict-r')
            .setDescription('Initiates a round of Light & Conflict R');
        for (let i = 1; i <= 2; ++i) {
            command.addOption({
                name: `contestant${i}`,
                description: `Contestant #${i}`,
                type: 'User',
                required: true
            });
        }

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const members: GuildMember[] = [];
        const rounds = 5;
        const sourceChannel = interaction.channel;
        const chartCount = 30;

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
            minDifficulty: 90,
            maxDifficulty: 120,
            orderBy: 'Random',
            rankBy: 'Score',
            banPhase: ArcContestBanPhaseType.Normal,
            difficultyModifier: ArcContestDifficultyModifierType.FutureBeyond,
            colorModifier: ArcContestColorModifierTypeDuel.LightAndConflictReverse
        });

        await reply({
            title: 'Session created',
            content: `<#${session.thread.id}>`,
            ephemeral: true
        });
    }
}
