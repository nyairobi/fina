import {
    ApplicationCommandOptionChoiceData,
    ApplicationCommandPermissionData,
    AutocompleteInteraction,
    CommandInteraction,
    Guild,
    Message,
    Modal
} from 'discord.js';
import {
    FinaButtonInteraction,
    FinaCommandInteraction,
    FinaContextMessageInteraction,
    FinaContextUserInteraction,
    FinaMenuInteraction,
    RoleId,
    FinaModalInteraction
} from 'core/Types';
import { finassert } from 'core/FinaError';
import { FinaCommandGroup } from 'core/FinaCommandGroup';
import { FinaOptionChoice, FinaOptionData } from 'core/FinaOption';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

export type CommandFlag =
    | 'AdminOnly'
    | 'AlwaysEphemeral'
    | 'RequiresTerms'
    | 'AlwaysThinking'
    | 'DelayedInit';

export interface ISlashCommand {
    process(reply: BaseReply, interaction: FinaCommandInteraction): Promise<void>;
}

export interface IButtonCommand {
    processButton(reply: BaseReply, interaction: FinaButtonInteraction): Promise<void>;
}

export interface IMenuCommand {
    processMenu(reply: BaseReply, interaction: FinaMenuInteraction): Promise<void>;
}

export interface IContextMessageCommand {
    processContextMessage(
        reply: BaseReply,
        interaction: FinaContextMessageInteraction
    ): Promise<void>;
}

export interface IContextUserCommand {
    processContextUser(
        reply: BaseReply,
        interaction: FinaContextUserInteraction
    ): Promise<void>;
}

export interface IAutocompleteCommand {
    printAutocomplete(
        interaction: AutocompleteInteraction
    ): Promise<ApplicationCommandOptionChoiceData[]>;
}

export interface IModalCommand {
    processModal(reply: BaseReply, interaction: FinaModalInteraction): Promise<void>;
}

export interface IConfigCommand {
    showConfig(interaction: FinaCommandInteraction): Promise<Modal>;
    processConfig(reply: BaseReply, interaction: FinaModalInteraction): Promise<void>;
}

export type FinaReplyOptionsType<T> = T extends FinaReplyOptions & { fetchReply: true }
    ? Message
    : undefined;

export type BaseReply = <T extends FinaReplyOptions>(
    options: T
) => Promise<FinaReplyOptionsType<T>>;

export abstract class FinaComponentTarget {
    protected _uid: string;

    public constructor(uid: string) {
        this._uid = uid;
    }

    public get uid() {
        return this._uid;
    }
}

export abstract class FinaCommand extends FinaComponentTarget {
    private _category = 'No category';
    private _keys: string[];
    private _options: FinaOptionData[] = [];
    private _flags = new Set<CommandFlag>();
    private _aliases = new Set<string>();
    private _dataUsageDescription: string | undefined;

    public constructor(uid: string) {
        super(uid);
        this._keys = [uid];
    }

    public set category(category: string) {
        this._category = category;
    }

    public get category() {
        return this._category;
    }

    public set keys(keys: string[]) {
        this._keys = keys;
    }

    public get keys() {
        return this._keys;
    }

    public get options() {
        return this._options;
    }

    public set alias(alias: string) {
        this._aliases.add(alias);
    }

    public get aliases() {
        return this._aliases;
    }

    public get dataUsageDescription() {
        return this._dataUsageDescription ?? 'No description of data usage';
    }

    public set dataUsageDescription(dataUsageDescription: string) {
        this._dataUsageDescription = dataUsageDescription;
    }

    protected setFlags(...flags: CommandFlag[]) {
        this._flags.clear();
        for (const flag of flags) {
            this._flags.add(flag);
        }
    }

    public hasFlag(flag: CommandFlag) {
        return this._flags.has(flag);
    }

    public abstract createCommands(
        guild: Guild,
        otherCommands?: FinaCommandBuilder[]
    ): FinaCommandResolvable | Promise<FinaCommandResolvable>;

    public async createCommandArray(guild: Guild, otherCommands?: FinaCommandBuilder[]) {
        const commands = await this.createCommands(guild, otherCommands);
        if (Array.isArray(commands)) {
            return commands;
        } else {
            return [commands];
        }
    }

    // protected addComponentTarget(Target: new (uid: string) => FinaComponentTarget) {
    //     const subcommand = new Subcommand(`${this.uid}/${this._subcommands.length}`);
    //     this._subcommands.push(subcommand);
    // }

    // protected createOption(
    //     option: FinaOptionData,
    //     ...choiceArray: FinaOptionChoice[]
    // ): FinaOptionData {
    //     const resChoices: ApplicationCommandOptionChoiceData[] = [];
    //     for (const newChoice of choiceArray) {
    //         if (Array.isArray(newChoice)) {
    //             finassert(newChoice.length > 1, { details: 'Invalid choice' });
    //             resChoices.push({ name: newChoice[0].toString(), value: newChoice[1] });
    //         } else {
    //             resChoices.push({ name: newChoice.toString(), value: newChoice });
    //         }
    //     }
    //     return { ...option, choices: resChoices };
    // }

    // protected addOption(option: FinaOptionData, ...args: FinaOptionChoice[]) {
    //     const choices: ApplicationCommandOptionChoiceData[] = [];
    //     for (const arg of args) {
    //         if (Array.isArray(arg)) {
    //             finassert(arg.length > 1, { details: 'Invalid choice' });
    //             choices.push({ name: arg[0].toString(), value: arg[1] });
    //         } else {
    //             choices.push({ name: arg.toString(), value: arg });
    //         }
    //     }

    //     this.options.push(Object.assign(option, { choices }));
    // }

    public static async restrict(guild: Guild, roles: RoleId[], commandName: string) {
        const commands = await guild.commands.fetch();
        const thisCommand = commands.find((command) => commandName === this.name);
        if (thisCommand !== undefined) {
            const permissions: ApplicationCommandPermissionData[] = [];
            for (const role of roles) {
                permissions.push({
                    id: role,
                    type: 'ROLE',
                    permission: true
                });
            }
            thisCommand?.setDefaultPermission(permissions.length === 0);
            guild.commands.permissions.set({
                command: thisCommand.id,
                permissions
            });
        }
    }

    public getSubcommandByUid(uid?: string): FinaCommand {
        return this;
    }

    public getSubcommand(
        interaction: CommandInteraction | AutocompleteInteraction
    ): FinaCommand {
        return this;
    }

    public isCommandGroup(): this is FinaCommandGroup {
        return false;
    }

    public hasSlash(): this is ISlashCommand {
        return 'process' in this;
    }

    public hasButtons(): this is IButtonCommand {
        return 'processButton' in this;
    }

    public hasMenu(): this is IMenuCommand {
        return 'processMenu' in this;
    }

    public hasContextMessage(): this is IContextMessageCommand {
        return 'processContextMessage' in this;
    }

    public hasContextUser(): this is IContextUserCommand {
        return 'processContextUser' in this;
    }

    public hasAutocomplete(): this is IAutocompleteCommand {
        return 'printAutocomplete' in this;
    }

    public hasModal(): this is IModalCommand {
        return 'processModal' in this;
    }

    public hasConfig(): this is IConfigCommand {
        return 'showConfig' in this && 'processConfig' in this;
    }
}

export abstract class FinaSlashCommand extends FinaCommand implements ISlashCommand {
    public abstract process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void>;
}
