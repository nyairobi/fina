import { finassert } from 'core/FinaError';
import { FinaSlashCommand, BaseReply, IButtonCommand } from 'core/FinaCommand';
import { Collection, GuildMember, TextChannel } from 'discord.js';
import fs from 'fs';
import RawThemes from 'commands/games/rps/RPSThemes.json';
import { FinaButtonInteraction, FinaCommandInteraction } from 'core/Types';
import { TimedCollection } from 'util/TimedCollection';
import { RPSInstance, RPSTheme, RPSType } from 'commands/games/rps/RPSInstance';
import { FinaCommandBuilder } from 'core/FinaCommandBuilder';

export class RPSStart extends FinaSlashCommand implements IButtonCommand {
    private _games: TimedCollection<RPSInstance>;
    private _themes: Collection<string, RPSTheme>;

    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.games.rps'];

        this._games = new TimedCollection(7200_000, 'This game has timed out!');
        this._themes = new Collection();
        this.loadThemes();
    }

    public createCommands(): FinaCommandBuilder {
        this.alias = 'rps';
        return new FinaCommandBuilder(this)
            .setName('rps')
            .setDescription('Rock-Paper-Scissors duel game')
            .addOption({
                type: 'User',
                name: 'user',
                description: 'The person to challenge',
                required: true
            })
            .addOption(
                {
                    name: 'theme',
                    type: 'String',
                    description: 'The theme of the duel',
                    required: false
                },
                ...this._themes.keys()
            );
    }

    private loadThemes() {
        for (const [themeName, rawTheme] of Object.entries(RawThemes)) {
            const newTypes: RPSType[] = [];
            let firstNormalType: RPSType | null = null;
            let recentNormalType: RPSType | null = null;
            for (const rawType of rawTheme.types) {
                const targetDir = `./res/rps/${rawTheme.path}/${rawType.path}`;
                const files = fs
                    .readdirSync(targetDir)
                    .map((filename) => `${targetDir}/${filename}`);
                const rpsType: RPSType = {
                    ...rawType,
                    files,
                    next: null
                };
                if (rpsType.supercolor === undefined) {
                    if (firstNormalType === null) {
                        firstNormalType = rpsType;
                    }
                    rpsType.next = recentNormalType;
                    recentNormalType = rpsType;
                }

                newTypes.push(rpsType);
            }
            if (firstNormalType !== null) {
                firstNormalType.next = recentNormalType;
            }
            const targetDir = `./res/rps/${rawTheme.path}`;
            const newTheme: RPSTheme = {
                backgrounds: fs
                    .readdirSync(`${targetDir}/bg`)
                    .map((filename) => `${targetDir}/bg/${filename}`),
                types: newTypes,
                frame: `${targetDir}/frame.png`,
                name: rawTheme.name
            };
            this._themes.set(themeName, newTheme);
        }
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        finassert(interaction.channel instanceof TextChannel, {
            message: 'Invalid channel'
        });

        const p1 = interaction.member;
        const p2 = interaction.options.getMember('user', true);

        finassert(p1 instanceof GuildMember && p2 instanceof GuildMember, {
            message: 'Invalid users'
        });

        finassert(p1.id !== p2.id, {
            message: "You can't challenge yourself",
            gif: 'permissions'
        });

        const theme =
            this._themes.get(interaction.options.getString('theme') || '') ||
            this._themes.first();

        finassert(theme !== undefined, {
            message: 'Invalid theme'
        });

        const rpsInstance = new RPSInstance(theme, [p1, p2]);

        const sourceMessage = await reply({
            ...rpsInstance.printWelcomeMessage(),
            fetchReply: true
        });
        this._games.set(sourceMessage, rpsInstance);
    }

    public async processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> {
        const game = this._games.get(interaction.message);

        finassert(game !== undefined, {
            message: 'This game has expired.'
        });

        await reply(await game.processButton(interaction));

        if (game.gameOver) {
            this._games.delete(interaction.message, true);
        }
    }
}
