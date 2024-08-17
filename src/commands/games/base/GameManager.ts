import { finassert } from 'core/FinaError';
import { Logger } from 'core/Logger';
import { FinaChannel } from 'core/Types';
import { TextChannel, Interaction, Collection } from 'discord.js';
import { BaseGameInstance } from './BaseGameInstance';

export class GameManager {
    private static _games: Collection<FinaChannel, BaseGameInstance>;

    public static init() {
        this._games = new Collection();
    }

    public static getCurrentGame(interaction: Interaction) {
        finassert(interaction.channel instanceof TextChannel, {
            message: 'Invalid channel',
            gif: 'dead'
        });

        const game = this._games.get(interaction.channel);

        finassert(game !== undefined, {
            message: 'No game is being played in this channel',
            gif: 'dead'
        });

        return game;
    }

    /**
     * Creates a game in the given channel as long as there is no on-going game
     * @param channel The channel to start the game in
     * @param game The game to start
     */
    public static async create(channel: FinaChannel, game: BaseGameInstance) {
        finassert(this._games.get(channel) === undefined, {
            message: 'A game is already being played in this channel',
            gif: 'dead'
        });
        this._games.set(channel, game);
    }

    public static async end(
        caller: Interaction | BaseGameInstance,
        authorId: string | null,
        message: string
    ) {
        // const L = caller instanceof BaseGameInstance ? caller.lang : Lang(caller);
        const game =
            caller instanceof BaseGameInstance ? caller : this.getCurrentGame(caller);

        // If not op
        if (authorId !== null && authorId !== game.op.id) {
            const player = game.players.get(authorId);
            finassert(player !== undefined && player.state === 'Ready', {
                message: `You are not playing this game`,
                gif: 'dead'
            });
            player.state = 'Aborted';
        } else {
            const channel = this._games.findKey((gameInstance) => game === gameInstance);

            finassert(channel !== undefined, { message: 'Game not found' });

            Logger.debug(`Deleting game ${game.info.title}`);

            this._games.delete(channel);

            game.sendEndScreen(message);
        }
    }
}

GameManager.init();
