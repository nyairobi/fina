import {
    AutocompleteInteraction,
    Client,
    Guild,
    GuildMember,
    Interaction,
    Message,
    TextChannel,
    ThreadChannel,
    PartialGuildMember,
    Collection
} from 'discord.js';
import { FinaCommand } from 'core/FinaCommand';
import { FinaCommandHandler } from 'core/FinaCommandHandler';
import { ModmailHandler } from 'core/ModmailHandler';
import Database from 'core/Database';
import { FinaError, finassert } from 'core/FinaError';
import { Logger } from 'core/Logger';
import { DiscordTools } from 'util/DiscordTools';
import { AutoreplyHandler } from './AutoreplyHandler';
import { StringTools } from 'util/StringTools';
import { GuildId } from './Types';
import 'dotenv/config';

export class Fina {
    private _client: Client;
    private _commandHandler: FinaCommandHandler;
    private _autoreplyHandler: AutoreplyHandler;
    private _guildReloadJobs: Collection<GuildId, NodeJS.Timeout>;
    private _guildCount: number;
    private static _instance: Fina;

    public constructor() {
        Fina._instance = this;
        this._client = new Client({
            partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'USER', 'GUILD_MEMBER'],
            intents: [
                'GUILDS',
                'GUILD_MESSAGES', // Autoreplies
                'GUILD_PRESENCES', // For /profile
                'GUILD_MEMBERS' // For memberRemoveHook
            ]
        });
        this._autoreplyHandler = new AutoreplyHandler();
        this._commandHandler = new FinaCommandHandler(this.client);
        this._guildReloadJobs = new Collection();
        this._guildCount = 0;
        this.client.login(process.env.DISCORD_TOKEN);
        this.client.once('ready', this.onClientLoaded.bind(this));
        this.client.on('guildMemberRemove', this.memberRemoveHook.bind(this));
        this.client.on('interactionCreate', this.interactionHookWrapper.bind(this));
        this.client.on('messageCreate', this.messageCreateHook.bind(this));
        this.client.on('guildCreate', (guild: Guild) => {
            this._guildCount++;
            this.loadGuild(guild);
        });
        this.client.on('guildDelete', () => {
            this._guildCount--;
            this.setStatus();
        });

        Logger.debug('Hooks are ready');
    }

    private get client() {
        return this._client;
    }

    public static get client() {
        return this._instance.client;
    }

    public static async message(message: string, value: string) {
        await this._instance.message(message, value);
    }

    private async message(message: string, value: string) {
        if (message === 'reload-guild') {
            const guildId = value;
            const previous = this._guildReloadJobs.get(guildId);
            if (previous !== undefined) {
                clearTimeout(previous);
            }
            this._guildReloadJobs.set(
                guildId,
                setTimeout(async () => {
                    const guild = await this._client.guilds.fetch(value);
                    this.loadGuild(guild);
                }, 20_000)
            );
        }
    }

    private setStatus() {
        if (process.env.STATUS_OVERRIDE !== undefined) {
            this.client.user?.setActivity(process.env.STATUS_OVERRIDE, {
                type: 'PLAYING'
            });
        } else {
            this.client.user?.setActivity(`${this._guildCount} servers 👀`, {
                type: 'WATCHING'
            });
        }
    }

    private async onClientLoaded() {
        finassert(this.client.user !== null, {
            details: 'No client'
        });

        await this.loadAllGuilds();

        this.setStatus();

        Logger.info(`Logged in as ${this.client.user.tag}`);
    }

    private async loadGuild(guild: Guild) {
        Logger.debug(`Loading guild ${guild.name}`);

        const DEFAULT_COMMAND_KEYS = [
            'ninja.nairobi.common.about',
            'ninja.nairobi.misc.avatar',
            'ninja.nairobi.common.admin',
            'ninja.nairobi.common.define',
            'ninja.nairobi.misc.metric',
            'ninja.nairobi.common.profile',
            'ninja.nairobi.common.poll'
        ];

        const dbGuild = await Database.server.upsert({
            where: {
                serverId: guild.id
            },
            update: {},
            create: {
                serverId: guild.id,
                name: guild.name,
                commandKeys: {
                    connect: DEFAULT_COMMAND_KEYS.map((key) => {
                        return {
                            key
                        };
                    })
                }
            },
            include: {
                commandKeys: true
            }
        });

        const keys = dbGuild.commandKeys.map((dbCommandKey) => dbCommandKey.key);

        // Load autoreplies first for /about to work
        await this._autoreplyHandler.loadAutorepliesFromKeys(guild, keys);
        await this._commandHandler.loadCommandsFromKeys(guild, keys);

        Logger.info(`Loading guild ${guild.name} finished`);
    }

    private async loadAllGuilds() {
        const guildPartials = await this.client.guilds.fetch();
        const guildPromises = guildPartials.map((guildPartial) => guildPartial.fetch());

        this._guildCount = guildPartials.size;

        for (const guild of await Promise.all(guildPromises)) {
            this.loadGuild(guild);
        }
    }

    private async memberRemoveHook(member: GuildMember | PartialGuildMember) {
        const dbServerInfo = await Database.serverInfo.findUnique({
            where: {
                serverId: member.guild.id
            }
        });

        if (dbServerInfo !== null && dbServerInfo.goodbyeText !== null) {
            const channelId = dbServerInfo.goodbyeChId;
            const guild = member.guild;
            const channel =
                channelId === null
                    ? guild.systemChannel
                    : await guild.channels.fetch(channelId);
            if (channel instanceof TextChannel) {
                channel
                    .send(
                        dbServerInfo.goodbyeText
                            .replace('$name', member.displayName)
                            .replace('$count', guild.memberCount.toString())
                    )
                    .catch(() => {});
            }
        }
    }

    private async interactionAutocompleteRespond(
        interaction: AutocompleteInteraction,
        command: FinaCommand
    ) {
        if (command.hasAutocomplete()) {
            const choices = await command.printAutocomplete(interaction);
            const validatedChoices = choices.slice(0, 20).map((choice) => {
                return {
                    name: StringTools.trim(choice.name, 100),
                    value:
                        typeof choice.value === 'string'
                            ? StringTools.trim(choice.value, 100)
                            : choice.value
                };
            });
            await interaction.respond(validatedChoices);
        }
    }

    private async interactionHookWrapper(interaction: Interaction) {
        try {
            await this.interactionHook(interaction);
        } catch (error: unknown) {
            if (interaction.isMessageComponent() || interaction.isApplicationCommand()) {
                const replyOptions = DiscordTools.printPanic(error);
                await interaction.reply(DiscordTools.formatReply(replyOptions));
            }
        }
    }

    private async interactionHook(interaction: Interaction) {
        let command: FinaCommand;
        let hint: string = '';

        finassert(interaction.inCachedGuild(), {
            details: 'Attempted to interact outside of a cached guild'
        });

        Logger.debug(
            `Interaction: ${interaction.member.id} ${interaction.id} ${interaction.type}`
        );

        if (
            interaction.isButton() ||
            interaction.isSelectMenu() ||
            interaction.isModalSubmit()
        ) {
            const [commandUid, actualCustomId] = StringTools.properSplit(
                interaction.customId,
                ':',
                2
            );

            Logger.debug(`Custom id: ${commandUid} ${actualCustomId}`);

            try {
                command = this._commandHandler.getCommandByUid(commandUid);
            } catch (error) {
                throw new FinaError({ message: 'This component has expired' });
            }

            interaction.customId = actualCustomId;
        } else if (
            interaction.isAutocomplete() ||
            interaction.isCommand() ||
            interaction.isContextMenu()
        ) {
            const builder = this._commandHandler.getCommandFromInteraction(interaction);
            const rootCommand = builder.command;
            hint = builder.hint ?? builder.name;

            if (interaction.isContextMenu()) {
                command = rootCommand;
            } else {
                command = rootCommand.getSubcommand(interaction);
            }
        } else {
            Logger.error('Unsupported interaction type');
            return;
        }

        finassert(
            !command.hasFlag('AdminOnly') ||
                interaction.memberPermissions?.has('MANAGE_GUILD'),
            {
                message: 'This command requires the `Manage Server` permission'
            }
        );

        if (interaction.isApplicationCommand()) {
            Logger.debug(
                `${interaction.commandName} ${interaction.options.data
                    .map((obj) => `${obj.name}${obj.value ? `=${obj.value}` : ''}`)
                    .join(' ')}`
            );
        } else if (interaction.isMessageComponent()) {
            Logger.debug(`Clicked: ${interaction.customId}`);
        } else if (interaction.isModalSubmit()) {
            Logger.debug(`Submitted: ${interaction.customId}`);
        }

        let showTerms = false;
        if (command.hasFlag('RequiresTerms')) {
            const userData = await Database.user.findUnique({
                where: { userId: interaction.user.id }
            });
            if (userData === null) {
                await Database.user.create({
                    data: {
                        userId: interaction.user.id
                    }
                });
                showTerms = true;
            }
        }

        if (interaction.isAutocomplete()) {
            this.interactionAutocompleteRespond(interaction, command).catch(() => {});
        } else {
            const reply = DiscordTools.baseReplyFactory(interaction, command);

            try {
                if (interaction.isCommand()) {
                    DiscordTools.validateInteractionSlash(interaction, hint);
                    finassert(command.hasSlash(), {
                        details: 'Incompatible command type'
                    });
                    await command.process(reply, interaction);
                } else if (interaction.isMessageContextMenu()) {
                    DiscordTools.validateInteractionContextMessage(interaction, hint);
                    finassert(command.hasContextMessage(), {
                        details: 'Incompatible command type'
                    });
                    await command.processContextMessage(reply, interaction);
                } else if (interaction.isUserContextMenu()) {
                    DiscordTools.validateInteractionContextUser(interaction, hint);
                    finassert(command.hasContextUser(), {
                        details: 'Incompatible command type'
                    });
                    await command.processContextUser(reply, interaction);
                } else if (interaction.isButton()) {
                    DiscordTools.validateInteractionButton(interaction, hint);
                    finassert(command.hasButtons(), {
                        details: 'Incompatible command type'
                    });
                    await command.processButton(reply, interaction);
                } else if (interaction.isSelectMenu()) {
                    DiscordTools.validateInteractionMenu(interaction, hint);
                    finassert(command.hasMenu(), {
                        details: 'Incompatible command type'
                    });
                    await command.processMenu(reply, interaction);
                } else if (interaction.isModalSubmit()) {
                    DiscordTools.validateInteractionModal(interaction, hint);
                    finassert(command.hasModal(), {
                        details: 'Incompatible command type'
                    });
                    await command.processModal(reply, interaction);
                }
            } catch (error) {
                await reply(DiscordTools.printPanic(error));
            }

            if (showTerms) {
                await reply({
                    title: 'Note about data usage',
                    content: `Some commands (like this one) require ${
                        interaction.guild.me?.displayName ?? process.env.NAME ?? 'Fina'
                    } to store some essential data tied to your ID. It's nothing to worry about but it's better to let you know!
                    You can review the data using \`/about Data usage\` and \`/profile\``,
                    ephemeral: true
                });
            }
        }
    }

    private async messageCreateHook(message: Message) {
        if (message.author.bot) {
            return;
        }
        if (message.channel.type === 'DM') {
            if (message.attachments.size === 0) {
                message.reply('Interact with me in a server.');
            }
        } else {
            this._autoreplyHandler.reply(message);

            if (message.channel instanceof ThreadChannel) {
                ModmailHandler.send(message);
            }
        }
    }
}
