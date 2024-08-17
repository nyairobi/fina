import {
    ApplicationCommandNonOptionsData,
    ApplicationCommandOptionChoiceData,
    ApplicationCommandOptionData,
    ApplicationCommandSubCommandData,
    ApplicationCommandSubGroupData
} from 'discord.js';
import { finassert } from './FinaError';

const TYPE_VALUES = {
    Subcommand: 1,
    SubcommandGroup: 2,
    String: 3,
    Integer: 4,
    Boolean: 5,
    User: 6,
    Channel: 7,
    Role: 8,
    Mentionable: 9,
    Number: 10,
    Attachment: 11
};

type FinaCommandOptionType = keyof typeof TYPE_VALUES;

export type FinaOptionChoice = string | number | (string | number)[];

export type FinaOptionCreator = (
    option: FinaOptionData,
    ...choiceArray: FinaOptionChoice[]
) => void;

export interface FinaOptionData {
    name: string;
    description: string;
    type: FinaCommandOptionType;
    required?: boolean;
    autocomplete?: boolean;
    options?: FinaOptionData[];
    choices?: FinaOptionChoice[];
}

export class FinaOption {
    private static convertChoicesToDiscord(
        choiceArray: FinaOptionChoice[] | undefined
    ): ApplicationCommandOptionChoiceData[] | undefined {
        if (choiceArray === undefined || choiceArray.length === 0) {
            return undefined;
        } else {
            const resChoices: ApplicationCommandOptionChoiceData[] = [];
            for (const newChoice of choiceArray) {
                if (Array.isArray(newChoice)) {
                    finassert(newChoice.length > 1, { details: 'Invalid choice' });
                    resChoices.push({
                        name: newChoice[0].toString(),
                        value: newChoice[1]
                    });
                } else {
                    resChoices.push({ name: newChoice.toString(), value: newChoice });
                }
            }
            return resChoices;
        }
    }

    public static toDiscordOption(
        optionData: FinaOptionData
    ): ApplicationCommandOptionData {
        if (optionData.options === undefined) {
            return {
                name: optionData.name,
                description: optionData.description,
                type: TYPE_VALUES[optionData.type],
                choices: this.convertChoicesToDiscord(optionData.choices),
                required: optionData.required,
                autocomplete: optionData.autocomplete
            };
        } else {
            const options = [];
            let isSubcommandGroup = false;
            for (const option of optionData.options) {
                if (option.type === 'Subcommand') {
                    isSubcommandGroup = true;
                }
                options.push(FinaOption.toDiscordOption(option));
            }
            if (isSubcommandGroup) {
                const res: ApplicationCommandSubGroupData = {
                    name: optionData.name,
                    description: optionData.description,
                    type: TYPE_VALUES.SubcommandGroup,
                    options: options as ApplicationCommandSubCommandData[]
                };
                return res;
            } else {
                const res: ApplicationCommandSubCommandData = {
                    name: optionData.name,
                    description: optionData.description,
                    type: TYPE_VALUES.Subcommand,
                    options: options as ApplicationCommandNonOptionsData[]
                };
                return res;
            }
        }
    }
}
