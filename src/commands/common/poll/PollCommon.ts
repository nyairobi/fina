import Database, { DbPoll } from 'core/Database';
import { finassert } from 'core/FinaError';
import { FinaWebhookOptions } from 'core/FinaReplyOptions';
import {
    TextChannel,
    ThreadChannel,
    EmbedFieldData,
    HexColorString,
    MessageAttachment,
    Guild,
    GuildEmoji,
    Role
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import { PollRenderer } from './PollRenderer';
import NodeEmoji from 'node-emoji';
import { PollConfig } from './Config';
import { Logger } from 'core/Logger';

export class PollCommon {
    public static async printPoll(
        dbData: DbPoll,
        hasEnded: boolean,
        channel: TextChannel | ThreadChannel
    ): Promise<FinaWebhookOptions> {
        finassert(channel instanceof TextChannel, {
            message: 'Polls cannot be created inside threads'
        });

        const fields: EmbedFieldData[] = [];
        const [promptData, totalVotes] = await Promise.all([
            this.generateSummary(dbData, channel.guild),
            Database.pollVote.count({
                where: {
                    messageId: dbData.messageId,
                    pending: false
                }
            })
        ]);

        if (!dbData.rolePoll) {
            for (let { emojiValue, text, value, userId } of promptData) {
                if (dbData.liveUpdate || hasEnded) {
                    emojiValue = `${emojiValue}   ${value} (${(
                        (value / (totalVotes || 1)) *
                        100.0
                    ).toFixed(1)}%)`;
                }
                if (dbData.freeToInsert) {
                    text += `\n*added by <@${userId}>*`;
                }
                fields.push({
                    name: `${emojiValue}`,
                    value: text,
                    inline: true
                });
            }
        } else {
            let res = '';
            for (const { key, value } of promptData) {
                const role = await channel.guild.roles.fetch(key);
                if (role instanceof Role) {
                    res += `<@&${role.id}>`;
                    if (dbData.liveUpdate) {
                        res += `  ${value}`;
                    }
                    res += '\n';
                }
            }
            fields.push({ name: 'Roles', value: res });
        }
        while (fields.length % 3 > 0 && !dbData.rolePoll) {
            fields.push({
                name: '\u200b',
                value: '\u200b',
                inline: true
            });
        }
        if (fields.length === 0) {
            if (!hasEnded) {
                fields.push({
                    name: 'No choices yet',
                    value: 'Click the button below to add a choice'
                });
            } else {
                fields.push({
                    name: 'No choices',
                    value: "This poll's short life was full of loneliness"
                });
            }
        }

        if (!dbData.rolePoll) {
            fields.push({
                name: 'Total votes',
                value: `${totalVotes}`
            });
        }

        if (dbData.endTime !== null && !hasEnded) {
            const posixTimestamp = Math.floor(dbData.endTime.getTime() / 1000);
            fields.push({
                name: 'Expires',
                value: `<t:${posixTimestamp}> (<t:${posixTimestamp}:R>)`
            });
        }
        const webhook = dbData.rolePoll
            ? null
            : await DiscordTools.getWebhook(channel, 'Fina polls');

        finassert(dbData.rolePoll || webhook !== null, {
            message: 'Unable to fetch the poll webhook. Re-configure the poll command',
            gif: 'dead'
        });

        let pollHeader = dbData.rolePoll
            ? 'Role picker '
            : dbData.freeToInsert
            ? 'Open poll '
            : 'Poll ';

        if (hasEnded) {
            pollHeader += 'results';
        } else {
            pollHeader += '(pick ';

            const minimum = dbData.minChoices > 1;
            const maximum = dbData.maxChoices > 1;
            if (minimum && maximum) {
                if (dbData.minChoices !== dbData.maxChoices) {
                    pollHeader += `between ${dbData.minChoices} and ${dbData.maxChoices}`;
                } else {
                    pollHeader += `${dbData.minChoices}`;
                }
            } else if (minimum) {
                pollHeader += `at least ${dbData.minChoices}`;
            } else if (maximum) {
                pollHeader += `at most ${dbData.maxChoices}`;
            } else if (dbData.maxChoices === 1) {
                pollHeader += 'one';
            } else {
                pollHeader += 'as many as you want';
            }
            pollHeader += ')';
        }

        let res: FinaWebhookOptions = {
            author: {
                name: pollHeader,
                iconURL: dbData.rolePoll
                    ? PollConfig.ROLE_PICKER_THUMB
                    : PollConfig.POLL_THUMB
            },
            title: dbData.title,
            color: process.env.BASE_COLOR as HexColorString,
            description: '',
            thumbnail: {
                url: dbData.imageURL ?? undefined
            },
            fields,
            webhookOptions: webhook === null ? undefined : { webhook }
        };

        if (hasEnded && totalVotes > 0) {
            res.files = [
                new MessageAttachment(await PollRenderer.render(promptData), 'chart.png')
            ];
            res.image = { url: 'attachment://chart.png' };
        }
        return res;
    }

    /**
     * Reformat prompt data (with the emoji)
     */
    private static async generateSummary(dbPoll: DbPoll, guild: Guild) {
        const promptData = [];
        const dbCount = await Database.pollVote.groupBy({
            where: {
                messageId: dbPoll.messageId,
                pending: false
            },
            by: ['key'],
            _count: {
                _all: true
            }
        });
        const dbChoices = await Database.pollChoice.findMany({
            where: {
                messageId: dbPoll.messageId
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        for (const { key, text, userId } of dbChoices) {
            promptData.push({
                key: key,
                emojiValue: await this.getEmoji(key, guild),
                text,
                value: dbCount.find((count) => count.key === key)?._count._all ?? 0,
                userId
            });
        }
        return promptData;
    }

    public static isRegionalEmoji(emojiValue: string | GuildEmoji) {
        const REGIONAL_INDICATORS = {
            a: '🇦',
            b: '🇧',
            c: '🇨',
            d: '🇩',
            e: '🇪',
            f: '🇫',
            g: '🇬',
            h: '🇭',
            i: '🇮',
            j: '🇯',
            k: '🇰',
            l: '🇱',
            m: '🇲',
            n: '🇳',
            o: '🇴'
        };
        if (emojiValue instanceof GuildEmoji) {
            return false;
        } else {
            return Object.values(REGIONAL_INDICATORS).some(
                (value) => value === emojiValue
            );
        }
    }

    public static async getEmoji(key: string, guild: Guild) {
        const guildEmoji = await guild.emojis.fetch(key).catch(() => null);
        if (guildEmoji !== null) {
            return guildEmoji;
        } else if (NodeEmoji.hasEmoji(key)) {
            return NodeEmoji.get(key);
        } else if (key.startsWith('regional_indicator_')) {
            const REGIONAL_INDICATORS = {
                a: '🇦',
                b: '🇧',
                c: '🇨',
                d: '🇩',
                e: '🇪',
                f: '🇫',
                g: '🇬',
                h: '🇭',
                i: '🇮',
                j: '🇯',
                k: '🇰',
                l: '🇱',
                m: '🇲',
                n: '🇳',
                o: '🇴'
            };
            const char = key.slice(-1) as keyof typeof REGIONAL_INDICATORS;
            return REGIONAL_INDICATORS[char];
        } else {
            return '❔';
        }
    }

    public static async deletePoll(guild: Guild, dbPoll: DbPoll) {
        const channel = await guild.channels.fetch(dbPoll.channelId);

        finassert(channel instanceof TextChannel, { details: 'Invalid channel' });

        const message = await channel.messages.fetch(dbPoll.messageId);

        if (!message.embeds[0].author?.name.includes('results')) {
            const editedMessage = await DiscordTools.editMessage(null, {
                ...(await PollCommon.printPoll(dbPoll, true, channel)),
                components: [],
                message
            });

            await Database.poll.delete({
                where: { messageId: dbPoll.messageId }
            });

            return editedMessage;
        } else {
            Logger.debug('A poll was slated to be deleted, but it was already over');
            return message;
        }
    }
}
