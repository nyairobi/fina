import {
    ApplicationCommandType,
    ApplicationCommandOptionChoiceData,
    ApplicationCommandData
} from 'discord.js';
import { FinaCommand } from 'core/FinaCommand';
import { finassert } from 'core/FinaError';
import { FinaOptionData, FinaOptionChoice, FinaOption } from 'core/FinaOption';

export type FinaCommandResolvable = FinaCommandBuilder | FinaCommandBuilder[];

export class FinaCommandBuilder {
    private _command: FinaCommand;
    private _name: string;
    private _hint?: string;
    private _description?: string;
    private _type: ApplicationCommandType;
    private _options?: FinaOptionData[];

    public constructor(command: FinaCommand) {
        this._name = 'No name';
        this._command = command;
        this._type = 'CHAT_INPUT';
    }

    public get command() {
        return this._command;
    }

    public get name() {
        return this._name;
    }

    public get hint() {
        return this._hint;
    }

    public get description() {
        return this._description || 'No description';
    }

    public get type() {
        return this._type;
    }

    public get options() {
        return this._options;
    }

    public setName(name: string, hint?: string): FinaCommandBuilder {
        this._name = name;
        this._hint = hint;
        return this;
    }
    public setDescription(description: string): FinaCommandBuilder {
        this._description = description;
        return this;
    }
    public setType(type: ApplicationCommandType): FinaCommandBuilder {
        this._type = type;
        return this;
    }
    public addOption(
        option: FinaOptionData,
        /** @deprecated */
        ...choiceArray: FinaOptionChoice[]
    ): FinaCommandBuilder {
        this._options ??= [];
        // const resChoices: ApplicationCommandOptionChoiceData[] = [];
        // for (const newChoice of choiceArray) {
        //     if (Array.isArray(newChoice)) {
        //         finassert(newChoice.length > 1, { details: 'Invalid choice' });
        //         resChoices.push({ name: newChoice[0].toString(), value: newChoice[1] });
        //     } else {
        //         resChoices.push({ name: newChoice.toString(), value: newChoice });
        //     }
        // }
        this._options.push({ choices: choiceArray, ...option });
        return this;
    }

    public toDiscord(): ApplicationCommandData {
        if (this._type === 'CHAT_INPUT') {
            return {
                name: this.name,
                description: this.description,
                type: 'CHAT_INPUT',
                options: this._options?.map((option) =>
                    FinaOption.toDiscordOption(option)
                )
            };
        } else {
            return {
                name: this._name,
                type: this._type
            };
        }
    }
}
