import Database, { DbPoll } from 'core/Database';
import { FinaSlashCommand, IButtonCommand, BaseReply } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { FinaError, finassert } from 'core/FinaError';
import { FinaCommandInteraction, FinaButtonInteraction } from 'core/Types';
import {
    DiscordAPIError,
    Guild,
    MessageActionRow,
    MessageButton,
    Role
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import Tools from 'util/Tools';
import { PollConfig } from './Config';
import { PollCommon } from './PollCommon';

export default class RolePicker extends FinaSlashCommand implements IButtonCommand {
    constructor() {
        super('ninja.nairobi.common.rolepicker');
    }

    public createCommands(guild: Guild): FinaCommandResolvable {
        const res = new FinaCommandBuilder(this)
            .setName('rolepicker')
            .setDescription('Creates a new role picker')
            .addOption({
                name: 'title',
                description: 'The title of the role picker',
                type: 'String',
                required: true
            })
            .addOption({
                name: 'live-results',
                description: 'Whether to show the number of members (default: false)',
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
                name: 'image',
                description: 'The image to attach (default: none)',
                type: 'Attachment',
                required: false
            });

        for (let i = 1; i <= PollConfig.MAX_CHOICES; ++i) {
            res.addOption({
                name: `role-${i}`,
                description: 'Role',
                type: 'Role',
                required: false
            });
        }

        return res;
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const title = interaction.options.getString('title', true);
        const liveUpdate = interaction.options.getBoolean('live-results') ?? false;
        const minChoices = interaction.options.getInteger('min-choices') ?? 1;
        const maxChoices = interaction.options.getInteger('max-choices') ?? 0;
        const freeToInsert = false;
        const picRelated = interaction.options.getAttachment('image');

        finassert(interaction.member.permissions.has('MANAGE_ROLES'), {
            message: 'You need Manage Roles permission to create a role picker',
            gif: 'permissions'
        });

        finassert(maxChoices >= minChoices || maxChoices === 0, {
            message: 'max-choices cannot be lower than min-choices',
            gif: 'permissions'
        });

        const choices = [];

        for (let i = 1; i <= PollConfig.MAX_CHOICES; ++i) {
            const role = interaction.options.getRole(`role-${i}`);
            if (role instanceof Role) {
                choices.push({
                    userId: interaction.user.id,
                    key: role.id,
                    text: ''
                });
            }
        }

        finassert(choices.length >= minChoices, {
            message: 'Too few roles selected',
            gif: 'dead'
        });

        const pollData: DbPoll = {
            messageId: '',
            channelId: interaction.channel.id,
            authorId: interaction.member.id,
            guildId: interaction.guild.id,
            minChoices,
            maxChoices,
            liveUpdate,
            freeToInsert,
            imageURL: picRelated?.url ?? null,
            title,
            endTime: null,
            rolePoll: true
        };

        const message = await reply({
            content: 'Preparing a role picker...',
            fetchReply: true
        });

        pollData.messageId = message.id;

        await Database.poll.create({
            data: pollData
        });

        await Database.pollChoice.createMany({
            data: choices.map((choice) => {
                return { ...choice, messageId: message.id };
            }),
            skipDuplicates: true
        });

        await DiscordTools.editMessage(this, {
            ...(await PollCommon.printPoll(pollData, false, interaction.channel)),
            components: await this.createButtons(pollData, interaction.guild),
            message
        });
    }

    public async processButton(reply: BaseReply, interaction: FinaButtonInteraction) {
        const dbPoll = await Database.poll.findUnique({
            where: {
                messageId: interaction.message.id
            }
        });

        finassert(dbPoll !== null, { message: 'This poll has expired.', gif: 'dead' });

        await this.processChoice(reply, interaction, dbPoll);
    }

    private async processChoice(
        reply: BaseReply,
        interaction: FinaButtonInteraction,
        dbPoll: DbPoll
    ) {
        // TODO merge this with Poll.processChoice()
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

        finassert(interaction.guild.me?.permissions.has('MANAGE_ROLES') ?? false, {
            message: `I need the Manage Roles permission for this command to work`
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

            await interaction.member.roles.remove(key);

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
                    await interaction.member.roles.remove(oldest.key);
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
            const role = await interaction.guild.roles.fetch(vote.key);
            if (role !== null) {
                res += `<@&${role.id}> `;
            }
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
            await interaction.member.roles.remove(
                dbAllUserVotes.map((dbVote) => dbVote.key)
            );
            await interaction.member.roles.remove(key);
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
            // const dbOtherRoles = (
            //     await Database.pollChoice.findMany({
            //         where: {
            //             messageId
            //         }
            //     })
            // ).filter((dbRole) =>
            //     dbAllUserVotes.every((dbVote) => dbVote.key !== dbRole.key)
            // );
            await interaction.member.roles
                .add(dbAllUserVotes.map((dbVote) => dbVote.key))
                .catch((error) => {
                    if (error instanceof DiscordAPIError) {
                        if (error.message === 'Missing Permissions') {
                            throw new FinaError({
                                message: 'I am not allowed to add this role'
                            });
                        }
                    }
                    throw error;
                });
            // await interaction.member.roles.remove(
            //     dbOtherRoles.map((dbRole) => dbRole.key)
            // );
        }

        await reply({
            content: res,
            ephemeral: true
        });

        if (remainingVotes <= 0 || (voteDeleted && remainingVotes === 1)) {
            DiscordTools.editMessage(this, {
                ...(await PollCommon.printPoll(dbPoll, false, interaction.channel)),
                message: interaction.message
            }).then(() => {});
        }
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
            const roleId = dbChoice.key;
            const role = await guild.roles.fetch(roleId);
            if (role !== null) {
                buttons.push(
                    new MessageButton()
                        .setCustomId(roleId)
                        .setLabel(role.name)
                        .setStyle('PRIMARY')
                );
            }
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
