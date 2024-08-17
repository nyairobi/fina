import { BaseReply } from 'core/FinaCommand';
import { FinaError } from 'core/FinaError';
import { EmbedField, CommandInteraction, Collection } from 'discord.js';
import { GameManager } from './GameManager';
import { formatDistance } from 'date-fns';
import { FinaButtonInteraction, FinaChannel, FinaCommandInteraction } from 'core/Types';
import { FinaReplyOptions } from 'core/FinaReplyOptions';
import { DiscordTools } from 'util/DiscordTools';

export type PlayerId = string;
export type PlayerState = 'Ready' | 'Aborted' | 'Done';
export interface PlayerData {
    state: PlayerState;
    mmrGain: number;
}

export interface GameInfo {
    title: string;
    welcomeMessage: string;
    hostMessage?: FinaReplyOptions;
    mmr: { [key: string]: number };
}

export abstract class BaseGameInstance {
    public abstract info: GameInfo;

    private _op: { readonly id: string; mmrGain: number };
    private _clock: Date;
    private _players: Collection<PlayerId, PlayerData>;
    private _status: 'Ongoing' | 'Loss' | 'Victory';
    private _buttonGroup: number;
    private _timer!: NodeJS.Timeout;
    private _channel: FinaChannel;

    public constructor(reply: BaseReply, interaction: FinaCommandInteraction) {
        this._op = {
            id: interaction.user.id,
            mmrGain: 0
        };

        this._buttonGroup = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        this._channel = interaction.channel;

        this._clock = new Date();
        this._players = new Collection();
        this._status = 'Ongoing';

        this.resetTimeout();
    }

    public get buttonGroup() {
        return this._buttonGroup;
    }

    public get op() {
        return this._op;
    }

    public get players() {
        return this._players;
    }

    public get gameOver() {
        return this._status !== 'Ongoing';
    }

    protected set status(status: typeof this._status) {
        this._status = status;
    }

    // public static configure(info: GameInfo) {
    //     return (constructor: Function) => {
    //         constructor.prototype.info = info;
    //     };
    // }

    public addPlayer(playerId: PlayerId) {
        if (!this.players.has(playerId)) {
            this.players.set(playerId, { state: 'Ready', mmrGain: 0 });
        }
    }

    public resetTimeout() {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            GameManager.end(this, this._op.id, 'The game has timed out');
        }, 14 * 60_000);
    }

    public get duration() {
        return formatDistance(this._clock.getTime(), Date.now());
    }

    public get playerList() {
        let res = '';
        for (const playerId of this.players.keys()) {
            res += `<@${playerId}>`;
        }
        return res;
    }

    public printSummary(authorId: string | null): FinaReplyOptions {
        let fields: EmbedField[] = [];

        fields.push({
            name: `Duration`,
            value: this.duration,
            inline: false
        });
        fields.push({
            name: `Host`,
            value: `<@${this._op.id}>`,
            inline: false
        });
        fields.push({
            name: `Players`,
            value: this.playerList || `No one`,
            inline: false
        });

        return {
            title: this.info.title,
            fields,
            ephemeral: true
        };
    }

    public async answer(
        reply: BaseReply,
        interaction: CommandInteraction
    ): Promise<void> {
        throw new FinaError({
            message: 'This game does not use this command',
            gif: 'dead'
        });
    }

    public abstract processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> | void;

    public printWelcomeScreen(): FinaReplyOptions {
        return {
            title: this.info.title,
            content: `<@${this._op.id}> has started a game of ${this.info.title}.\n\n${this.info.welcomeMessage}`
            // fields: [
            //     {
            //         name: 'MMR rewards',
            //         value: Object.entries(this.info.mmr)
            //             .map(([player, mmr]) => `${player}: ${mmr}`)
            //             .reduce((previous, current) => `${previous}\n${current}`)
            //     }
            // ]
        };
    }

    public async sendEndScreen(message: string) {
        clearTimeout(this._timer);
        await DiscordTools.sendMessage(null, {
            ...this.printSummary(this._op.id),
            author: { name: message },
            content: `gg ${this._status === 'Victory' ? '🎉' : '🤡'}`,
            channel: this._channel
        });
    }
}
