import Database from 'core/Database';
import { FinaSlashCommand, BaseReply, IAutocompleteCommand } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { finassert } from 'core/FinaError';
import { FinaReplyOptions } from 'core/FinaReplyOptions';
import { FinaCommandInteraction } from 'core/Types';
import {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    EmbedField,
    EmbedFieldData,
    MessageAttachment
} from 'discord.js';

export class ArcSong extends FinaSlashCommand implements IAutocompleteCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'song';
        const command = new FinaCommandBuilder(this)
            .setName('song')
            .setDescription('Outlines a song')
            .addOption({
                name: 'song-name',
                description: 'The name of the song',
                type: 'String',
                required: true,
                autocomplete: true
            })
            .addOption({
                name: 'hidden',
                type: 'Boolean',
                description: 'Whether to send this message privately (default: true)',
                required: false
            });

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const apiName = interaction.options.getString('song-name', true);
        const ephemeral = interaction.options.getBoolean('hidden') ?? true;

        const dbArcCharts = await Database.arcChart.findMany({
            where: {
                apiName
            },
            orderBy: {
                tier: 'asc'
            }
        });

        const fields: EmbedFieldData[] = [];

        const names = new Set<string>();
        const difficultyNames = ['Past', 'Present', 'Future', 'Beyond'];
        const res: FinaReplyOptions = {};

        for (const dbArcChart of dbArcCharts) {
            names.add(dbArcChart.name);
            fields.push({
                name: `Difficulty (${difficultyNames[dbArcChart.tier]})`,
                value: (dbArcChart.chartConstant / 10.0).toFixed(1),
                inline: true
            });
        }

        const last = dbArcCharts.at(-1);

        finassert(last !== undefined, { message: 'This song has no charts' });

        fields.push({
            name: 'Light background',
            value: last.lightBg
                ? `[${last.lightBg}](https://arcaea.fandom.com/wiki/Category:${last.lightBg}_Background_Songs)`
                : '—',
            inline: true
        });

        fields.push({
            name: 'Conflict background',
            value: last.darkBg
                ? `[${last.darkBg}](https://arcaea.fandom.com/wiki/Category:${last.darkBg}_Background_Songs)`
                : '—',
            inline: true
        });

        fields.push({
            name: 'Default theme',
            value:
                last.color === 'LIGHT'
                    ? 'Light'
                    : last.color === 'DARK'
                    ? 'Conflict'
                    : 'Colorless',
            inline: true
        });

        if (last.coverArt !== null) {
            res.files = [new MessageAttachment(last.coverArt, `${apiName}.jpg`)];
            res.image = { url: `attachment://${apiName}.jpg` };
        }

        await reply({
            ...res,
            title: Array.from(names.values()).join(' / '),
            fields,
            ephemeral
        });
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        const input = interaction.options.getFocused().toString().toLowerCase();

        const songs = (
            await Database.arcChart.findMany({
                select: {
                    name: true,
                    apiName: true
                },
                orderBy: {
                    name: 'asc'
                },
                distinct: 'apiName'
            })
        ).filter((song) => song.name.toLowerCase().indexOf(input) >= 0);

        return songs.map((song) => {
            return {
                name: song.name,
                value: song.apiName
            };
        });
    }
}
