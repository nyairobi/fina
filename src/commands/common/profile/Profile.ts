import {
    Guild,
    GuildMember,
    MemberMention,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed
} from 'discord.js';

import { finassert } from 'core/FinaError';
import {
    FinaSlashCommand,
    BaseReply,
    IButtonCommand,
    ISlashCommand,
    IContextUserCommand,
    FinaCommand
} from 'core/FinaCommand';
import Database from 'core/Database';
import {
    FinaButtonInteraction,
    FinaCommandInteraction,
    FinaContextUserInteraction
} from 'core/Types';
import { TimedCollection } from 'util/TimedCollection';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { DiscordTools } from 'util/DiscordTools';
import { TimeTools } from 'util/TimeTools';

interface LiveProfile {
    member: GuildMember;
    ephemeral: boolean;
}

export default class Profile
    extends FinaCommand
    implements IButtonCommand, IContextUserCommand, ISlashCommand
{
    private _liveProfiles: TimedCollection<LiveProfile>;

    public constructor() {
        super('ninja.nairobi.common.profile');
        this._liveProfiles = new TimedCollection(120_000);
    }

    public createCommands(guild: Guild): FinaCommandResolvable {
        return [
            new FinaCommandBuilder(this)
                .setName('profile')
                .setDescription(`Displays information about a member of ${guild.name}`)
                .addOption({
                    name: 'user',
                    type: 'User',
                    description: 'The user (default: you)',
                    required: false
                })
                .addOption({
                    name: 'hidden',
                    type: 'Boolean',
                    description: 'Whether to send this message privately (default: true)',
                    required: false
                }),
            new FinaCommandBuilder(this).setName('Show profile').setType('USER')
        ];
    }

    private static profileSkeleton(member: GuildMember) {
        const embed = new MessageEmbed().setTitle(DiscordTools.formatUsername(member));

        const subtitle = member.presence?.activities.find(
            (activity) => activity.type === 'CUSTOM'
        );

        if (subtitle !== undefined) {
            embed.setDescription(
                `${subtitle.emoji?.toString() || ''} *${subtitle.state}*\n\n<@${
                    member.id
                }>`
            );
        } else {
            embed.setDescription(`<@${member.id}>`);
        }

        const banner = member.user.bannerURL({ dynamic: true });
        if (banner !== null) {
            embed.setImage(banner);
        }

        const avatar = member.displayAvatarURL();
        if (avatar !== null) {
            embed.setThumbnail(avatar);
        }

        return embed;
    }

    private async displayProfile(
        reply: BaseReply,
        guild: Guild,
        member: GuildMember,
        callingMember: GuildMember,
        ephemeral: boolean
    ) {
        const userId = member.id;
        const [dbCounters] = await Promise.all([
            Database.counter.findMany({
                where: {
                    serverId: guild.id
                }
            }),
            member.user.fetch()
        ]);

        let row: MessageActionRow | undefined;
        if (dbCounters.length > 0) {
            row = new MessageActionRow();
            for (const dbCounter of dbCounters) {
                row.addComponents(
                    new MessageButton()
                        .setCustomId(dbCounter.counterId.toString())
                        .setEmoji(dbCounter.summaryEmoji)
                        .setLabel(dbCounter.summaryName)
                        .setStyle('PRIMARY')
                );
            }
        }

        const embed = Profile.profileSkeleton(member).addField(
            'Registered at',
            TimeTools.timestamp(member.user.createdAt),
            true
        );
        if (member.joinedAt !== null) {
            embed.addField(
                `Joined ${guild?.name} at`,
                TimeTools.timestamp(member.joinedAt),
                true
            );
        }

        if (member.premiumSince !== null) {
            embed.addField('Boosting since', TimeTools.timestamp(member.premiumSince));
        }

        if (
            guild.id === process.env.HOME_GUILD_ID &&
            callingMember.permissions.has('MODERATE_MEMBERS')
        ) {
            const dbArcUser = await Database.arcUser.findUnique({
                where: {
                    userId
                }
            });

            if (dbArcUser !== null) {
                let timestamp = `${dbArcUser.timestamp.toLocaleDateString()}`;
                if (dbArcUser.timestamp.getTime() < 1664538249868) {
                    timestamp = 'Before 30/09/2022';
                }
                embed.addField(
                    'Arcaea',
                    `Username: ${dbArcUser.arcName}\nPTT: ${dbArcUser.ptt.toFixed(
                        2
                    )}\nB30: ${dbArcUser.b30?.toFixed(2)}\nLast sync: ${timestamp}`,
                    true
                );
            }
        }
        const message = await reply({
            embed,
            components: row !== undefined ? [row] : undefined,
            ephemeral,
            fetchReply: true
        });

        if (row !== undefined) {
            this._liveProfiles.set(message, {
                member,
                ephemeral
            });
        }
    }

    public async processContextUser(
        reply: BaseReply,
        interaction: FinaContextUserInteraction
    ) {
        const member = interaction.targetMember;
        const callingMember = interaction.member;
        const guild = interaction.guild;

        await this.displayProfile(reply, guild, member, callingMember, true);
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const member = interaction.options.getMember('user') || interaction.member;
        const callingMember = interaction.member;
        const guild = interaction.guild;
        const ephemeral = interaction.options.getBoolean('hidden') ?? true;

        finassert(member instanceof GuildMember, {
            details: 'Invalid member'
        });

        await this.displayProfile(reply, guild, member, callingMember, ephemeral);
    }

    public async processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> {
        const guild = interaction.guild;
        const message = interaction.message;
        const liveProfile = this._liveProfiles.get(message);

        finassert(liveProfile !== undefined, { message: 'This profile has expired' });

        finassert(guild instanceof Guild, {
            details: 'Invalid guild'
        });

        finassert(message instanceof Message, {
            details: 'Invalid message'
        });

        const { member, ephemeral } = liveProfile;

        const counterId = parseInt(interaction.customId);

        // Delete the button from the source message
        if (!ephemeral) {
            const oldRows = message.components;
            if (oldRows.length > 0) {
                // Assume only 1 row
                const newComponents = oldRows[0].components.filter(
                    (component) => component.customId !== interaction.customId
                );
                const newRow = new MessageActionRow().addComponents(newComponents);
                DiscordTools.editMessage(this, {
                    components: newComponents.length > 0 ? [newRow] : [],
                    message
                });
            }
        }

        const [dbEntries, dbSum] = await Promise.all([
            Database.counterEntry.findMany({
                where: {
                    userId: member.id,
                    counterId
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: 30
            }),

            Database.counterEntry.aggregate({
                _sum: {
                    value: true
                },
                where: {
                    userId: member.id,
                    counterId
                }
            })
        ]);

        const embed = Profile.profileSkeleton(member);

        if (dbEntries.length === 0) {
            embed.setDescription('*No entries yet.*');
        } else {
            embed.setDescription(`**Total: ${dbSum._sum.value}**`);
            let res = '';
            for (const dbEntry of dbEntries) {
                const formattedValue = `${dbEntry.value >= 0 ? '+' : '-'}${Math.abs(
                    dbEntry.value
                )}`.padStart(3, ' ');
                res += `\`${formattedValue}\` ${dbEntry.title} [${TimeTools.timestamp(
                    dbEntry.timestamp,
                    { durationOnly: true }
                )}](${dbEntry.dstMsgUrl})\n`;
            }
            embed.addField('Recent entries', res);
        }
        await reply({
            embed,
            ephemeral
        });
    }
}
