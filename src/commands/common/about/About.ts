import { AutoreplyHandler } from 'core/AutoreplyHandler';
import { FinaSlashCommand, BaseReply, FinaCommand } from 'core/FinaCommand';
import { finassert } from 'core/FinaError';
import { Collection, EmbedFieldData, Guild, MessageEmbed } from 'discord.js';
import { formatDistance } from 'date-fns';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { StringTools } from 'util/StringTools';
import { FinaCommandHandler } from 'core/FinaCommandHandler';
import { TimeTools } from 'util/TimeTools';
import { FinaCommandGroup } from 'core/FinaCommandGroup';

export default class About extends FinaSlashCommand {
    public constructor() {
        super('ninja.nairobi.common.about');
        this.setFlags('AlwaysEphemeral');
    }

    public createCommands(guild: Guild): FinaCommandResolvable {
        const autoreplies = AutoreplyHandler.instance.getGuildAutoreplies(guild.id);
        const options = [process.env.NAME!, 'Commands', 'Data usage'];
        if (autoreplies.length > 0) {
            options.push('Autoreplies');
        }
        return new FinaCommandBuilder(this)
            .setName('about')
            .setDescription(`Displays information about ${process.env.NAME}`)
            .addOption(
                {
                    name: 'topic',
                    description: 'The topic of the about page',
                    type: 'String',
                    required: true
                },
                ...options
            );
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        finassert(interaction.guild !== null, { message: 'Invalid guild' });

        const topic = interaction.options.getString('topic', true);
        const embed = new MessageEmbed().setThumbnail(
            interaction.client.user?.avatarURL() ?? ''
        );
        if (topic === 'Commands') {
            embed
                .setTitle(`Command list for ${interaction.guild.name}`)
                .setDescription('Type `/` to learn more about a command')
                .setFields(this.generateCommandList(interaction));
        } else if (topic === 'Autoreplies') {
            embed
                .setTitle(`Autoreplies in ${interaction.guild.name}`)
                .setFields(this.generateAutoreplyList(interaction));
        } else if (topic === 'Data usage') {
            embed
                .setTitle('Data usage')
                .setFields(this.generateDataUsageList(interaction));
        } else {
            embed
                .setTitle(process.env.NAME || 'Fina')
                .setFooter({
                    text: `Online for: ${formatDistance(
                        TimeTools.launchTime,
                        Date.now()
                    )}`
                })
                .setDescription(process.env.DESCRIPTION!)
                .addField('Author', '<@!114680006105366531>', true)
                .addField('Version', process.env.VERSION!, true)
                .addField('Source code', 'Not now but soon', true)
                // .addField('Invite link', 'TODO add the invite button instead', true)
                // .addField('Website', '[Website](https://nairobi.ninja/fina)', true)
                .addField(
                    'Support server',
                    '[Secret Slammer Society](https://discord.gg/kyt8S9s)',
                    true
                );
        }
        await reply({
            embed
        });
    }

    public generateAutoreplyList(interaction: FinaCommandInteraction) {
        const fields: EmbedFieldData[] = [];
        for (const autoreply of AutoreplyHandler.instance.getGuildAutoreplies(
            interaction.guild.id
        )) {
            fields.push({
                name: autoreply.name || 'Invalid autoreply',
                value: autoreply.description,
                inline: false
            });
        }
        return fields;
    }

    public generateCommandList(interaction: FinaCommandInteraction) {
        const fields: EmbedFieldData[] = [];
        const categories = new Collection<string, FinaCommandBuilder[]>();

        for (const builder of FinaCommandHandler.instance.getGuildCommands(
            interaction.guild
        )) {
            const category = categories.ensure(builder.command.category, () => []);
            category.push(builder);
        }

        for (const [categoryName, categoryCommands] of categories) {
            const list = categoryCommands
                .map(
                    (builder) =>
                        `${builder.type === 'CHAT_INPUT' ? '/' : '🖱️'}${builder.name}`
                )
                .sort()
                .reduce((acc, next) => `${acc}, ${next}`);
            fields.push({
                name: StringTools.capitalize(categoryName),
                value: list,
                inline: false
            });
        }
        return fields;
    }

    private generateDataUsageList(interaction: FinaCommandInteraction) {
        const fields: EmbedFieldData[] = [];

        for (const { name, command } of FinaCommandHandler.instance.getGuildCommands(
            interaction.guild
        )) {
            let requiresTerms = command.hasFlag('RequiresTerms');
            const searchSubcommands = (command: FinaCommandGroup) => {
                for (const subcommand of command.subcommands) {
                    if (requiresTerms) {
                        break;
                    }
                    if (subcommand instanceof FinaCommandGroup) {
                        searchSubcommands(subcommand);
                    } else {
                        requiresTerms = subcommand.hasFlag('RequiresTerms');
                    }
                }
            };
            if (command instanceof FinaCommandGroup) {
                searchSubcommands(command);
            }
            if (requiresTerms) {
                fields.push({
                    name,
                    value: command.dataUsageDescription
                });
            }
        }
        if (fields.length === 0) {
            fields.push({
                name: 'None',
                value: 'No command in this server stores any data'
            });
        }

        return fields;
    }
}
