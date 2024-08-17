import { Mutex } from 'async-mutex';
import {
    TextChannel,
    ThreadChannel,
    LimitedCollection,
    GuildMember,
    Message,
    Collection,
    Guild
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import { StringTools } from 'util/StringTools';
import { UserId, MessageId, GuildId } from 'core/Types';
import Database from './Database';
import { finassert, FinaError } from './FinaError';

class ModmailGuild {
    private _mainChannel: TextChannel;
    private _modThread: ThreadChannel;
    private _userThreads = new LimitedCollection<UserId, ThreadChannel>({
        maxSize: 30,
        sweepInterval: 24 * 3600
    });
    private _messageAuthors = new LimitedCollection<MessageId, UserId>({});
    private _recentUserId: UserId = '';
    private _mutex: Mutex;

    public constructor(_mainChannel: TextChannel, _modThread: ThreadChannel) {
        this._mainChannel = _mainChannel;
        this._modThread = _modThread;

        this._mutex = new Mutex();
    }

    public get channel() {
        return this._mainChannel;
    }

    /**
     * Returns this member's modmail thread (creates it if it doesn't exist)
     * @param member The member
     */
    public async getUserThread(member: GuildMember, forcePublic: boolean = false) {
        let thread = this._userThreads.get(member.user.id);
        if (thread === undefined) {
            thread = await this._mainChannel.threads.create({
                name: member.nickname || member.user.username,
                type: forcePublic ? 'GUILD_PUBLIC_THREAD' : 'GUILD_PRIVATE_THREAD',
                invitable: false,
                autoArchiveDuration: 1440
            });
            this._userThreads.set(member.user.id, thread);
        }
        return thread;
    }

    public async getWebhook() {
        const webhooks = await this._mainChannel
            .fetchWebhooks()
            .catch(FinaError.permission('Manage webhooks', true));
        let webhook = webhooks.first();
        if (webhook === undefined) {
            webhook = await this._mainChannel.createWebhook('Modmail');
            await webhook.edit({
                avatar: this._mainChannel.guild.iconURL()
            });
        }
        return webhook;
    }

    public async sendToMods(message: Message) {
        const [repliedMessage, webhook] = await Promise.all([
            message.fetchReference(),
            this.getWebhook()
        ]);

        if (repliedMessage.webhookId === null) {
            // This is a reply to some other message - ignore
            return;
        }

        const targetUserId = this._messageAuthors.get(repliedMessage.id);

        finassert(targetUserId !== undefined, {
            message: 'This message has expired',
            gif: 'dead'
        });

        const userChannel = this._userThreads.get(targetUserId);

        finassert(userChannel !== undefined, {
            message: 'Unable to find the target thread. Start a new one.',
            gif: 'dead'
        });

        this._mutex.runExclusive(async () => {
            webhook.send({
                content: message.content || ' ',
                files: Array.from(message.attachments.values()),
                threadId: userChannel.id
            });
        });
    }

    public async sendToUser(message: Message) {
        const webhook = await this.getWebhook();
        const member = message.member;

        finassert(member !== null, {
            details: 'Message without a member in modmail'
        });

        this._mutex.runExclusive(async () => {
            let targetMessage = message.content;

            if (this._recentUserId !== message.author.id) {
                this._recentUserId = message.author.id;
                targetMessage = `*(forwarded from <@${message.author.id}>)*\n${targetMessage}`;
            }

            const resMessage = await webhook.send({
                content: StringTools.trim(targetMessage || ' ', 1000),
                files: Array.from(message.attachments.values()),
                threadId: this._modThread.id,
                username: `Modmail-${member.nickname || member.user.username}`,
                avatarURL: member.displayAvatarURL() || member.user.displayAvatarURL()
            });

            this._messageAuthors.set(resMessage.id, message.author.id);
        });
    }

    public async send(message: Message) {
        if (message.channel.id === this._modThread.id) {
            if (message.type === 'REPLY') {
                this.sendToMods(message);
            }
        } else {
            this.sendToUser(message);
        }
    }
}

export class ModmailHandler {
    private static modmailData: Collection<GuildId, ModmailGuild> = new Collection();

    public static send(message: Message) {
        finassert(message.channel instanceof ThreadChannel, {
            details: 'Attempted to send modmail from a non-thread channel'
        });

        const modmailGuild = this.modmailData.get(message.guild?.id || '');

        if (
            modmailGuild !== undefined &&
            message.channel.parentId === modmailGuild.channel.id
        ) {
            modmailGuild.send(message).catch((error) => {
                if (error instanceof FinaError) {
                    message.channel.send(
                        DiscordTools.makeEmbed(DiscordTools.printPanic(error))
                    );
                }
            });
        }
    }

    public static async getGuild(guild: Guild, forcePublic: boolean = false) {
        const dbServerInfo = await Database.serverInfo.findUnique({
            where: {
                serverId: guild.id
            }
        });

        finassert(dbServerInfo !== null && dbServerInfo.modmailChId !== null, {
            message: 'This server does not have a modmail. Use /admin config'
        });

        const mainChannel = await guild.client.channels.fetch(dbServerInfo.modmailChId);

        finassert(mainChannel instanceof TextChannel, {
            message:
                "Can't access the target channel. It doesn't exist or I don't have permissions",
            gif: 'angry'
        });

        let modmailGuild = this.modmailData.get(guild.id);

        if (modmailGuild === undefined || modmailGuild.channel.id !== mainChannel.id) {
            const [fetchedWebhooks, fetchedThreads] = await Promise.all([
                mainChannel.fetchWebhooks(),
                mainChannel.threads.fetchActive()
            ]).catch(
                FinaError.permission(
                    'Manage Webhooks, Manage Threads & Create Private Threads',
                    true
                )
            );

            let _modThread = fetchedThreads.threads.find(
                (thread) => thread.name === 'reply'
            );

            if (_modThread === undefined) {
                _modThread = await mainChannel.threads
                    .create({
                        name: 'reply',
                        type: forcePublic
                            ? 'GUILD_PUBLIC_THREAD'
                            : 'GUILD_PRIVATE_THREAD',
                        invitable: false,
                        autoArchiveDuration: 'MAX'
                    })
                    .catch(
                        FinaError.permission(
                            'Create Private Threads & Manage Threads',
                            true
                        )
                    );
            }

            modmailGuild = new ModmailGuild(mainChannel, _modThread);
            this.modmailData.set(guild.id, modmailGuild);
        }
        return modmailGuild;
    }
}
