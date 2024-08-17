import { FinaSlashCommand, BaseReply, IModalCommand } from 'core/FinaCommand';
import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import {
    EmbedFieldData,
    MessageActionRow,
    Modal,
    TextChannel,
    TextInputComponent
} from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';
import { FinaError, finassert } from 'core/FinaError';
import { DiscordTools } from 'util/DiscordTools';

export default class Embed extends FinaSlashCommand implements IModalCommand {
    public constructor() {
        super('ninja.nairobi.misc.embed');
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('embed')
            .setDescription('Sends an embed.');
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const title = new MessageActionRow<TextInputComponent>().addComponents(
            new TextInputComponent()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyles.SHORT)
        );
        const description = new MessageActionRow<TextInputComponent>().addComponents(
            new TextInputComponent()
                .setCustomId('description')
                .setLabel('Text content')
                .setStyle(TextInputStyles.PARAGRAPH)
                .setMaxLength(4000)
        );
        const modal = new Modal()
            .setTitle('Embed creator')
            .addComponents(title, description);
        await reply({ modal });
    }

    public async processModal(reply: BaseReply, interaction: FinaModalInteraction) {
        const textInputs = interaction.components.map((row) => row.components[0]);
        const title = textInputs[0];
        const description = textInputs[1];
        const member = interaction.member;

        const fields: EmbedFieldData[] = [];

        let content = '';
        let currentField: EmbedFieldData | null = null;
        for (const line of description.value.split('\n')) {
            if (line.startsWith('==')) {
                if (currentField !== null) {
                    fields.push(currentField);
                }
                const name = line.substring(2, line.indexOf('==', 2)).trim();
                currentField = { name, value: '' };
            } else {
                if (currentField === null) {
                    content += `${line}\n`;
                } else {
                    currentField.value += `${line}\n`;
                }
            }
        }
        if (currentField !== null) {
            fields.push(currentField);
        }
        const repl = DiscordTools.makeEmbed({
            title: title.value,
            content,
            fields
        });
        if (interaction.channel instanceof TextChannel) {
            const webhook = await this.getWebhook(interaction.channel);
            await webhook.send({
                ...repl,
                username: `${member.nickname || member.user.username}`,
                avatarURL: member.displayAvatarURL() || member.user.displayAvatarURL()
            });
        } else {
            await interaction.channel.send(repl);
        }

        await reply({ content: 'Sent', ephemeral: true });
    }

    public async getWebhook(channel: TextChannel) {
        const webhooks = await channel
            .fetchWebhooks()
            .catch(FinaError.permission('Manage webhooks', true));
        let webhook = webhooks.find((webhook) => webhook.name === 'Fina-Embedder');
        if (webhook === undefined) {
            webhook = await channel.createWebhook('Fina-Embedder');
            await webhook.edit({
                avatar: channel.guild.iconURL()
            });
        }
        return webhook;
    }
}
