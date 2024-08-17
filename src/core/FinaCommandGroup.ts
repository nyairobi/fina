import { AutocompleteInteraction, CommandInteraction, Guild } from 'discord.js';
import Database from 'core/Database';
import { BaseReply, FinaCommand, FinaSlashCommand } from 'core/FinaCommand';
import { FinaError, finassert } from 'core/FinaError';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder } from './FinaCommandBuilder';

export abstract class FinaCommandGroup extends FinaSlashCommand {
    private _subcommands: FinaSlashCommand[];
    private _name: string;

    public constructor(uid: string) {
        super(uid);
        this._subcommands = [];
        this._name = 'noname';
    }

    protected set name(name: string) {
        this._name = name;
    }

    public get subcommands() {
        return this._subcommands;
    }

    public async createCommands(
        guild: Guild,
        otherCommands: FinaCommandBuilder[]
    ): Promise<FinaCommandBuilder> {
        const dbGuild = await Database.server.findUnique({
            where: {
                serverId: guild.id
            },
            include: {
                commandKeys: true
            }
        });

        // Keys logic for sub-subcommands
        const keys = dbGuild?.commandKeys.map((dbCommandKey) => dbCommandKey.key) || [];
        const resultBuilder = new FinaCommandBuilder(this)
            .setName(this._name)
            .setDescription('Command group');
        for (const subcommand of this._subcommands) {
            if (keys.some((key) => subcommand.keys.includes(key))) {
                if (subcommand instanceof FinaCommandGroup) {
                    const builder = await subcommand.createCommands(guild, otherCommands);
                    resultBuilder.addOption({
                        name: builder.name,
                        description: builder.description,
                        type: 'SubcommandGroup',
                        options: builder.options
                    });
                } else {
                    const builders = await subcommand.createCommandArray(
                        guild,
                        otherCommands
                    );
                    for (const builder of builders) {
                        if (builder.type !== 'CHAT_INPUT') {
                            continue;
                        }
                        resultBuilder.addOption({
                            name: builder.name,
                            description: builder.description,
                            type: 'Subcommand',
                            options: builder.options
                        });
                    }
                }
            }
        }

        return resultBuilder;
    }

    public isCommandGroup(): this is FinaCommandGroup {
        return true;
    }

    protected addSubcommand(Subcommand: new (uid: string) => FinaSlashCommand) {
        const subcommand = new Subcommand(`${this.uid}/${this._subcommands.length}`);
        this._subcommands.push(subcommand);
    }

    private findSubcommand(name: string): FinaSlashCommand | undefined {
        let res = this._subcommands.find((command) => command.aliases.has(name));

        for (const subcommand of this._subcommands) {
            if (res === undefined && subcommand instanceof FinaCommandGroup) {
                res = subcommand.findSubcommand(name);
            }
        }

        return res;
    }

    public getSubcommandByUid(uid?: string): FinaCommand {
        let res: FinaCommand | undefined = undefined;

        for (const subcommand of this._subcommands) {
            if (subcommand.isCommandGroup()) {
                res ??= subcommand.getSubcommandByUid(uid);
            } else {
                if (subcommand.uid === uid) {
                    return subcommand;
                }
            }
        }

        if (res === undefined && uid === this.uid) {
            res = this;
        }

        finassert(res !== undefined, { details: `Unknown subcommand ${uid}` });
        return res;
    }

    public getSubcommand(
        interaction: CommandInteraction | AutocompleteInteraction
    ): FinaCommand {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = this.findSubcommand(subcommandName);

        finassert(subcommand !== undefined, {
            details: `Unknown subcommand ${subcommandName}`
        });

        return subcommand.getSubcommand(interaction);
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        throw new FinaError({ details: 'This is a parent command' });
    }
}
