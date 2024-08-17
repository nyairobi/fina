import Database, { DbPoll } from 'core/Database';
import {
    FinaSlashCommand,
    IButtonCommand,
    BaseReply,
    IModalCommand
} from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { finassert, FinaError } from 'core/FinaError';
import { FinaSendOptions } from 'core/FinaReplyOptions';
import { Logger } from 'core/Logger';
import {
    FinaCommandInteraction,
    FinaModalInteraction,
    FinaButtonInteraction
} from 'core/Types';
import {
    Guild,
    TextChannel,
    TextInputComponent,
    Modal,
    MessageActionRow,
    MessageButton
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import Tools from 'util/Tools';
import { PollConfig } from './Config';
import { PollCommon } from './PollCommon';
import NodeEmoji from 'node-emoji';

export default class PollStart
    extends FinaSlashCommand
    implements IButtonCommand, IModalCommand
{
    // public constructor(uid: string) {
    //     super(uid);
    //     this.keys = ['ninja.nairobi.common.poll'];
    // }

    public constructor(uid: string) {
        super('ninja.nairobi.common.pollstart');
        this.keys = ['ninja.nairobi.common.poll'];
    }

    private async initTimeouts(guild: Guild) {
        const dbPolls = await Database.poll.findMany({
            where: {
                guildId: guild.id,
                endTime: {
                    not: null
                }
            },
            include: {
                choices: { orderBy: { timestamp: 'asc' } }
            }
        });
        for (const dbPoll of dbPolls) {
            setTimeout(async () => {
                await PollCommon.deletePoll(guild, dbPoll);
            }, dbPoll.endTime!.getTime() - Date.now());
        }
        return dbPolls.length;
    }

    public createCommands(guild: Guild): FinaCommandResolvable {
        this.alias = 'poll-create';
        const res = new FinaCommandBuilder(this)
            .setName('poll-create')
            .setDescription('Creates a new poll')
            .addOption({
                name: 'title',
                description: 'The title of the poll',
                type: 'String',
                required: true
            })
            .addOption({
                name: 'live-results',
                description:
                    'Whether to show results during the voting phase (default: false)',
                type: 'Boolean',
                required: false
            })
            .addOption({
                name: 'min-choices',
                description:
                    'Minimum number of choices the user has to select for the vote to count  (default: 1)',
                type: 'Integer',
                required: false,
                choices: Tools.range(1, PollConfig.MAX_CHOICES)
            })
            .addOption({
                name: 'max-choices',
                description:
                    'Maximum number of choices the user can select (default: any)',
                type: 'Integer',
                required: false,
                choices: [['Any', 0], ...Tools.range(1, PollConfig.MAX_CHOICES)]
            })
            .addOption({
                name: 'open-poll',
                description:
                    'Whether to let users add their own choices (default: false)',
                type: 'Boolean',
                required: false
            })
            .addOption({
                name: 'timeout',
                description: 'When to close the poll automatically (default: never)',
                type: 'Integer',
                required: false,
                choices: [
                    ['Never', 0],
                    ['1 minute', 1],
                    ['10 minutes', 10],
                    ['1 hour', 60],
                    ['1 day', 24 * 60],
                    ['1 week', 7 * 24 * 60]
                ]
            })
            .addOption({
                name: 'image',
                description: 'The image to attach (default: none)',
                type: 'Attachment',
                required: false
            });

        this.initTimeouts(guild)
            .then((count) => {
                if (count > 0) {
                    Logger.info(`Loaded ${count} old polls in ${guild.name}`);
                }
            })
            .catch((error) => Logger.error(`Unable to load old polls: ${error}`));

        return res;
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const dbServerInfo = await Database.serverInfo.findUnique({
            where: {
                serverId: interaction.guild.id
            }
        });

        finassert(dbServerInfo !== null && dbServerInfo.pollChId !== null, {
            message: `This server does not have a poll channel. Configure with \`/admin config\``,
            gif: 'dead'
        });

        const title = interaction.options.getString('title', true);
        const liveUpdate = interaction.options.getBoolean('live-results') ?? false;
        const minChoices = interaction.options.getInteger('min-choices') ?? 1;
        const maxChoices = interaction.options.getInteger('max-choices') ?? 0;
        const freeToInsert = interaction.options.getBoolean('open-poll') ?? false;
        const timeoutMinutes = interaction.options.getInteger('timeout');
        const picRelated = interaction.options.getAttachment('image');

        const channel = await interaction.guild.channels.fetch(dbServerInfo.pollChId);

        finassert(channel instanceof TextChannel, {
            message: 'Unable to access the poll channel.',
            gif: 'dead'
        });

        finassert(channel.permissionsFor(interaction.member).has('SEND_MESSAGES'), {
            message:
                'You need Send Messages permission in the poll channel to start a poll',
            gif: 'permissions'
        });

        finassert(maxChoices >= minChoices || maxChoices === 0, {
            message: 'max-choices cannot be lower than min-choices',
            gif: 'permissions'
        });

        const pollData: DbPoll = {
            messageId: '',
            channelId: channel.id,
            authorId: interaction.member.id,
            guildId: interaction.guild.id,
            minChoices,
            maxChoices,
            liveUpdate,
            freeToInsert,
            imageURL: picRelated?.url ?? null,
            title,
            endTime:
                timeoutMinutes === null
                    ? null
                    : new Date(Date.now() + timeoutMinutes * 60_000),
            rolePoll: false
        };

        if (pollData.endTime !== null) {
            setTimeout(async () => {
                await PollCommon.deletePoll(interaction.guild, pollData);
            }, pollData.endTime!.getTime() - Date.now());
        }
        const sendOptions: FinaSendOptions = {
            ...(await PollCommon.printPoll(pollData, false, channel)),
            components: await this.createButtons(pollData, interaction.guild),
            channel
        };

        finassert(sendOptions.webhookOptions !== undefined, {
            details: 'Webhook does not exist'
        });

        sendOptions.webhookOptions = {
            ...sendOptions.webhookOptions,
            avatarURL: interaction.member.displayAvatarURL(),
            username: interaction.member.displayName
        };

        const message = await DiscordTools.sendMessage(this, sendOptions);
        pollData.messageId = message.id;

        await Promise.all([
            Database.poll.create({
                data: pollData
            }),
            reply({
                title: `Posted to #${channel.name}`,
                content: `[Jump to the poll](${message.url})`,
                ephemeral: true
            })
        ]);
    }

    public async processModal(reply: BaseReply, interaction: FinaModalInteraction) {
        // TODO placeholder for modals
        let key = interaction.components.find(
            (row) => row.components[0].customId === 'emoji'
        )?.components[0].value;
        const text =
            interaction.components.find((row) => row.components[0].customId === 'text')
                ?.components[0].value ?? 'No text';
        const messageId = interaction.customId;
        const DEFAULT_EMOJI = 'abcdefghijklmno'
            .split('')
            .map((char) => `regional_indicator_${char}`);

        const dbPoll = await Database.poll.findUnique({
            where: {
                messageId
            },
            include: {
                choices: { orderBy: { timestamp: 'asc' } }
            }
        });

        const message = await interaction.channel.messages.fetch(messageId).catch(() => {
            throw new FinaError({
                message: 'Unable to access the poll message',
                gif: 'dead'
            });
        });

        finassert(dbPoll !== null, { message: 'This poll has expired.', gif: 'dead' });

        let emojiExists: boolean;
        if (key === undefined || key.length === 0) {
            key = DEFAULT_EMOJI[dbPoll.choices.length];
            emojiExists = true;
        } else {
            emojiExists = NodeEmoji.hasEmoji(key);
        }

        finassert(dbPoll.choices.length < PollConfig.MAX_CHOICES, {
            message: 'This poll has reached its limit of choices',
            gif: 'permissions'
        });

        if (!emojiExists) {
            const guildEmojis = await interaction.guild.emojis.fetch();
            const customEmoji = guildEmojis.find((emoji) => emoji.name === key);
            if (customEmoji !== undefined) {
                emojiExists = true;
                key = customEmoji.id;
            }
        }

        finassert(emojiExists, { message: `Unknown emoji ${key}`, gif: 'dead' });

        await Database.pollChoice
            .create({
                data: {
                    messageId,
                    userId: interaction.user.id,
                    key,
                    text
                }
            })
            .catch((error) => {
                throw new FinaError({
                    message: 'Unable to add the option – duplicate emoji?'
                });
            });

        await reply({ forceRaw: true, content: '✅', ephemeral: true });

        await DiscordTools.editMessage(this, {
            message,
            ...(await PollCommon.printPoll(dbPoll, false, interaction.channel)),
            components: await this.createButtons(dbPoll, interaction.guild)
        });
    }

    public async processButton(reply: BaseReply, interaction: FinaButtonInteraction) {
        const dbPoll = await Database.poll.findUnique({
            where: {
                messageId: interaction.message.id
            }
        });

        finassert(dbPoll !== null, { message: 'This poll has expired.', gif: 'dead' });

        if (interaction.customId === 'insert!') {
            await this.showChoiceModal(reply, interaction, dbPoll);
        } else {
            await this.processChoice(reply, interaction, dbPoll);
        }
    }

    private async processChoice(
        reply: BaseReply,
        interaction: FinaButtonInteraction,
        dbPoll: DbPoll
    ) {
        const userId = interaction.user.id;
        const messageId = interaction.message.id;
        const key = interaction.customId;

        const dbChoice = await Database.pollChoice.findUnique({
            where: {
                messageId_key: {
                    messageId,
                    key
                }
            }
        });

        finassert(dbChoice !== null, {
            message: 'Something went wrong with the poll',
            details: 'Uninitialized entry in the poll',
            gif: 'dead'
        });

        const dbAllUserVotes = await Database.pollVote.findMany({
            where: {
                userId,
                messageId
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        const thisButtonIdx = dbAllUserVotes.findIndex((vote) => vote.key === key);
        const voteDeleted = thisButtonIdx >= 0;

        if (voteDeleted) {
            /* User has already chosen this one -> undo it */
            await Database.pollVote.delete({
                where: {
                    userId_messageId_key: {
                        userId,
                        messageId,
                        key
                    }
                }
            });

            /* Keep the array up to date to avoid another DB call */
            dbAllUserVotes.splice(thisButtonIdx, 1);
        } else {
            /* Delete the oldest choice if the limit is exceeded */
            if (dbPoll.maxChoices > 0 && dbAllUserVotes.length === dbPoll.maxChoices) {
                const oldest = dbAllUserVotes.shift();
                if (oldest !== undefined) {
                    await Database.pollVote.delete({
                        where: {
                            userId_messageId_key: {
                                userId: oldest.userId,
                                messageId: oldest.messageId,
                                key: oldest.key
                            }
                        }
                    });
                }
            }

            /* Insert the new choice */
            const newVote = await Database.pollVote.create({
                data: {
                    userId,
                    messageId,
                    key
                }
            });

            dbAllUserVotes.push(newVote);
        }

        let res = '';
        for (const vote of dbAllUserVotes) {
            res += `${await PollCommon.getEmoji(vote.key, interaction.guild)} `;
        }
        res = res || '∅';
        if (dbAllUserVotes.length > 1) {
            res = `Your choices are **${res}**`;
        } else {
            res = `Your choice is **${res}**`;
        }

        const remainingVotes = dbPoll.minChoices - dbAllUserVotes.length;

        if (remainingVotes > 0) {
            res += `\nSelect **${remainingVotes}** more`;
            await Database.pollVote.updateMany({
                where: {
                    userId,
                    messageId
                },
                data: {
                    pending: true
                }
            });
        } else {
            await Database.pollVote.updateMany({
                where: {
                    userId,
                    messageId
                },
                data: {
                    pending: false
                }
            });
        }

        await reply({
            content: res,
            ephemeral: true
        });

        if (remainingVotes <= 0 || voteDeleted) {
            DiscordTools.editMessage(this, {
                ...(await PollCommon.printPoll(dbPoll, false, interaction.channel)),
                message: interaction.message
            }).then(() => {});
        }
    }

    private async showChoiceModal(
        reply: BaseReply,
        interaction: FinaButtonInteraction,
        dbPoll: DbPoll
    ) {
        finassert(
            dbPoll.freeToInsert ||
                interaction.member.permissions.has('MANAGE_CHANNELS') ||
                interaction.user.id === dbPoll.authorId,
            {
                message: 'You are not allowed to add choices to this poll',
                gif: 'permissions'
            }
        );

        finassert(
            (interaction.user.id === dbPoll.authorId ||
                interaction.memberPermissions?.has('ADD_REACTIONS')) ??
                false,
            {
                message: `You are not allowed to add choices (you need reactions permission)`,
                gif: 'permissions'
            }
        );

        const emojiInput = new TextInputComponent()
            .setCustomId('emoji')
            .setStyle('SHORT')
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(false)
            .setLabel('Emoji')
            .setPlaceholder(NodeEmoji.random().key);

        const textInput = new TextInputComponent()
            .setCustomId('text')
            .setStyle('SHORT')
            .setMinLength(1)
            .setMaxLength(200)
            .setRequired(true)
            .setLabel('Text');

        const modal = new Modal()
            .setCustomId(interaction.message.id)
            .setTitle('Add a choice')
            .addComponents(
                new MessageActionRow<TextInputComponent>().addComponents(emojiInput),
                new MessageActionRow<TextInputComponent>().addComponents(textInput)
            );

        await reply({ modal });
    }

    private async createButtons(dbPoll: DbPoll, guild: Guild) {
        const rows: MessageActionRow[] = [];

        /* Load prompts */
        const dbChoices = await Database.pollChoice.findMany({
            where: {
                messageId: dbPoll.messageId
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        const buttons: MessageButton[] = [];

        /* Turn prompts into buttons */
        for (const dbChoice of dbChoices) {
            buttons.push(
                new MessageButton()
                    .setCustomId(dbChoice.key)
                    .setEmoji(await PollCommon.getEmoji(dbChoice.key, guild))
                    .setStyle('PRIMARY')
            );
        }

        if (dbChoices.length < PollConfig.MAX_CHOICES) {
            buttons.push(
                new MessageButton()
                    .setCustomId('insert!')
                    .setEmoji('952170426853888030')
                    .setStyle('SECONDARY')
            );
        }

        if (buttons.length <= 5) {
            rows.push(new MessageActionRow().addComponents(buttons));
        } else {
            const split = Tools.splitArrayIntoChunks(
                buttons,
                buttons.length > 10
                    ? Math.ceil(buttons.length / 3)
                    : Math.ceil(buttons.length / 2)
            );
            for (const buttons of split) {
                rows.push(new MessageActionRow().addComponents(buttons));
            }
        }

        return rows;
    }
}
