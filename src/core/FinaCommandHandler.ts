import {
    AutocompleteInteraction,
    Client,
    Collection,
    Guild,
    BaseCommandInteraction
} from 'discord.js';
import { FinaCommand } from 'core/FinaCommand';
import fs from 'fs';
import { finassert } from './FinaError';
import { Logger } from './Logger';
import Database from './Database';
import { GuildId } from 'core/Types';
import { FinaCommandBuilder } from './FinaCommandBuilder';
import { StringTools } from 'util/StringTools';
import { Path } from 'typescript';
import path from 'path';

type CommandConstructable = new () => FinaCommand;
type BuilderCollection = Collection<string, FinaCommandBuilder>;

export class FinaCommandHandler {
    private _staticCommands: FinaCommand[] = [];
    private _guildCommands: Collection<GuildId, BuilderCollection> = new Collection();
    private static _instance: FinaCommandHandler;

    public constructor(client: Client) {
        FinaCommandHandler._instance = this;

        Promise.all([
            this.loadCommandDefinitions(),
            this.refreshDatabaseCommandList()
        ]).then(() => {
            Logger.info('FinaCommandHandler is ready');
        });
    }

    public static get instance() {
        return this._instance;
    }

    private async loadCommandDirectory(
        base_path: string,
        directory: string,
        subdirectory: string
    ) {
        const RELATIVE_COMMANDS_PATH = '../commands';
        const rootPath = path.join(base_path, directory, subdirectory);
        const allFiles = fs.readdirSync(rootPath);
        const commandFiles = allFiles.filter((file) => file.indexOf('.ts') >= 0);
        const subdirectories = allFiles.filter((file) =>
            fs.lstatSync(`${rootPath}/${file}`).isDirectory()
        );

        const commands: CommandConstructable[] = [];

        for (const newSubdirectory of subdirectories) {
            await this.loadCommandDirectory(
                base_path,
                directory,
                path.join(subdirectory, newSubdirectory)
            );
        }

        for (const file of commandFiles) {
            const commandPath = path.join(
                RELATIVE_COMMANDS_PATH,
                directory,
                subdirectory,
                file.replace('.ts', '.js')
            );
            const command = require(commandPath).default;
            if (command !== undefined) {
                commands.push(command);
            }
        }

        for (const Command of commands) {
            try {
                const commandInstance = new Command();
                commandInstance.category = directory;
                this._staticCommands.push(commandInstance);
                Logger.debug(
                    `FinaCommandHandler has registered ${commandInstance.uid} [${directory}]`
                );
            } catch (error) {
                if (error instanceof TypeError) {
                    Logger.error(`Unable to register a command: not a constructor`);
                } else {
                    throw error;
                }
            }
        }
    }

    public async loadCommandDefinitions() {
        const BASE_PATH = './src/commands';
        const commandDirectories = fs
            .readdirSync(BASE_PATH)
            .filter((file) => file.indexOf('.') < 0);

        for (const directory of commandDirectories) {
            await this.loadCommandDirectory(BASE_PATH, directory, '');
        }

        /**
         * Push back the commands that rely on the list of other commands
         * (Such as the config command)
         */
        this._staticCommands.sort((a) => (a.hasFlag('DelayedInit') ? 1 : -1));
    }

    public async refreshDatabaseCommandList() {
        const oldKeys = (await Database.commandKey.findMany()).map(
            (dbCommandKey) => dbCommandKey.key
        );
        const newKeySet: Set<string> = new Set();

        for (const finaCommand of this._staticCommands) {
            for (const key of finaCommand.keys) {
                if (!oldKeys.includes(key)) {
                    Logger.debug(`Found a new command key: ${key} (${finaCommand.uid})`);
                    newKeySet.add(key);
                }
            }
        }

        const newPackages: { packageId: string }[] = [];
        const newKeys = Array.from(newKeySet).map((key) => {
            const lastDot = key.lastIndexOf('.');
            const packageId = key.slice(0, lastDot);
            Logger.info(`Found a new command key: ${key}`);
            newPackages.push({
                packageId
            });
            return {
                key,
                friendlyName: StringTools.capitalize(key.slice(lastDot + 1)),
                packageId
            };
        });

        await Database.commandPackage.createMany({
            data: newPackages,
            skipDuplicates: true
        });
        await Database.commandKey.createMany({ data: newKeys });
    }

    public getCommandByUid(commandUid: string) {
        const rootCommandUid = commandUid.replace(/\/.*/, '');

        const result = this._staticCommands.find(
            (command) => command.uid === rootCommandUid,
            ''
        );

        finassert(result !== undefined, { details: 'Invalid command' });

        return result.getSubcommandByUid(commandUid);
    }

    public getCommandFromInteraction(
        interaction: BaseCommandInteraction | AutocompleteInteraction
    ) {
        finassert(interaction.guildId !== null, { details: 'DMs not supported' });

        const command = this._guildCommands
            .get(interaction.guildId)
            ?.get(interaction.commandId);

        finassert(command !== undefined, {
            details: `Command ${interaction.commandName} not found`
        });
        return command;
    }

    public getCommandDefinitions() {
        return this._staticCommands.slice();
    }

    public getGuildCommands(guild: Guild) {
        const _guildCommands = this._guildCommands.get(guild.id);
        return Array.from(_guildCommands?.values() ?? []);
    }

    public async loadCommandsFromKeys(guild: Guild, keys: string[]) {
        const _guildCommands = this._guildCommands.ensure(
            guild.id,
            () => new Collection()
        );

        const target: FinaCommandBuilder[] = [];
        for (const finaCommand of this._staticCommands) {
            if (finaCommand.keys.some((commandKey) => keys.includes(commandKey))) {
                const builders = await finaCommand.createCommandArray(guild, target);
                target.push(...builders);
            }
        }

        const response = await guild.commands.set(
            target.map((builder) => builder.toDiscord())
        );

        for (const [commandId, discordCommand] of response) {
            const builder = target.find(
                (builder) => builder.name === discordCommand.name
            );

            finassert(builder !== undefined, {
                details: `Created a command ${discordCommand.name}, but it should not exist`
            });

            Logger.debug(
                `FinaCommandHandler has registered ${guild.name}:${discordCommand.name}`
            );
            _guildCommands.set(commandId, builder);
        }
    }
}
