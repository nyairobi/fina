import { FinaSlashCommand, BaseReply, IAutocompleteCommand } from 'core/FinaCommand';
import {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    CacheType
} from 'discord.js';
import { WikiParser } from './WikiParser';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';

export default class Define extends FinaSlashCommand implements IAutocompleteCommand {
    _wiktionary: WikiParser;

    public constructor() {
        super('ninja.nairobi.common.define');
        this._wiktionary = new WikiParser('https://en.wiktionary.org/w/api.php');
        this._wiktionary.init();
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('define')
            .setDescription('Searches the dictionary')
            .addOption({
                name: 'word',
                type: 'String',
                description: 'The word to define',
                required: true,
                autocomplete: true
            });
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const pageUrl = interaction.options.getString('word', true);
        await reply(await this._wiktionary.printPageContent(pageUrl, 'wiktionary'));
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction<CacheType>
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        const input = interaction.options.getFocused().toString();

        if (input.length < 2) {
            return [];
        }

        return this._wiktionary.autocomplete(input, {
            count: 10,
            skipDisambigCheck: true
        });
    }
}
