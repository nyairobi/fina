import { FinaCommandResolvable } from 'core/FinaCommandBuilder';
import {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    CacheType,
    Collection,
    Guild,
    HexColorString,
    MessageActionRow,
    MessageButton,
    MessageEmbed
} from 'discord.js';

import { finassert } from 'core/FinaError';
import Database from 'core/Database';
import { Trivia as TriviaPiece, TriviaCategory } from '@prisma/client';
import Fuse from 'fuse.js';
import {
    BaseReply,
    IButtonCommand,
    FinaSlashCommand,
    IAutocompleteCommand
} from 'core/FinaCommand';
import { FinaButtonInteraction, FinaCommandInteraction } from 'core/Types';
import { TimedCollection } from 'util/TimedCollection';
import { StringTools } from 'util/StringTools';
import { FinaCommandBuilder } from 'core/FinaCommandBuilder';

export default class Trivia
    extends FinaSlashCommand
    implements IButtonCommand, IAutocompleteCommand
{
    private _publicIds: number[] = [];
    private _triviaCollections: Collection<number, TriviaCollection>;
    private _triviaGenerators: TimedCollection<(id: number) => MessageEmbed>;

    public constructor() {
        super('ninja.nairobi.wip.trivia');
        this.category = 'common';

        this._triviaCollections = new Collection();
        this._triviaGenerators = new TimedCollection(5000);
    }

    public async init() {
        await this.loadGlobalCollections();
    }

    public async createCommands(guild: Guild): Promise<FinaCommandResolvable> {
        const choices = this._publicIds.map((id) => [
            this._triviaCollections.get(id)!.name,
            id
        ]);

        const dbLocalCollections = await Database.triviaCategory.findMany({
            where: {
                serverId: guild.id
            },
            include: {
                trivias: true
            }
        });

        for (const dbCategory of dbLocalCollections) {
            this._triviaCollections.set(
                dbCategory.categoryId,
                new TriviaCollection(dbCategory)
            );
            choices.push([dbCategory.categoryName, dbCategory.categoryId]);
        }

        return new FinaCommandBuilder(this)
            .setName('trivia')
            .setDescription('Sends a random piece of trivia')
            .addOption(
                {
                    name: 'category',
                    type: 'Integer',
                    description: `The category`,
                    required: true
                },
                ...choices.sort()
            )
            .addOption({
                name: 'search',
                type: 'String',
                description: `The text to search for`,
                required: false,
                autocomplete: true
            });
    }

    private async loadGlobalCollections() {
        const dbGlobalCollections = await Database.triviaCategory.findMany({
            where: {
                serverId: null
            },
            include: {
                trivias: true
            }
        });

        for (const dbCategory of dbGlobalCollections) {
            this._triviaCollections.set(
                dbCategory.categoryId,
                new TriviaCollection(dbCategory)
            );
            this._publicIds.push(dbCategory.categoryId);
        }
    }

    private createRow(currentId: number) {
        return new MessageActionRow().addComponents([
            new MessageButton()
                .setCustomId((currentId - 1).toString())
                .setStyle('PRIMARY')
                .setEmoji('⏮️'),
            new MessageButton()
                .setCustomId((currentId + 1).toString())
                .setStyle('PRIMARY')
                .setEmoji('⏭️')
        ]);
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const categoryId = interaction.options.getInteger('category', true);
        const query = interaction.options.getString('search');

        const collection = this._triviaCollections.get(categoryId);
        finassert(collection !== undefined, {
            message: 'Illegal category',
            gif: 'angry'
        });

        const [generator, size] = collection.createTriviaGenerator(query);

        const message = await reply({
            embed: generator(0),
            components: size > 1 ? [this.createRow(0)] : undefined,
            fetchReply: true
        });

        this._triviaGenerators.set(message, generator);
    }

    public async processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> {
        const generator = this._triviaGenerators.get(interaction.message);
        const idx = parseInt(interaction.customId);

        finassert(generator !== undefined, {
            message: "This button isn't ready or has expired",
            gif: 'dead'
        });

        interaction.message.delete();

        const message = await reply({
            embed: generator(idx),
            components: [this.createRow(idx)],
            fetchReply: true
        });

        this._triviaGenerators.set(message, generator);
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction<CacheType>
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        const category = interaction.options.getInteger('category');
        const query = interaction.options.getFocused().toString();

        if (category === null || query.length < 3) {
            return [];
        }

        const collection = this._triviaCollections.get(category);

        if (collection === undefined) {
            return [];
        }

        return collection.search(query).map((dbTrivia) => {
            const result = StringTools.trim(
                dbTrivia.title === null
                    ? dbTrivia.content
                    : `${dbTrivia.title}: ${dbTrivia.content}`,
                96
            );
            return {
                name: result,
                value: result
            };
        });
    }
}

class TriviaCollection {
    private _name: string = '';
    private _triviaPieces: TriviaPiece[] = [];
    private _color: HexColorString = '#ccc';

    public get name() {
        return this._name;
    }

    public constructor(options: TriviaCategory & { trivias: TriviaPiece[] }) {
        this._name = options.categoryName;
        this._triviaPieces = options.trivias;
        this._color = options.color as HexColorString;
    }

    private triviaGeneratorFromPieces(triviaPieces: TriviaPiece[]) {
        return (idx: number) => {
            while (idx < 0) {
                idx += triviaPieces.length;
            }
            idx %= triviaPieces.length;
            const piece = triviaPieces[idx];
            const embed = new MessageEmbed()
                .setAuthor({ name: this._name })
                .setDescription(piece.content.replaceAll('\\n', '\n'))
                .setTitle(piece.title || 'Trivia')
                .setColor(this._color);
            if (triviaPieces.length > 1) {
                embed.setFooter({ text: `${idx + 1}/${triviaPieces.length}` });
            }

            if (piece.thumb !== null) {
                embed.setThumbnail(piece.thumb);
            }
            if (piece.image !== null) {
                embed.setImage(piece.image);
            }
            return embed;
        };
    }

    public search(query: string) {
        const fuse = new Fuse(this._triviaPieces, {
            keys: [
                {
                    weight: 0.7,
                    name: 'title'
                },
                {
                    weight: 0.3,
                    name: 'content'
                }
            ],
            ignoreLocation: true,
            threshold: 0.2
        });

        return fuse.search(query).map((fuseResult) => fuseResult.item);
    }

    public createTriviaGenerator(
        query: string | null
    ): [(n: number) => MessageEmbed, number] {
        if (query === null) {
            return [
                this.triviaGeneratorFromPieces(this._triviaPieces),
                this._triviaPieces.length
            ];
        } else {
            const result = this.search(query);

            finassert(result.length > 0, {
                message: 'This trivia could not be found',
                gif: 'dead'
            });

            return [this.triviaGeneratorFromPieces(result), result.length];
        }
    }
}
