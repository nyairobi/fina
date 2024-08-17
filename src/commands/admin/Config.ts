import { FinaSlashCommand, BaseReply, IModalCommand } from 'core/FinaCommand';
import { Guild } from 'discord.js';
import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaCommandHandler } from 'core/FinaCommandHandler';
import { finassert } from 'core/FinaError';

export class Config extends FinaSlashCommand implements IModalCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.common.admin'];
        this.setFlags('AlwaysEphemeral', 'AdminOnly', 'DelayedInit');
    }

    public async createCommands(
        guild: Guild,
        otherCommands: FinaCommandBuilder[]
    ): Promise<FinaCommandResolvable> {
        const builders = otherCommands.filter((builder) => builder.command.hasConfig());

        this.alias = 'config';
        if (builders.length > 0) {
            return new FinaCommandBuilder(this)
                .setName('config')
                .setDescription(`Configues a command`)
                .addOption(
                    {
                        name: 'command',
                        description: 'The command to configure',
                        type: 'String',
                        required: true
                    },
                    ...builders.map((builder) => [builder.name, builder.command.uid])
                );
        } else {
            return [];
        }
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const uid = interaction.options.getString('command');

        finassert(uid !== null, { message: 'Invalid command', gif: 'dead' });

        const command = FinaCommandHandler.instance.getCommandByUid(uid);

        finassert(command.hasConfig(), {
            message: 'Attempted to configure a command without config',
            gif: 'angry'
        });

        const modal = await command.showConfig(interaction);
        modal.setCustomId(uid);

        await reply({ modal });
    }

    public async processModal(
        reply: BaseReply,
        interaction: FinaModalInteraction
    ): Promise<void> {
        const uid = interaction.customId;

        const command = FinaCommandHandler.instance.getCommandByUid(uid);

        finassert(command.hasConfig(), {
            message: 'Attempted to configure a command without config',
            gif: 'angry'
        });

        await command.processConfig(reply, interaction);
    }
}
