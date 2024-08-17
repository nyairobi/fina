import {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    CacheType,
    Collection,
    Guild,
    MessageActionRow,
    Modal,
    TextInputComponent
} from 'discord.js';

import {
    BaseReply,
    IAutocompleteCommand,
    FinaSlashCommand,
    IConfigCommand
} from 'core/FinaCommand';
import { FinaError, finassert } from 'core/FinaError';

import Database from 'core/Database';

import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
import { WikiParser } from './WikiParser';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { StringTools } from 'util/StringTools';
import { Fina } from 'core/Fina';

export default class Wiki
    extends FinaSlashCommand
    implements IAutocompleteCommand, IConfigCommand
{
    private _wikis: Collection<string, WikiParser>;

    public constructor() {
        super('ninja.nairobi.common.wiki');
        this._wikis = new Collection();
    }

    public async createCommands(guild: Guild): Promise<FinaCommandResolvable> {
        const dbServerInfo = await Database.serverInfo.findUnique({
            where: {
                serverId: guild.id
            }
        });

        const wikiNameAndLink: [string, string][] = [];

        if (dbServerInfo === null || dbServerInfo.wiki.length === 0) {
            const apiUrl = 'https://en.wikipedia.org/w/api.php';
            const newWiki = new WikiParser(apiUrl);
            wikiNameAndLink.push(['Wikipedia', apiUrl]);
            this._wikis.set(apiUrl, newWiki);
        } else {
            await Promise.all(
                Array.from(dbServerInfo.wiki.values()).map(async (apiUrl) => {
                    if (!this._wikis.has(apiUrl)) {
                        const newWiki = new WikiParser(apiUrl);
                        await newWiki.init();
                        this._wikis.set(apiUrl, newWiki);
                    }
                    const wiki = this._wikis.get(apiUrl)!;
                    const response = wiki.getSiteInfo();
                    const sitename = response.sitename;
                    if (sitename !== undefined) {
                        wikiNameAndLink.push([sitename, apiUrl]);
                    }
                })
            );
        }

        const res = new FinaCommandBuilder(this)
            .setName('wiki')
            .setDescription('Searches for a wiki page');

        if (wikiNameAndLink.length > 0) {
            res.addOption(
                {
                    name: 'wiki',
                    type: 'String',
                    description: 'The wiki to search',
                    required: true
                },
                ...wikiNameAndLink.sort(([a], [b]) => a.localeCompare(b))
            );
        }

        res.addOption({
            name: 'title',
            type: 'String',
            description: 'The title of the page',
            required: true,
            autocomplete: true
        });

        return res;
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const apiUrl = interaction.options.getString('wiki', true);
        const pageUrl = interaction.options.getString('title', true);
        const wiki = this._wikis.get(apiUrl);

        finassert(wiki !== undefined, {
            message: 'Invalid wiki',
            gif: 'dead'
        });

        await reply(await wiki.printPageContent(pageUrl, 'brief'));
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction<CacheType>
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        const apiUrl = interaction.options.getString('wiki');

        if (apiUrl === null) {
            return [];
        }

        const wiki = this._wikis.get(apiUrl);

        if (wiki === undefined) {
            return [];
        }

        const input = interaction.options.getFocused().toString();

        if (input.length < 3) {
            return [];
        }

        return wiki.autocomplete(input, { count: 4 });
    }

    public async showConfig(interaction: FinaCommandInteraction): Promise<Modal> {
        const rows = [];
        const existingWikis: string[] = [];

        const serverInfo = await Database.serverInfo.findUnique({
            where: {
                serverId: interaction.guild.id
            }
        });

        if (serverInfo !== null && serverInfo.wiki.length > 0) {
            existingWikis.push(...serverInfo.wiki.slice(0, 5));
        }

        for (let i = 0; i < 5; ++i) {
            const textInput = new TextInputComponent()
                .setCustomId(`${i}`)
                .setPlaceholder('https://en.wikipedia.org/w/api.php')
                .setLabel(`Wiki #${i + 1}`)
                .setStyle('SHORT');
            if (i < existingWikis.length) {
                textInput.setValue(existingWikis[i]);
            }
            rows.push(
                new MessageActionRow<TextInputComponent>().setComponents(textInput)
            );
        }

        return new Modal().setTitle('Enter wiki API URLs').setComponents(...rows);
    }

    public async processConfig(
        reply: BaseReply,
        interaction: FinaModalInteraction
    ): Promise<void> {
        const guildId = interaction.guild.id;
        const apiPhps = interaction.components
            .map((row) => StringTools.validateURL(row.components[0].value))
            .filter((textField) => textField.length > 0);
        const TRUSTED_DOMAINS =
            /https:\/\/[^\.]*\.(fandom\.com|wikipedia\.org|miraheze\.org)\//;
        const apiPhpsToAdd = [];

        await Database.serverInfo.upsert({
            where: {
                serverId: guildId
            },
            update: {
                wiki: []
            },
            create: { serverId: guildId }
        });

        let content = '';
        for (const apiPhp of apiPhps) {
            if (TRUSTED_DOMAINS.test(apiPhp)) {
                try {
                    const wikiParser = new WikiParser(apiPhp);
                    await wikiParser.init();
                    const siteInfo = wikiParser.getSiteInfo();
                    content += `${siteInfo.sitename} loaded.\n`;
                    apiPhpsToAdd.push(apiPhp);
                } catch (error) {
                    content += `Unable to load ${apiPhp}. Make sure the URL ends with \`api.php\`\n`;
                }
            } else {
                content += `${apiPhp} is not on the list of trusted domains or is an invalid URL. Message <@114680006105366531>\n`;
            }
        }

        await Database.serverInfo.update({
            where: {
                serverId: guildId
            },
            data: {
                wiki: apiPhpsToAdd
            }
        });

        await reply({
            title: 'Wiki config',
            content,
            ephemeral: true
        });

        await Fina.message('reload-guild', interaction.guild.id);
    }
}
