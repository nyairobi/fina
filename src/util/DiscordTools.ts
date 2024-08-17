import { Mutex } from 'async-mutex';
import Database from 'core/Database';
import { BaseReply, FinaCommand, FinaReplyOptionsType } from 'core/FinaCommand';
import { FinaError, finassert, finassertMessage } from 'core/FinaError';
import {
    FinaEditOptions,
    FinaReplyOptions,
    FinaSendOptions
} from 'core/FinaReplyOptions';
import { Logger } from 'core/Logger';
import {
    FinaButtonInteraction,
    FinaCommandInteraction,
    FinaContextMessageInteraction,
    FinaContextUserInteraction,
    FinaInteractionComplement,
    FinaMenuInteraction,
    FinaModalInteraction,
    GuildId
} from 'core/Types';
import { APIEmbed, APIMessage } from 'discord-api-types/v9';
import {
    MessageEmbed,
    HexColorString,
    GuildMember,
    Client,
    Message,
    Interaction,
    CommandInteraction,
    ButtonInteraction,
    UserContextMenuInteraction,
    MessageContextMenuInteraction,
    MessageComponentInteraction,
    SelectMenuInteraction,
    TextChannel,
    ThreadChannel,
    BaseCommandInteraction,
    ModalSubmitInteraction,
    AnyChannel
} from 'discord.js';
import sharp from 'sharp';
import { StringTools } from './StringTools';
import { Fina } from 'core/Fina';

export class DiscordTools {
    public static printPanic(error: unknown): FinaReplyOptions {
        /* Only log on the highest loglevel if it's a FinaError without details */
        if (!(error instanceof FinaError) || error.details !== undefined) {
            Logger.error(error);
        } else {
            Logger.debugError(error);
        }

        const convertedError = FinaError.from(error);

        /* Print embed */
        return {
            title: 'Error 💀',
            content: convertedError.replyMessage,
            color: 'RED',
            image: { url: convertedError.gif },
            ephemeral: true
        };
    }

    public static async getWebhook(channel: TextChannel, name?: string) {
        const webhooks = await channel
            .fetchWebhooks()
            .catch(FinaError.permission('Manage Webhooks', true));
        return (
            webhooks
                .filter((wh) => wh.owner?.id === channel.client.user?.id)
                .filter((wh) => (name !== undefined ? wh.name === name : true))
                .first() ?? null
        );
    }

    public static makeEmbed<T extends FinaReplyOptions>(repl: T): FinaReplyOptions {
        const embed = repl.embed || new MessageEmbed(repl);
        embed
            .setTitle(embed.title || repl.title || '')
            .setDescription(embed.description || repl.content || repl.description || ' ')
            .setColor(
                embed.color || repl.color || (process.env.BASE_COLOR as HexColorString)
            );

        if (embed.thumbnail !== null) {
            embed.thumbnail.url = StringTools.validateURL(embed.thumbnail.url);
        }

        return {
            ...repl,
            content: ' ',
            embed: undefined,
            embeds: [embed]
        };
    }

    public static formatUsername(member: GuildMember, skipTag?: boolean) {
        if (member.nickname !== null) {
            const nickname = member.nickname;
            if (skipTag) {
                return nickname;
            } else {
                return `${nickname} (${member.user.tag})`;
            }
        } else {
            return member.user.tag;
        }
    }

    public static async getListOfPostChannels(guildId: GuildId, client: Client) {
        const dbPostChannels = await Database.postChannel.findMany({
            where: {
                serverId: guildId
            }
        });

        let choices: string[][] = [];

        for (const dbPostChannel of dbPostChannels) {
            // const channel = await client.channels.fetch(dbPostChannel.channelId);
            // if (channel !== null && channel instanceof GuildChannel) {
            choices.push([`${dbPostChannel.title}`, dbPostChannel.channelId]);
            // }
        }

        return choices;
    }

    public static async getAvatar(member: GuildMember) {
        const response = await fetch(
            member.displayAvatarURL() || member.user.displayAvatarURL()
        );
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return await sharp(buffer).jpeg().toBuffer();
    }

    private static verifyInteraction<T extends Interaction>(
        interaction: T
    ): asserts interaction is T & FinaInteractionComplement {
        finassert(
            interaction.guild !== null &&
                (interaction.channel instanceof TextChannel ||
                    interaction.channel instanceof ThreadChannel) &&
                interaction.member !== null,
            {
                message: 'Invalid interaction channel'
            }
        );
    }

    public static validateInteractionSlash(
        interaction: CommandInteraction,
        hint: string | undefined
    ): asserts interaction is FinaCommandInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
    }

    public static validateInteractionButton(
        interaction: ButtonInteraction,
        hint: string | undefined
    ): asserts interaction is FinaButtonInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
        finassertMessage(interaction.message);
    }

    public static validateInteractionMenu(
        interaction: SelectMenuInteraction,
        hint: string | undefined
    ): asserts interaction is FinaMenuInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
        finassertMessage(interaction.message);
    }

    public static validateInteractionContextUser(
        interaction: UserContextMenuInteraction,
        hint: string | undefined
    ): asserts interaction is FinaContextUserInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
        finassert(interaction.targetMember instanceof GuildMember, {
            details: 'Invalid target member'
        });
    }

    public static validateInteractionContextMessage(
        interaction: MessageContextMenuInteraction,
        hint: string | undefined
    ): asserts interaction is FinaContextMessageInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
        finassert(interaction.targetMessage instanceof Message, {
            details: 'Invalid target message'
        });
    }

    public static validateInteractionModal(
        interaction: ModalSubmitInteraction,
        hint: string | undefined
    ): asserts interaction is FinaModalInteraction {
        this.verifyInteraction(interaction);
        interaction.hint = hint;
    }

    private static checkChannelPermission(channel: AnyChannel | null) {
        if (channel instanceof TextChannel) {
            finassert(
                channel.permissionsFor(channel.client.user!)?.has('SEND_MESSAGES') ??
                    false,
                {
                    message: 'I do not have write permissions in this channel',
                    gif: 'permissions'
                }
            );
        } else if (channel instanceof ThreadChannel) {
            finassert(
                channel
                    .permissionsFor(channel.client.user!)
                    ?.has('SEND_MESSAGES_IN_THREADS') ?? false,
                {
                    message: 'I do not have write permissions in this thread',
                    gif: 'permissions'
                }
            );
        }
    }

    private static registerComponents(
        replyOptions: FinaReplyOptions,
        command: FinaCommand
    ) {
        let shouldRegisterComponents = false;
        if (replyOptions.components !== undefined && replyOptions.components.length > 0) {
            replyOptions.fetchReply = true;
            shouldRegisterComponents = true;
        }

        if (shouldRegisterComponents) {
            for (const row of replyOptions.components ?? []) {
                for (const component of row.components) {
                    if ('customId' in component) {
                        component.customId = `${command.uid}:${component.customId}`;
                    }
                }
            }
        }
    }

    public static formatReply(replyOptions: FinaReplyOptions) {
        return replyOptions.forceRaw || replyOptions.modal !== undefined
            ? replyOptions
            : DiscordTools.makeEmbed(replyOptions);
    }

    private static async fetchChannel(options: FinaSendOptions) {
        if ('channel' in options) {
            return options.channel;
        } else {
            const channel = await Fina.client.channels.fetch(options.channelId);
            finassert(
                channel instanceof TextChannel || channel instanceof ThreadChannel,
                { message: 'Invalid channel' }
            );
            return channel;
        }
    }

    public static async sendMessage(
        command: FinaCommand | null,
        options: FinaSendOptions
    ) {
        const channel = await this.fetchChannel(options);
        const webhook = options.webhookOptions?.webhook;

        this.checkChannelPermission(channel);

        if (options.components !== undefined && options.components.length > 0) {
            finassert(command !== null, {
                details: 'Unable to register components',
                message: 'Fatal error'
            });
            this.registerComponents(options, command);
        }

        let result;
        if (webhook === undefined) {
            result = await channel.send(this.formatReply(options));
        } else {
            result = await webhook.send({
                ...this.formatReply(options),
                ...options.webhookOptions
            });
        }
        finassert(result instanceof Message, { details: 'APIMessage received' });
        return result;
    }

    /**
     * Edits a Fina message without harming the MessageEmbed inside,
     * And with properly registering new components, if any
     * @param message The message to edit
     * @param command The command (required if you are registering components)
     * @param options The delta replyOptions
     */
    public static async editMessage(
        command: FinaCommand | null,
        options: FinaEditOptions
    ) {
        let message: Message;
        if ('message' in options) {
            message = options.message;
        } else {
            const channel = await this.fetchChannel(options);
            message = await channel.messages.fetch(options.messageId);
        }

        const webhook = options.webhookOptions?.webhook;

        if (message.embeds.length > 0) {
            const [oldEmbed] = message.embeds;
            const embedData = oldEmbed.toJSON() as Omit<APIEmbed, 'timestamp'>;
            if (options.content !== undefined) {
                embedData.description = undefined;
            }
            options = { ...embedData, ...options };
        }

        if (options.components !== undefined && options.components.length > 0) {
            finassert(command !== null, {
                details: 'Unable to register components',
                message: 'Fatal error'
            });
            this.registerComponents(options, command);
        }

        let result;
        if (webhook === undefined) {
            result = await message.edit(this.formatReply(options));
        } else {
            result = await webhook.editMessage(message, {
                ...this.formatReply(options),
                ...options.webhookOptions
            });
        }

        finassert(result instanceof Message, { details: 'APIMessage received' });
        return result;
    }

    public static baseReplyFactory(
        interaction:
            | BaseCommandInteraction
            | MessageComponentInteraction
            | ModalSubmitInteraction,
        command: FinaCommand
    ): BaseReply {
        const mutex = new Mutex();

        const defer = async () => {
            mutex.runExclusive(async () => {
                if (!interaction.replied) {
                    await interaction.deferReply({
                        ephemeral: command.hasFlag('AlwaysEphemeral')
                    });
                }
            });
        };
        const timeout = setTimeout(defer, 2400);

        if (interaction.isApplicationCommand() && command.hasFlag('AlwaysThinking')) {
            clearTimeout(timeout);
            defer();
        }

        return async <T extends FinaReplyOptions>(rawReplyOptions: T) => {
            const replyOptions = this.formatReply(rawReplyOptions);

            replyOptions.ephemeral ??=
                rawReplyOptions.modal === undefined && command.hasFlag('AlwaysEphemeral');

            if (!replyOptions.ephemeral) {
                this.checkChannelPermission(interaction.channel);
            }

            if (replyOptions.cancel) {
                clearTimeout(timeout);
                if (replyOptions.fetchReply) {
                    throw new FinaError({ details: 'Unable to fetch reply' });
                } else {
                    return undefined as FinaReplyOptionsType<T>;
                }
            } else {
                return await mutex.runExclusive(async () => {
                    clearTimeout(timeout);
                    let shouldFollowUp = false;
                    if (interaction.deferred) {
                        if (
                            !command.hasFlag('AlwaysEphemeral') &&
                            replyOptions.ephemeral
                        ) {
                            // The original command wasn't ephemeral
                            // Follow-up won't make it ephemeral
                            // So it has to be deleted
                            await interaction.editReply('\u200b');
                            // For some reason d.js will think the reply is still 'ephemeral' (defers always count as ephemeral)
                            // So toggle it
                            interaction.ephemeral = false;
                            await interaction.deleteReply();
                        }
                        shouldFollowUp = true;
                    } else if (interaction.replied) {
                        shouldFollowUp = true;
                    }

                    this.registerComponents(replyOptions, command);

                    if (replyOptions.modal !== undefined) {
                        replyOptions.modal.customId = `${command.uid}:${replyOptions.modal.customId}`;
                    }

                    let message: void | APIMessage | Message;

                    if (
                        replyOptions.modal !== undefined &&
                        !interaction.isModalSubmit()
                    ) {
                        message = await interaction.showModal(replyOptions.modal);
                    } else if (shouldFollowUp) {
                        message = await interaction.followUp(replyOptions);
                    } else {
                        message = await interaction.reply(replyOptions);
                    }

                    if (message instanceof Message) {
                        if (replyOptions.fetchReply) {
                            return message as FinaReplyOptionsType<T>;
                        } else {
                            return undefined as FinaReplyOptionsType<T>;
                        }
                    } else {
                        if (replyOptions.fetchReply) {
                            throw new FinaError({ details: 'Unable to fetch reply' });
                        } else {
                            return undefined as FinaReplyOptionsType<T>;
                        }
                    }
                });
            }
        };
    }
}
