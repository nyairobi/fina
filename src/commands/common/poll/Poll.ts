import { BaseReply, IConfigCommand } from 'core/FinaCommand';
import { FinaError, finassert } from 'core/FinaError';
import { MessageActionRow, Modal, TextChannel, TextInputComponent } from 'discord.js';
import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
import { FinaCommandGroup } from 'core/FinaCommandGroup';
import Database from 'core/Database';
import { DiscordTools } from 'util/DiscordTools';
import { SharpCommon } from 'util/SharpCommon';
import sharp from 'sharp';
import { PollClose } from './PollClose';
// import { PollStart } from './PollStart';

export default class Poll extends FinaCommandGroup implements IConfigCommand {
    public constructor() {
        super('ninja.nairobi.common.poll');
        this.name = 'poll';
        // this.addSubcommand(PollStart);
        this.addSubcommand(PollClose);
    }

    public async showConfig(interaction: FinaCommandInteraction): Promise<Modal> {
        const textInput = new TextInputComponent()
            .setCustomId('poll-channel-id')
            .setStyle('SHORT')
            .setPlaceholder('123456789012345678')
            .setLabel('Channel ID')
            .setRequired(true);
        return new Modal()
            .setComponents(
                new MessageActionRow<TextInputComponent>().addComponents(textInput)
            )
            .setTitle('Enter poll channel ID');
    }

    public async processConfig(
        reply: BaseReply,
        interaction: FinaModalInteraction
    ): Promise<void> {
        const guildId = interaction.guild.id;
        const channelId = interaction.components[0].components[0].value;

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => {
            throw new FinaError({
                message: `Invalid channel. Right click on the channel and copy its ID.
                    You might need to enable developer mode in Settings->Advanced
                    (Still waiting for Discord to add proper channel selection to forms; sorry!)`,
                gif: 'dead'
            });
        });

        finassert(channel instanceof TextChannel, {
            message: 'The channel must be a text channel',
            gif: 'angry'
        });

        const webhookName = 'Fina polls';
        let webhook = await DiscordTools.getWebhook(channel, webhookName);

        if (webhook === null) {
            // Convert to png because it sometimes outputs webp which doesn't work??
            const pngAvatar = await sharp(
                await SharpCommon.fetchImage(
                    interaction.client.user?.displayAvatarURL() ?? ''
                )
            )
                .png()
                .toBuffer();

            webhook = await channel
                .createWebhook(webhookName, {
                    // avatar: jpegAvatar,
                    reason: 'Uploads polls to this channel'
                })
                .catch(FinaError.permission('Manage Webhooks', true));

            // For some reason it doesn't work in createWebhook
            await webhook.edit({ avatar: pngAvatar });
        }

        await Database.serverInfo.upsert({
            where: {
                serverId: guildId
            },
            update: {
                pollChId: channelId
            },
            create: {
                serverId: guildId,
                pollChId: channelId
            }
        });

        await reply({
            title: 'Poll channel updated',
            content: `The poll channel has been set to <#${channel.id}>`
        });
    }
}
